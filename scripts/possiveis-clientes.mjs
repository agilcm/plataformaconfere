// Abas "Possíveis clientes" e "Campeões" das Licitações (públicas):
//   Possíveis clientes  empresas das cidades vizinhas (src/data/clientesConfig.js) que disputaram licitações de Minas
//                       Gerais e ficaram do 2º ao 5º lugar (ou ofertaram o melhor preço e não levaram), item a item;
//   Campeões            quem ganhou e levou cada item nas licitações da Zona da Mata, de qualquer cidade, com o valor
//                       ganho segundo a ata.
//
// De onde vem: o PNCP só registra o vencedor de cada item. A classificação completa está na "Ata Final" que o Portal
// de Compras Públicas anexa no PNCP depois da sessão (todas as propostas e lances, com CNPJ). Este script, com as três
// partes ao mesmo tempo:
//   1) procura no PNCP as licitações eletrônicas de Minas dos últimos 12 meses publicadas por esse portal (consulta
//      oficial, por modalidade e quinzena);
//   2) baixa a ata de cada uma (documento público do PNCP), lê os lances e calcula a colocação por item, começando
//      pelas licitações mais perto das cidades escolhidas;
//   3) consulta a cidade de cada CNPJ no cadastro público da Receita (BrasilAPI, minhareceita.org e publica.cnpj.ws);
//   e no fim grava public/prospeccao/clientes.json e public/prospeccao/campeoes.json.
// Compras.gov.br, Licitar Digital e outros portais não anexam a ata no PNCP: essas licitações ficam de fora.
// CPF não entra (pessoa física fica de fora) e nomes de MEI saem sem os números do CPF.
//
// O que já foi lido fica em clientes-cache.json (cache do Actions). Cada execução trabalha alguns minutos
// (CLIENTES_TEMPO_MIN, padrão 8) e continua na próxima; a primeira volta por Minas inteira leva alguns dias.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { CIDADES_CLIENTES, MESES_CLIENTES } from '../src/data/clientesConfig.js';
import { CIDADES_MG, COORDS } from '../src/data/coordenadasMunicipios.js';
import { microrregiaoDe } from '../src/data/zonaDaMata.js';
import { classificarItem, descricaoCurta, ehAtaPcp, lerAtaPcp } from '../src/lib/ataPcp.js';
import { MAX_COLOCACAO, montarCampeoes, montarClientes, montarDiagnosticos, nomeSemCpf, normCidade } from '../src/lib/possiveisClientes.js';
import { fetchJson, fixText, fonteDe } from '../src/lib/pncp.js';
import { linhasDoPdf } from '../src/lib/privado/pdfTexto.js';
import { mensagemOportunidades, oportunidades } from '../src/lib/oportunidades.js';
import { telegram } from './telegram.mjs';

const VERSAO = 3; // 2: atas com julgamento por lote; 3: itens com um só participante e valor total ganho
const CACHE = process.env.CLIENTES_CACHE || 'clientes-cache.json';
const SAIDA = process.env.CLIENTES_SAIDA || 'public/prospeccao';
// arquivo antigo, de quando a aba era só da equipe: sai do site
const SAIDA_ANTIGA = 'public/privado/clientes.json';
// CLIENTES_SO_MONTAR=1: só remonta as listas a partir do cache (a publicação do site usa assim; a leitura das atas
// roda no workflow Prospecção, com mais tempo)
const SO_MONTAR = process.env.CLIENTES_SO_MONTAR === '1';
const TEMPO_MS = Number(process.env.CLIENTES_TEMPO_MIN || 8) * 60e3;
const PORTAL = 'Portal de Compras Públicas';
/** Modalidades lidas, na ordem da busca: pregão eletrônico, concorrência eletrônica e dispensa (códigos do PNCP) */
const MODALIDADES = [6, 4, 8];
const t0 = Date.now();
const restam = () => TEMPO_MS - (Date.now() - t0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pdfjs = null;
const lib = async () => (pdfjs ??= await import('pdfjs-dist/legacy/build/pdf.mjs'));

/** Primeiro PDF de um .zip (a ata vem zipada), sem depender de biblioteca */
export function pdfDoZip(buf) {
  const fim = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (fim < 0) return null;
  let p = buf.readUInt32LE(fim + 16);
  const n = buf.readUInt16LE(fim + 10);
  for (let i = 0; i < n && buf.readUInt32LE(p) === 0x02014b50; i++) {
    const metodo = buf.readUInt16LE(p + 10);
    const tamComp = buf.readUInt32LE(p + 20);
    const tamNome = buf.readUInt16LE(p + 28);
    const extra = buf.readUInt16LE(p + 30);
    const coment = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nome = buf.toString('utf8', p + 46, p + 46 + tamNome);
    if (/\.pdf$/i.test(nome)) {
      const ini = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const dados = buf.subarray(ini, ini + tamComp);
      return metodo === 0 ? dados : metodo === 8 ? zlib.inflateRawSync(dados) : null;
    }
    p += 46 + tamNome + extra + coment;
  }
  return null;
}

async function baixar(url) {
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(60e3) });
      if (r.ok) return Buffer.from(await r.arrayBuffer());
      if (r.status < 500 && r.status !== 429) return null;
    } catch {
      /* tenta de novo */
    }
    await sleep(1500 * (t + 1));
  }
  return null;
}

