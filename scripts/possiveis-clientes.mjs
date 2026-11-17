// Abas "Possíveis clientes" e "Campeões" das Licitações (públicas):
//   Possíveis clientes  empresas das cidades vizinhas (src/data/clientesConfig.js) que disputaram licitações da Zona da
//                       Mata e ficaram do 2º ao 5º lugar (ou ofertaram o melhor preço e não levaram), item a item;
//   Campeões            quem ganhou e levou cada item, de qualquer cidade, com o valor ganho segundo a ata.
//
// De onde vem: o PNCP só registra o vencedor de cada item. A classificação completa está na "Ata Final" que o Portal
// de Compras Públicas anexa no PNCP depois da sessão (todas as propostas e lances, com CNPJ). Este script:
//   1) procura no PNCP as licitações eletrônicas da Zona da Mata dos últimos meses publicadas por esse portal;
//   2) baixa a ata de cada uma (documento público do PNCP), lê os lances e calcula a colocação por item;
//   3) consulta a cidade de cada CNPJ no cadastro público da Receita (BrasilAPI, minhareceita.org e publica.cnpj.ws);
//   4) grava public/prospeccao/clientes.json e public/prospeccao/campeoes.json.
// Compras.gov.br, Licitar Digital e outros portais não anexam a ata no PNCP: essas licitações ficam de fora.
// CPF não entra (pessoa física fica de fora) e nomes de MEI saem sem os números do CPF.
//
// O que já foi lido fica em clientes-cache.json (cache do Actions). Cada execução trabalha alguns minutos
// (CLIENTES_TEMPO_MIN, padrão 8) e continua na próxima.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { CIDADES_CLIENTES, MESES_CLIENTES } from '../src/data/clientesConfig.js';
import { CIDADES_MG } from '../src/data/coordenadasMunicipios.js';
import { PNCP_MUNICIPIOS_ZM } from '../src/data/pncpMunicipiosZM.js';
import { MICRORREGIOES, microrregiaoDe } from '../src/data/zonaDaMata.js';
import { classificarItem, descricaoCurta, ehAtaPcp, lerAtaPcp } from '../src/lib/ataPcp.js';
import { montarCampeoes, montarClientes, nomeSemCpf, normCidade } from '../src/lib/possiveisClientes.js';
import { fetchJson, fixText, fonteDe } from '../src/lib/pncp.js';
import { linhasDoPdf } from '../src/lib/privado/pdfTexto.js';

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
const MODALIDADES = /preg[aã]o - eletr|dispensa|concorr[eê]ncia - eletr/i;
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
/** Municípios mais perto das cidades escolhidas vêm primeiro: as próprias cidades, depois a microrregião delas */
const ALVO = new Set(CIDADES_CLIENTES.map((c) => chaveMun(c.nome)));
const MICROS_PERTO = new Set(CIDADES_CLIENTES.map((c) => microrregiaoDe(c.nome)).filter(Boolean));
const prioridade = (municipio) => (ALVO.has(chaveMun(municipio)) ? 0 : MICROS_PERTO.has(microrregiaoDe(municipio)) ? 1 : 2);

/**
 * Caminho 1: a busca do PNCP, com os municípios da Zona da Mata em grupos (poucas páginas por grupo).
 * Cada execução varre os grupos há mais tempo sem varredura e anota a data (cache.buscaGrupo); nas seguintes só
 * precisa ir até pouco antes dessa data. Devolve `falhou` quando a busca do PNCP cai, o que é frequente.
 */