const chaveMun = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(de|do|da|dos|das)\b/g, '')
    .replace(/[^a-z]/g, '')
    .replace('euzebia', 'eusebia')
    .replace('silverania', 'silveirania');
const IBGE = new Map(CIDADES_MG.map(([nome, cod]) => [chaveMun(nome), cod]));
const ymd = (iso) => iso.replace(/-/g, '');
const diasAntes = (iso, n) => new Date(Date.parse(iso) - n * 86400e3).toISOString().slice(0, 10);

// Ordem de leitura: primeiro as licitações das próprias cidades escolhidas, depois o resto da Zona da Mata e então o
// resto de Minas, sempre das mais perto para as mais longe (em faixas de 30 km) e, na mesma faixa, das mais novas.
const ALVO = new Set(CIDADES_CLIENTES.map((c) => chaveMun(c.nome)));
const PONTOS_ALVO = CIDADES_CLIENTES.map((c) => COORDS[IBGE.get(chaveMun(c.nome))]).filter(Boolean);
const km = ([la1, lo1], [la2, lo2]) => {
  const r = Math.PI / 180;
  const a = Math.sin(((la2 - la1) * r) / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(((lo2 - lo1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
};
const distancias = new Map();
/** Distância (km) do município da licitação até a cidade escolhida mais perto */
function distancia(c) {
  const k = chaveMun(c.municipio);
  if (!distancias.has(k)) {
    const p = COORDS[c.ibge || IBGE.get(k)];
    distancias.set(k, p && PONTOS_ALVO.length ? Math.min(...PONTOS_ALVO.map((q) => km(p, q))) : 9999);
  }
  return distancias.get(k);
}
const naZonaDaMata = (c) => (c.uf || 'MG') === 'MG' && !!microrregiaoDe(c.municipio);
const faixa = (c) => (ALVO.has(chaveMun(c.municipio)) ? 0 : naZonaDaMata(c) ? 1 : 2);
const ordemDeLeitura = (a, b) =>
  faixa(a) - faixa(b) || Math.floor(distancia(a) / 30) - Math.floor(distancia(b) / 30) || String(b.data).localeCompare(String(a.data));

/** Quinzenas do período: [chave, primeiro dia, último dia] (a primeira começa em `desde`) */
export function quinzenas(desde, hoje) {
  const out = [];
  let [y, m] = desde.split('-').map(Number);
  for (;;) {
    const mm = String(m).padStart(2, '0');
    const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
    for (const [q, a, b] of [
      [1, 1, 15],
      [2, 16, ultimo],
    ]) {
      const ini = `${y}-${mm}-${String(a).padStart(2, '0')}`;
      const fim = `${y}-${mm}-${String(b).padStart(2, '0')}`;
      if (fim < desde || ini > hoje) continue;
      out.push([`${y}-${mm}-${q}`, ini < desde ? desde : ini, fim]);
    }
    if (`${y}-${mm}` >= hoje.slice(0, 7)) return out;
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
}

// A consulta do PNCP responde 429 ("muitas consultas") se os pedidos vêm depressa demais: até três ao mesmo tempo, mas
// com pelo menos 1,5 s entre o início de um e o do outro; no 429, todos esperam 20 s, 40 s ou 60 s.
let proximoPedido = 0;
async function consultaPncp(url) {
  for (let t = 0; ; t++) {
    const agora = Date.now();
    const vez = Math.max(agora, proximoPedido);
    proximoPedido = vez + 1500;
    if (vez > agora) await sleep(vez - agora);
    try {
      return await fetchJson(url, { retries: 1, timeout: 45000 });
    } catch (e) {
      if (e.status !== 429 || t >= 3 || restam() < 120e3) throw e;
      proximoPedido = Math.max(proximoPedido, Date.now() + 20e3 * (t + 1));
    }
  }
}

/** As licitações do Portal de Compras Públicas de uma modalidade, em Minas, publicadas entre `de` e `ate` */
async function varrerJanela(mod, de, ate, achadas) {
  const url = (p) =>
    `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=${ymd(de)}&dataFinal=${ymd(ate)}&codigoModalidadeContratacao=${mod}&uf=MG&pagina=${p}&tamanhoPagina=50`;
  const guardar = (d) => {
    for (const c of d?.data || []) {
      if (fonteDe({ usuario_nome: c.usuarioNome, link_sistema_origem: c.linkSistemaOrigem }) !== PORTAL) continue;
      const cnpj = c.orgaoEntidade?.cnpj;
      if (!cnpj) continue;
      achadas.set(`${cnpj}/${c.anoCompra}/${c.sequencialCompra}`, {
        cnpj,
        ano: String(c.anoCompra),
        seq: String(c.sequencialCompra),
        orgao: fixText(c.orgaoEntidade?.razaoSocial),
        municipio: fixText(c.unidadeOrgao?.municipioNome),
        uf: c.unidadeOrgao?.ufSigla || 'MG',
        ...(c.unidadeOrgao?.codigoIbge ? { ibge: String(c.unidadeOrgao.codigoIbge) } : {}),
        titulo: /^\d+$/.test(String(c.numeroCompra || ''))
          ? `Edital nº ${c.numeroCompra}/${c.anoCompra}`
          : fixText(c.numeroCompra) || `Compra ${c.sequencialCompra}/${c.anoCompra}`,
        objeto: fixText(c.objetoCompra),
        modalidade: c.modalidadeNome,
        data: String(c.dataPublicacaoPncp || '').slice(0, 10),
      });
    }
  };
  const d1 = await consultaPncp(url(1));
  guardar(d1);
  const paginas = Array.from({ length: Math.max(0, (d1?.totalPaginas || 1) - 1) }, (_, i) => i + 2);
  let erro = null;
  await Promise.all(
    [0, 1, 2].map(async () => {
      while (paginas.length && !erro) {
        if (restam() < 90e3) erro = new Error('acabou o tempo');
        else
          try {
            guardar(await consultaPncp(url(paginas.shift())));
          } catch (e) {
            erro = e;
          }
      }
    }),
  );
  if (erro) throw erro;
}

/**
 * Busca em Minas inteira, modalidade por modalidade e quinzena por quinzena. cache.mg guarda o dia em que cada
 * quinzena foi varrida até o fim: uma quinzena varrida depois de terminar está pronta; a que ainda estava correndo é
 * vista de novo no dia seguinte, só a partir de 3 dias antes da última varredura.
 * @param {(novas: Map<string, any>) => void} aoAchar  recebe o que cada quinzena trouxe (mesmo se ela falhar no meio)
 */
async function buscarEmMinas(desde, hoje, cache, aoAchar) {
  cache.mg ??= {};
  const janelas = [];
  for (const mod of MODALIDADES)
    for (const [q, ini, fim] of quinzenas(desde, hoje)) {
      const k = `${mod}|${q}`;
      const feita = cache.mg[k];
      if (feita && (feita > fim || feita === hoje)) continue;
      const de = feita && diasAntes(feita, 3) > ini ? diasAntes(feita, 3) : ini;
      janelas.push({ k, mod, de, ate: fim < hoje ? fim : hoje, nova: !feita });
    }
  // primeiro as atualizações (rápidas); depois as quinzenas nunca vistas: pregão, concorrência e dispensa, das mais novas para as mais antigas
  janelas.sort((a, b) => Number(a.nova) - Number(b.nova) || MODALIDADES.indexOf(a.mod) - MODALIDADES.indexOf(b.mod) || b.de.localeCompare(a.de));
  let feitas = 0;
  const falhas = [];
  for (const j of janelas) {
    if (restam() < 180e3) break;
    const novas = new Map();
    try {
      await varrerJanela(j.mod, j.de, j.ate, novas);
      cache.mg[j.k] = hoje;
      feitas++;
    } catch (e) {
      falhas.push(`${j.k} (${e.message})`);
    }
    aoAchar(novas);
  }
  return { feitas, falhas, faltam: janelas.length - feitas };
}

/** Parte da busca em Minas já feita ao menos uma vez (0 a 100) */
function buscaFeita(cache, desde, hoje) {
  const q = quinzenas(desde, hoje);
  const total = q.length * MODALIDADES.length;
  let feitas = 0;
  for (const mod of MODALIDADES) for (const [k] of q) if (cache.mg?.[`${mod}|${k}`]) feitas++;
  return total ? Math.floor((feitas / total) * 100) : 0;
}

/** Lê a ata de uma licitação: { itens } com a colocação de cada empresa, { semAta } ou null (tentar depois) */
async function lerCompra(c, hoje) {
  const arqs =
    (await fetchJson(`https://pncp.gov.br/api/pncp/v1/orgaos/${c.cnpj}/compras/${c.ano}/${c.seq}/arquivos?pagina=1&tamanhoPagina=100`, { retries: 2 })) || [];
  const nome = (a) => `${a.titulo || ''}`;
  const ata = arqs.find((a) => /ata[_ %20-]*final/i.test(nome(a))) || arqs.find((a) => /ata[_ %20-]*parcial/i.test(nome(a)));
  const dias = (Date.parse(hoje) - Date.parse(c.data)) / 86400e3;
  if (!ata) return dias > 150 ? { semAta: true } : null;
  const url = ata.url || ata.uri;
  const buf = url ? await baixar(url) : null;
  if (!buf) return null;
  const pdf = buf.subarray(0, 4).toString() === '%PDF' ? buf : pdfDoZip(buf);
  if (!pdf) return { semAta: true };
  const { linhas } = await linhasDoPdf(await lib(), new Uint8Array(pdf));
  const texto = linhas.map((l) => l.texto);
  if (!ehAtaPcp(texto)) return { semAta: true };
  const itens = [];
  for (const it of lerAtaPcp(texto).itens) {
    const cls = classificarItem(it);
    if (!cls.length) continue;
    const venc = cls.find((x) => x.venceu);
    if (cls.length < 2 && !venc) continue; // um só lance e sem vencedora na ata: nada a mostrar
    itens.push({
      n: it.codigo,
      d: descricaoCurta(it.descricao),
      v: venc ? venc.melhor : null,
      ...(venc && it.vencedorTotal != null ? { t: it.vencedorTotal } : {}),
      ...(it.lote ? { l: 1 } : {}),
      c: cls.map((x) => [x.cnpj, x.colocacao, x.melhor, x.lances, nomeSemCpf(x.nome)]),
    });
  }
  return { itens, parcial: !/final/i.test(nome(ata)) };
}

/**
 * Cidade, porte e atividade de um CNPJ no cadastro público da Receita. Pergunta à BrasilAPI e ao minhareceita.org (os
 * dois devolvem o mesmo formato; cada consulta paralela começa por um, para dividir a carga). Os dois às vezes
 * respondem "não encontrado" para CNPJs que existem: um CNPJ que ninguém achou fica marcado com a data e é consultado
 * de novo em 7 dias.
 */
// a BrasilAPI recusa (403) pedidos com o cabeçalho padrão do Node: vai um nome genérico de cliente (User-Agent)
const FONTES_CNPJ = ['https://brasilapi.com.br/api/cnpj/v1/', 'https://minhareceita.org/'];
/** O que cada fonte respondeu nesta execução (vai para o log, para ver de longe se alguma fonte parou) */
export const respostasCnpj = {};
const anotar = (fonte, o) => {
  respostasCnpj[fonte] ??= {};
  respostasCnpj[fonte][o] = (respostasCnpj[fonte][o] || 0) + 1;
};
const nomeFonte = (base) => new URL(base).hostname.replace(/^www\./, '');

export async function cadastro(cnpj, hoje, fontes = FONTES_CNPJ) {
  let naoAchou = 0;
  for (const base of fontes) {
    let resposta = 'erro';
    for (let t = 0; t < 2; t++) {
      try {
        const r = await fetch(`${base}${cnpj}`, {
          headers: { Accept: 'application/json', 'User-Agent': 'consulta-cnpj/1.0' },
          signal: AbortSignal.timeout(20e3),
        });
        resposta = String(r.status);
        if (r.status === 404) {
          naoAchou++;
          break;
        }
        if (r.ok) {
          const d = await r.json();
          if (!d?.razao_social && !d?.municipio) {
            naoAchou++;
            break;
          }
          anotar(nomeFonte(base), 'achou');
          return {
            r: nomeSemCpf(d.razao_social),
            f: nomeSemCpf(d.nome_fantasia),
            m: d.municipio || '',
            u: d.uf || '',
            p: d.porte || '',
            a: d.cnae_fiscal_descricao || '',
            s: d.descricao_situacao_cadastral || '',
          };
        }
        if (r.status !== 429 && r.status < 500) break;
      } catch {
        resposta = 'erro';
      }
      await sleep(1500 * (t + 1));
    }
    anotar(nomeFonte(base), resposta === '404' ? 'não achou' : resposta);
  }
  // nenhuma das duas achou (ou estão fora / bloqueadas): a terceira fonte, devagar
  const ws = await cadastroCnpjWs(cnpj);
  if (ws) {
    anotar('publica.cnpj.ws', 'achou');
    return ws;
  }
  if (ws === false) anotar('publica.cnpj.ws', 'não achou');
  // "não existe" só quando alguma fonte respondeu isso de fato; fora do ar, tenta na próxima execução
  return ws === false || (ws === undefined && naoAchou === fontes.length) ? { x: 1, em: hoje } : null;
}

// Terceira fonte, só para o que as duas primeiras não acharam: publica.cnpj.ws aceita 3 consultas por minuto, então
// os pedidos saem um de cada vez, com 21 s entre eles, e no máximo CNPJ_WS_POR_EXECUCAO por execução.
const CNPJ_WS_POR_EXECUCAO = Number(process.env.CLIENTES_CNPJ_WS || 15);
let cnpjWsUsados = 0;
let filaCnpjWs = Promise.resolve();
/** @returns {Promise<object | false | null | undefined>} cadastro, false (não existe), null (erro) ou undefined (sem consulta nesta execução) */
function cadastroCnpjWs(cnpj) {
  const vez = filaCnpjWs.then(async () => {
    if (cnpjWsUsados >= CNPJ_WS_POR_EXECUCAO || restam() < 45e3) return undefined; // não consultou
    cnpjWsUsados++;
    try {
      const r = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'consulta-cnpj/1.0' },
        signal: AbortSignal.timeout(25e3),
      });
      if (r.status === 404) return false;
      if (!r.ok) {
        anotar('publica.cnpj.ws', String(r.status));
        return null;
      }
      const d = await r.json();
      const e = d.estabelecimento || {};
      if (!d.razao_social) return null;
      return {
        r: nomeSemCpf(d.razao_social),
        f: nomeSemCpf(e.nome_fantasia),
        m: String(e.cidade?.nome || '').toUpperCase(),
        u: e.estado?.sigla || '',
        p: String(d.porte?.descricao || '').toUpperCase(),
        a: e.atividade_principal?.descricao || '',
        s: String(e.situacao_cadastral || '').toUpperCase(),
      };
    } catch {
      return null;
    } finally {
      await sleep(21e3);
    }
  });
  filaCnpjWs = vez.catch(() => null);
  return vez;
}

/** A ata ainda pode sair? Licitação publicada há menos de 5 dias ainda não teve sessão; a que já foi procurada sem ata
 * volta no dia seguinte (perto das cidades escolhidas) ou em 3 dias (o resto de Minas). */
function esperando(k, c, cache, hoje) {
  if (String(c.data) > diasAntes(hoje, 5)) return true;
  const t = cache.tentouEm?.[k];
  return !!t && t > diasAntes(hoje, faixa(c) <= 1 ? 1 : 3);
}

/** Quanto da leitura já foi feito, nas licitações que passam no filtro */
function resumoDaLeitura(cache, hoje, filtro = () => true) {
  let noPeriodo = 0;
  let naFila = 0;
  let aguardandoAta = 0;
  for (const [k, c] of Object.entries(cache.achadas || {})) {
    if (!filtro(c)) continue;
    noPeriodo++;
    if (cache.compras[k]) continue;
    if (esperando(k, c, cache, hoje)) aguardandoAta++;
    else naFila++;
  }
  const lidas = Object.values(cache.compras).filter((c) => c.itens && filtro(c)).length;
  return { licitacoesNoPeriodo: noPeriodo || lidas, licitacoesLidas: lidas, aindaNaFila: naFila, aguardandoAta };
}

/** Grava as duas listas (com o nome de cada cidade de Minas com acento: a Receita escreve sem) */
function gravarListas(cache, desde, hoje) {
  const comum = {
    atualizadoEm: new Date().toISOString(),
    desde,
    ate: hoje,
    portal: PORTAL,
    // parte da busca no PNCP (Minas inteira, 12 meses) já feita
    buscaFeita: buscaFeita(cache, desde, hoje),
  };
  // Possíveis clientes tem duas listas na tela (licitações da Zona da Mata e de Minas inteira): vai o andamento das duas
  const metaClientes = { ...comum, abrangencia: 'Minas Gerais', ...resumoDaLeitura(cache, hoje), zonaDaMata: resumoDaLeitura(cache, hoje, naZonaDaMata) };
  // Campeões fica na Zona da Mata (Minas inteira deixaria a lista grande demais para abrir no celular)
  const metaCampeoes = { ...comum, abrangencia: 'Zona da Mata', ...resumoDaLeitura(cache, hoje, naZonaDaMata) };
  const cidadesMG = new Map(CIDADES_MG.map(([nome]) => [normCidade(nome), nome]));
  const nomeCidade = (mun, u) =>
    (u === 'MG' && cidadesMG.get(normCidade(mun))) ||
    String(mun || '')
      .toLowerCase()
      .replace(/(^|\s)(\S)/g, (x) => x.toUpperCase())
      .replace(/ (De|Da|Do|Das|Dos|E) /g, (x) => x.toLowerCase());
  const saida = montarClientes(cache, CIDADES_CLIENTES, metaClientes, { naZonaDaMata });
  const soZm = { ...cache, compras: Object.fromEntries(Object.entries(cache.compras).filter(([, c]) => naZonaDaMata(c))) };
  const campeoes = montarCampeoes(soZm, CIDADES_CLIENTES, metaCampeoes, { nomeCidade });
  fs.mkdirSync(SAIDA, { recursive: true });
  fs.writeFileSync(`${SAIDA}/clientes.json`, JSON.stringify(saida));
  fs.writeFileSync(`${SAIDA}/campeoes.json`, JSON.stringify(campeoes));
  // diagnóstico por CNPJ (página /diagnostico-licitacoes/): uma parte por começo de CNPJ, de qualquer cidade
  const partes = montarDiagnosticos(cache, { nomeCidade });
  const pastaCnpj = `${SAIDA}/cnpj`;
  fs.rmSync(pastaCnpj, { recursive: true, force: true });
  fs.mkdirSync(pastaCnpj, { recursive: true });
  let empresasDiag = 0;
  for (const [k, parte] of partes) {
    fs.writeFileSync(`${pastaCnpj}/${k}.json`, JSON.stringify(parte));
    empresasDiag += Object.keys(parte.e).length;
  }
  fs.writeFileSync(
    `${pastaCnpj}/info.json`,
    JSON.stringify({
      atualizadoEm: comum.atualizadoEm,
      desde,
      ate: hoje,
      abrangencia: 'Minas Gerais',
      portal: PORTAL,
      empresas: empresasDiag,
      licitacoesLidas: metaClientes.licitacoesLidas,
      buscaFeita: comum.buscaFeita,
    }),
  );
  fs.rmSync(SAIDA_ANTIGA, { force: true });
  console.log(
    `Listas: ${metaClientes.licitacoesLidas} atas lidas de ${metaClientes.licitacoesNoPeriodo} licitações em Minas desde ${desde} ` +
      `(${metaClientes.aindaNaFila} na fila, ${metaClientes.aguardandoAta} esperando a ata; busca no PNCP ${comum.buscaFeita}% feita). ` +
      `Possíveis clientes: ${saida.empresas.length} empresas; Campeões (Zona da Mata): ${campeoes.resumo.empresas} empresas; ` +
      `diagnóstico por CNPJ: ${empresasDiag} empresas em ${partes.size} partes.`,
  );
  return { saida, campeoes };
}

async function main() {
  let cache = { v: VERSAO, compras: {}, cnpj: {} };
  try {
    const lido = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
    if (lido.v === VERSAO) cache = lido;
    // leitor de atas novo: as atas são lidas de novo, mas o que não depende dele (cadastro dos CNPJs e licitações já
    // descobertas) continua valendo
    else if (lido.v) cache = { v: VERSAO, compras: {}, cnpj: lido.cnpj || {}, achadas: lido.achadas || {}, mg: lido.mg || {} };
  } catch {
    /* primeira vez */
  }
  // marcas da busca antiga, só da Zona da Mata (município por município)
  delete cache.varridoEm;
  delete cache.buscaGrupo;
  cache.achadas ??= {};
  cache.tentouEm ??= {};
  const hoje = new Date().toISOString().slice(0, 10);
  const d = new Date();
  d.setMonth(d.getMonth() - MESES_CLIENTES);
  const desde = d.toISOString().slice(0, 10);
  // o que saiu do período sai do cache
  for (const k of Object.keys(cache.compras)) if (cache.compras[k].data < desde) delete cache.compras[k];
  for (const k of Object.keys(cache.achadas)) if (cache.achadas[k].data < desde) delete cache.achadas[k];
  for (const k of Object.keys(cache.tentouEm)) if (!cache.achadas[k] || cache.compras[k]) delete cache.tentouEm[k];
  if (SO_MONTAR) {
    // publicação do site: só remonta as listas com o que a leitura (workflow Prospecção) já guardou
    gravarListas(cache, desde, hoje);
    return;
  }

  let salvoEm = Date.now();
  const salvar = () => {
    fs.writeFileSync(CACHE, JSON.stringify(cache));
    salvoEm = Date.now();
  };

  // 3) cidade de cada CNPJ: duas consultas ao mesmo tempo, durante toda a execução, na ordem em que as atas vão sendo
  // lidas. Só interessa quem ficou até o 5º lugar (ou ofertou melhor e não levou): os outros não entram em lista nenhuma.
  const semCadastro = (cnpj) => {
    const c = cache.cnpj[cnpj];
    // "não encontrado" vale por 7 dias (as marcações antigas, sem data, são consultadas de novo)
    return !c || (c.x && (!c.em || (Date.parse(hoje) - Date.parse(c.em)) / 86400e3 >= 7));
  };
  const filaCnpj = [];
  const naFilaCnpj = new Set();
  const enfileirarCnpjs = (itens) => {
    for (const it of itens || [])
      for (const [cnpj, col] of it.c)
        if (col <= MAX_COLOCACAO && !naFilaCnpj.has(cnpj) && semCadastro(cnpj)) {
          naFilaCnpj.add(cnpj);
          filaCnpj.push(cnpj);
        }
  };
  for (const c of Object.values(cache.compras).sort(ordemDeLeitura)) enfileirarCnpjs(c.itens);
  let lendo = true;
  let consultados = 0;
  const consultasCnpj = [FONTES_CNPJ, [...FONTES_CNPJ].reverse()].map(async (fontes) => {
    while (restam() > 20e3) {
      if (!filaCnpj.length) {
        if (!lendo) break;
        await sleep(2e3);
        continue;
      }
      const cnpj = filaCnpj.shift();
      const r = await cadastro(cnpj, hoje, fontes);
      if (r) {
        cache.cnpj[cnpj] = r;
        consultados++;
      }
      await sleep(300);
    }
  });

  // 1) busca em Minas inteira, ao mesmo tempo que 2) a leitura das atas (que vai pegando o que a busca acha)
  let buscando = true;
  let vistasAgora = 0;
  const busca = buscarEmMinas(desde, hoje, cache, (novas) => {
    for (const [k, c] of novas) if (c.data >= desde) cache.achadas[k] = c;
    vistasAgora += novas.size;
  }).finally(() => {
    buscando = false;
  });

  const filaDeAtas = () =>
    Object.entries(cache.achadas)
      .filter(([k, c]) => (!cache.compras[k] || (cache.compras[k].parcial && cache.compras[k].lidoEm < hoje)) && !esperando(k, c, cache, hoje))
      .sort((a, b) => ordemDeLeitura(a[1], b[1]));
  const tentadas = new Set();
  let lidas = 0;
  let falhas = 0;
  const leitura = (async () => {
    while (restam() > 90e3) {
      // de 25 em 25: o que a busca acabou de achar perto das cidades escolhidas passa na frente
      const lote = filaDeAtas()
        .filter(([k]) => !tentadas.has(k))
        .slice(0, 25);
      if (!lote.length) {
        if (!buscando) break;
        await sleep(5e3);
        continue;
      }
      for (const [k, c] of lote) {
        if (restam() < 90e3) break;
        tentadas.add(k);
        try {
          const r = await lerCompra(c, hoje);
          if (r) {
            cache.compras[k] = { ...c, ...r, lidoEm: hoje };
            delete cache.tentouEm[k];
            lidas++;
            enfileirarCnpjs(r.itens);
          } else cache.tentouEm[k] = hoje;
        } catch (e) {
          // erro do PNCP (fora do ar, licitação apagada): volta mais tarde, como a que ainda não tem ata
          cache.tentouEm[k] = hoje;
          falhas++;
          if (falhas <= 5) console.log(`  ${k}: ${e.message}`);
        }
      }
      // de 10 em 10 minutos o que já foi feito vai para o arquivo (se a execução cair, não se perde tudo)
      if (Date.now() - salvoEm > 10 * 60e3) salvar();
    }
  })();

  const resultadoBusca = await busca;
  await leitura;
  lendo = false;
  await Promise.all(consultasCnpj);

  console.log(
    `${Object.keys(cache.achadas).length} licitações do ${PORTAL} em Minas desde ${desde} (${vistasAgora} vistas agora). ` +
      `Busca no PNCP: ${resultadoBusca.feitas} quinzenas feitas agora, ${resultadoBusca.faltam} para as próximas` +
      (resultadoBusca.falhas.length ? `; com falha: ${resultadoBusca.falhas.slice(0, 8).join(', ')}${resultadoBusca.falhas.length > 8 ? '…' : ''}` : '') +
      '.',
  );
  if (!Object.keys(cache.achadas).length && !Object.keys(cache.compras).length) throw new Error('O PNCP não trouxe nenhuma licitação');

  // aviso no Telegram: empresas das cidades escolhidas que acabaram de perder por pouco ou com o melhor preço
  try {
    cache.avisados ??= {};
    const novas = oportunidades(cache, CIDADES_CLIENTES, { hoje, avisados: cache.avisados, naZonaDaMata });
    if (novas.length) {
      await telegram(mensagemOportunidades(novas));
      for (const g of novas) cache.avisados[g.chave] = hoje;
      console.log(`Aviso de oportunidade no Telegram: ${novas.length} empresa(s) e licitação(ões).`);
    }
    // avisos com mais de 120 dias já não voltam (a licitação saiu da janela de 60 dias)
    const limite = diasAntes(hoje, 120);
    for (const [k, dia] of Object.entries(cache.avisados)) if (dia < limite) delete cache.avisados[k];
  } catch (e) {
    console.log(`Aviso de oportunidade não enviado: ${e.message}`);
  }
  salvar();

  // saída
  const { saida, campeoes } = gravarListas(cache, desde, hoje);
  const comAta = Object.values(cache.compras).filter((c) => c.itens);
  console.log(
    `Lidas agora: ${lidas} atas (${falhas} falhas); no total ${comAta.length} com ata. CNPJs consultados agora: ${consultados}; sem cidade ainda: ${filaCnpj.length}. ` +
      `Possíveis clientes (${CIDADES_CLIENTES.length} cidades): ${saida.empresas.length} empresas, ${saida.resumo.disputas} itens. ` +
      `Campeões: ${campeoes.resumo.empresas} empresas, ${campeoes.resumo.itens} itens. ${Math.round((Date.now() - t0) / 1000)} s.`,
  );
  if (Object.keys(respostasCnpj).length) console.log(`Respostas das fontes de CNPJ: ${JSON.stringify(respostasCnpj)}`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) await main();