async function descobrirPelaBusca(desde, hoje, cache) {
  const cods = Object.values(PNCP_MUNICIPIOS_ZM);
  const achadas = new Map();
  cache.buscaGrupo ??= {};
  const grupos = [];
  for (let i = 0; i < cods.length; i += 24) grupos.push(i);
  grupos.sort((a, b) => String(cache.buscaGrupo[a] || '').localeCompare(String(cache.buscaGrupo[b] || '')));
  let falhou = false;
  for (const i of grupos) {
    if (restam() < TEMPO_MS * 0.65) break; // o resto fica para a próxima execução
    const feito = cache.buscaGrupo[i];
    const antes = feito ? new Date(Date.parse(feito) - 10 * 86400e3).toISOString().slice(0, 10) : desde;
    const corte = antes > desde ? antes : desde;
    let ok = true;
    for (let pagina = 1; pagina <= 100; pagina++) {
      const p = new URLSearchParams({
        q: '',
        tipos_documento: 'edital',
        ordenacao: '-data',
        pagina: String(pagina),
        tam_pagina: '100',
        ufs: 'MG',
        status: 'todos',
      });
      p.set('municipios', cods.slice(i, i + 24).join('|'));
      let d;
      try {
        d = await fetchJson(`https://pncp.gov.br/api/search/?${p}`, { retries: 2, timeout: 30000 });
      } catch {
        ok = false;
        break;
      }
      const itens = d?.items || [];
      for (const it of itens) {
        const m = String(it.item_url || '').match(/(\d{14})\/(\d{4})\/(\d+)/);
        if (!m || it.cancelado || String(it.data_publicacao_pncp || '') < desde) continue;
        if (fonteDe(it) !== PORTAL || !MODALIDADES.test(it.modalidade_licitacao_nome || '')) continue;
        achadas.set(`${m[1]}/${m[2]}/${m[3]}`, {
          cnpj: m[1],
          ano: m[2],
          seq: m[3],
          orgao: fixText(it.orgao_nome),
          municipio: fixText(it.municipio_nome),
          uf: it.uf,
          titulo: fixText(it.title),
          objeto: fixText(it.description),
          modalidade: it.modalidade_licitacao_nome,
          data: String(it.data_publicacao_pncp || '').slice(0, 10),
        });
      }
      // ordenado do mais novo para o mais antigo: quando a página inteira é mais velha que o corte, acabou
      if (itens.length < 100 || itens.every((it) => String(it.data_publicacao_pncp || '') < corte)) break;
      await sleep(400);
    }
    if (!ok) {
      falhou = true;
      break;
    }
    cache.buscaGrupo[i] = hoje;
  }
  return { achadas, falhou };
}

/**
 * Caminho 2 (quando a busca falha): a consulta oficial do PNCP, município por município, começando pelos mais
 * próximos das cidades escolhidas. Cada execução olha alguns municípios e anota até onde foi (cache.varridoEm).
 */
/** Municípios da Zona da Mata em ordem de prioridade (perto das cidades escolhidas primeiro; depois os há mais tempo sem consulta) */
function municipiosEmOrdem(cache) {
  cache.varridoEm ??= {};
  return Object.values(MICRORREGIOES)
    .flat()
    .filter((m) => IBGE.has(chaveMun(m)))
    .sort((a, b) => prioridade(a) - prioridade(b) || String(cache.varridoEm[a] || '').localeCompare(String(cache.varridoEm[b] || '')));
}

const ymd = (iso) => iso.replace(/-/g, '');

// A consulta do PNCP responde 429 ("muitas consultas") quando os pedidos vêm em paralelo: um pedido por vez, com pelo
// menos 1 s entre eles, e, no 429, espera de 20 s, 40 s e 60 s antes de tentar de novo.
let ultimoPedido = 0;
let filaPncp = Promise.resolve();
function consultaPncp(url) {
  const vez = filaPncp.then(async () => {
    for (let t = 0; ; t++) {
      const espera = ultimoPedido + 1000 - Date.now();
      if (espera > 0) await sleep(espera);
      ultimoPedido = Date.now();
      try {
        return await fetchJson(url, { retries: 1, timeout: 30000 });
      } catch (e) {
        if (e.status !== 429 || t >= 3 || restam() < 120e3) throw e;
        await sleep(20e3 * (t + 1));
      }
    }
  });
  filaPncp = vez.catch(() => null);
  return vez;
}
/**
 * Caminho 2 (quando a busca falha): a consulta oficial do PNCP de um município. Na primeira vez, o período inteiro
 * (em duas metades); depois, só os últimos 60 dias. Anota a data em cache.varridoEm quando vai até o fim.
 */
async function varrerMunicipio(mun, desde, hoje, cache, achadas) {
  // primeira vez: o período inteiro (em duas metades); depois, só os últimos 60 dias
  const ini = cache.varridoEm[mun] ? new Date(Date.parse(hoje) - 60 * 86400e3).toISOString().slice(0, 10) : desde;
  const meio = new Date((Date.parse(ini) + Date.parse(hoje)) / 2).toISOString().slice(0, 10);
  const janelas = cache.varridoEm[mun]
    ? [[ini, hoje]]
    : [
        [ini, meio],
        [meio, hoje],
      ];
  let ok = true;
  let motivo = '';
  for (const mod of [6, 8, 4]) {
    for (const [de, ate] of janelas) {
      for (let pagina = 1; pagina <= 60; pagina++) {
        let d;
        try {
          d = await consultaPncp(
            `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=${ymd(de)}&dataFinal=${ymd(ate)}&codigoModalidadeContratacao=${mod}&uf=MG&codigoMunicipioIbge=${IBGE.get(chaveMun(mun))}&pagina=${pagina}&tamanhoPagina=50`,
            { retries: 2, timeout: 30000 },
          );
        } catch (e) {
          ok = false;
          motivo = e.message || 'erro';
          break;
        }
        for (const c of d?.data || []) {
          if (fonteDe({ usuario_nome: c.usuarioNome, link_sistema_origem: c.linkSistemaOrigem }) !== PORTAL) continue;
          const cnpj = c.orgaoEntidade?.cnpj;
          if (!cnpj) continue;
          achadas.set(`${cnpj}/${c.anoCompra}/${c.sequencialCompra}`, {
            cnpj,
            ano: String(c.anoCompra),
            seq: String(c.sequencialCompra),
            orgao: fixText(c.orgaoEntidade?.razaoSocial),
            municipio: fixText(c.unidadeOrgao?.municipioNome || mun),
            uf: c.unidadeOrgao?.ufSigla || 'MG',
            titulo: /^\d+$/.test(String(c.numeroCompra || ''))
              ? `Edital nº ${c.numeroCompra}/${c.anoCompra}`
              : fixText(c.numeroCompra) || `Compra ${c.sequencialCompra}/${c.anoCompra}`,
            objeto: fixText(c.objetoCompra),
            modalidade: c.modalidadeNome,
            data: String(c.dataPublicacaoPncp || '').slice(0, 10),
          });
        }
        if (!d || pagina >= (d.totalPaginas || 1)) break;
      }
    }
  }
  if (ok) cache.varridoEm[mun] = hoje;
  return ok ? '' : motivo;
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
 * Cidade, porte e atividade de um CNPJ no cadastro público da Receita. Pergunta à BrasilAPI e, se ela não achar ou
 * estiver fora, ao minhareceita.org (os dois devolvem o mesmo formato). Os dois às vezes respondem "não encontrado"
 * para CNPJs que existem: um CNPJ que nenhum dos dois achou fica marcado com a data e é consultado de novo em 7 dias.
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

export async function cadastro(cnpj, hoje) {
  let naoAchou = 0;
  for (const base of FONTES_CNPJ) {
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
  return ws === false || (ws === undefined && naoAchou === FONTES_CNPJ.length) ? { x: 1, em: hoje } : null;
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

/** O município já passou pela busca do PNCP (feita em grupos de 24 códigos de município)? */
const indiceNaBusca = new Map(Object.keys(PNCP_MUNICIPIOS_ZM).map((nome, i) => [chaveMun(nome), i]));
function grupoDaBuscaFeito(cache, mun) {
  const i = indiceNaBusca.get(chaveMun(mun));
  return i != null && !!cache.buscaGrupo?.[Math.floor(i / 24) * 24];
}

/** Grava as duas listas (com o nome de cada cidade de Minas com acento: a Receita escreve sem) */
function gravarListas(cache, m) {
  const municipiosZM = Object.values(MICRORREGIOES).flat();
  const meta = {
    atualizadoEm: new Date().toISOString(),
    desde: m.desde,
    ate: m.ate,
    portal: PORTAL,
    licitacoesNoPeriodo: m.licitacoesNoPeriodo,
    licitacoesLidas: Object.values(cache.compras).filter((c) => c.itens).length,
    aindaNaFila: m.aindaNaFila,
    cnpjsSemCidade: m.cnpjsSemCidade,
    // municípios da Zona da Mata já consultados no PNCP (a primeira volta leva algumas leituras)
    municipiosConsultados: municipiosZM.filter((mun) => cache.varridoEm?.[mun] || grupoDaBuscaFeito(cache, mun)).length,
    municipiosTotal: municipiosZM.length,
  };
  const cidadesMG = new Map(CIDADES_MG.map(([nome]) => [normCidade(nome), nome]));
  const nomeCidade = (mun, u) =>
    (u === 'MG' && cidadesMG.get(normCidade(mun))) ||
    String(mun || '')
      .toLowerCase()
      .replace(/(^|\s)(\S)/g, (x) => x.toUpperCase())
      .replace(/ (De|Da|Do|Das|Dos|E) /g, (x) => x.toLowerCase());
  const saida = montarClientes(cache, CIDADES_CLIENTES, meta);
  const campeoes = montarCampeoes(cache, CIDADES_CLIENTES, meta, { nomeCidade });
  fs.mkdirSync(SAIDA, { recursive: true });
  fs.writeFileSync(`${SAIDA}/clientes.json`, JSON.stringify(saida));
  fs.writeFileSync(`${SAIDA}/campeoes.json`, JSON.stringify(campeoes));
  fs.rmSync(SAIDA_ANTIGA, { force: true });
  console.log(
    `Listas: ${meta.licitacoesLidas} atas lidas de ${meta.licitacoesNoPeriodo} licitações desde ${m.desde} (${meta.municipiosConsultados} de ${meta.municipiosTotal} municípios consultados). ` +
      `Possíveis clientes: ${saida.empresas.length} empresas; Campeões: ${campeoes.resumo.empresas} empresas.`,
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
    else if (lido.v)
      cache = {
        v: VERSAO,
        compras: {},
        cnpj: lido.cnpj || {},
        achadas: lido.achadas || {},
        varridoEm: lido.varridoEm || {},
        buscaGrupo: lido.buscaGrupo || {},
      };
  } catch {
    /* primeira vez */
  }
  const hoje = new Date().toISOString().slice(0, 10);
  const d = new Date();
  d.setMonth(d.getMonth() - MESES_CLIENTES);
  const desde = d.toISOString().slice(0, 10);
  if (SO_MONTAR) {
    // publicação do site: só remonta as listas com o que a leitura (workflow Prospecção) já guardou
    for (const k of Object.keys(cache.compras)) if (cache.compras[k].data < desde) delete cache.compras[k];
    const achadas = Object.fromEntries(Object.entries(cache.achadas || {}).filter(([, c]) => c.data >= desde));
    gravarListas(cache, {
      desde,
      ate: hoje,
      licitacoesNoPeriodo: Object.keys(achadas).length,
      aindaNaFila: Object.keys(achadas).filter((k) => !cache.compras[k]).length,
      cnpjsSemCidade: null,
    });
    return;
  }

  // licitações do portal: o que já se conhecia + o que a busca do PNCP trouxer agora
  cache.achadas ??= {};
  for (const k of Object.keys(cache.achadas)) if (cache.achadas[k].data < desde) delete cache.achadas[k];
  const busca = await descobrirPelaBusca(desde, hoje, cache);
  for (const [k, c] of busca.achadas) cache.achadas[k] = c;
  let vistasAgora = busca.achadas.size;
  if (busca.falhou) console.log(`A busca do PNCP falhou (${busca.achadas.size} achadas antes da falha): usando a consulta por município.`);

  /** quantos CNPJs ainda sem cidade (para em 51: só importa se são muitos) */
  const cnpjsSemCidade = () => {
    let n = 0;
    for (const c of Object.values(cache.compras))
      for (const it of c.itens || []) for (const e of it.c) if (!cache.cnpj[e[0]] || (cache.cnpj[e[0]].x && !cache.cnpj[e[0]].em)) if (++n > 50) return n;
    return n;
  };
  // tempo guardado para consultar a cidade dos CNPJs no fim (mais, se forem muitos)
  const reserva = () => {
    const n = cnpjsSemCidade();
    return Math.max(50e3, n > 50 ? TEMPO_MS * 0.25 : n ? TEMPO_MS * 0.1 : 0);
  };
  const filaDeAtas = () =>
    Object.entries(cache.achadas)
      .filter(([k]) => !cache.compras[k] || (cache.compras[k].parcial && cache.compras[k].lidoEm < hoje))
      .sort((a, b) => prioridade(a[1].municipio) - prioridade(b[1].municipio) || b[1].data.localeCompare(a[1].data));
  const tentadas = new Set(); // atas sem novidade nesta execução (ainda não publicadas): não tenta de novo
  const munTentados = new Set();
  const munFalhas = [];
  let lidas = 0;
  let falhas = 0;
  // 1) ler as atas da fila; 2) procurar mais licitações em alguns municípios (um pedido por vez); repete até acabar o tempo
  // ou não haver mais o que fazer hoje
  for (;;) {
    for (const [k, c] of filaDeAtas()) {
      if (restam() < reserva()) break;
      if (tentadas.has(k)) continue;
      tentadas.add(k);
      try {
        const r = await lerCompra(c, hoje);
        if (r) {
          cache.compras[k] = { ...c, ...r, lidoEm: hoje };
          lidas++;
        }
      } catch (e) {
        falhas++;
        if (falhas <= 5) console.log(`  ${k}: ${e.message}`);
      }
    }
    if (!busca.falhou || restam() < reserva()) break;
    // cada município uma vez por execução: um que falhou não volta para o começo da fila e não trava os outros
    const lote = municipiosEmOrdem(cache)
      .filter((m) => cache.varridoEm[m] !== hoje && !munTentados.has(m))
      .slice(0, 9);
    if (!lote.length) break;
    const novas = new Map();
    const fila = [...lote];
    await Promise.all(
      [0].map(async () => {
        while (fila.length && restam() > reserva() + 60e3) {
          const mun = fila.shift();
          munTentados.add(mun);
          const falha = await varrerMunicipio(mun, desde, hoje, cache, novas);
          if (falha) munFalhas.push(`${mun} (${falha})`);
        }
      }),
    );
    for (const [k, c] of novas) if (c.data >= desde) cache.achadas[k] = c;
    vistasAgora += novas.size;
    if (fila.length) break; // o tempo acabou no meio do lote
  }
  const achadas = new Map(Object.entries(cache.achadas));
  const naFila = filaDeAtas().length;
  console.log(`${achadas.size} licitações do ${PORTAL} na Zona da Mata desde ${desde} (${vistasAgora} vistas agora).`);
  if (munTentados.size)
    console.log(
      `Municípios consultados agora: ${munTentados.size - munFalhas.length} de ${munTentados.size}` +
        (munFalhas.length ? `; com falha (ficam para a próxima): ${munFalhas.slice(0, 12).join(', ')}${munFalhas.length > 12 ? '…' : ''}` : '.'),
    );
  if (!achadas.size && !Object.keys(cache.compras).length) throw new Error('O PNCP não trouxe nenhuma licitação');
  // o que saiu do período sai do cache
  for (const k of Object.keys(cache.compras)) if (cache.compras[k].data < desde) delete cache.compras[k];

  // 2) cidade de cada CNPJ (cadastro público da Receita)
  const faltam = new Set();
  // "não encontrado" vale por 7 dias (as marcações antigas, sem data, são consultadas de novo)
  const semCadastro = (cnpj) => {
    const c = cache.cnpj[cnpj];
    return !c || (c.x && (!c.em || (Date.parse(hoje) - Date.parse(c.em)) / 86400e3 >= 7));
  };
  for (const c of Object.values(cache.compras)) for (const it of c.itens || []) for (const e of it.c) if (semCadastro(e[0])) faltam.add(e[0]);
  let consultados = 0;
  const pendentes = [...faltam];
  await Promise.all(
    [0, 1].map(async () => {
      while (pendentes.length && restam() > 20e3) {
        const cnpj = pendentes.pop();
        const r = await cadastro(cnpj, hoje);
        if (r) {
          cache.cnpj[cnpj] = r;
          consultados++;
        }
        await sleep(350);
      }
    }),
  );
  fs.writeFileSync(CACHE, JSON.stringify(cache));

  // 3) saída
  const { saida, campeoes } = gravarListas(cache, {
    desde,
    ate: hoje,
    licitacoesNoPeriodo: achadas.size || Object.keys(cache.compras).length,
    aindaNaFila: naFila,
    cnpjsSemCidade: pendentes.length,
  });
  const comAta = Object.values(cache.compras).filter((c) => c.itens);
  const alvo = new Set(CIDADES_CLIENTES.map((c) => `${normCidade(c.nome)}|${c.uf}`));
  console.log(
    `Lidas agora: ${lidas} atas (${falhas} falhas); no total ${comAta.length} com ata, ${naFila} na fila. CNPJs consultados agora: ${consultados}; sem cidade ainda: ${pendentes.length}. ` +
      `Possíveis clientes (${alvo.size} cidades): ${saida.empresas.length} empresas, ${saida.resumo.disputas} itens. ` +
      `Campeões: ${campeoes.resumo.empresas} empresas, ${campeoes.resumo.itens} itens. ${Math.round((Date.now() - t0) / 1000)} s.`,
  );
  if (Object.keys(respostasCnpj).length) console.log(`Respostas das fontes de CNPJ: ${JSON.stringify(respostasCnpj)}`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) await main();
