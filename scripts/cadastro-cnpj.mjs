// Consulta CNPJ (aba das Licitações, só da equipe): o cadastro das empresas ativas das cidades escolhidas
// (src/data/clientesConfig.js), tirado do cnpj.db (cadastro de CNPJ da Receita em SQLite, ~28 GB) que está no Google
// Drive. O arquivo não é baixado inteiro: é lido em sequência pelo link do Drive, página por página
// (src/lib/sqliteFolhas.js), e só fica o que interessa.
//
//   node scripts/cadastro-cnpj.mjs              extrai e grava cadastro-cnpj.json.gz (guardado no cache do Actions)
//   node scripts/cadastro-cnpj.mjs --publicar   junta o histórico em licitações (clientes-cache.json) e grava
//                                               public/prospeccao/cadastro.bin, cifrado com a senha do Privado
//
// O arquivo tem, nesta ordem: empresas, estabelecimentos, sócios, Simples/MEI e os índices. A extração acha onde cada
// parte começa (sondando algumas páginas), lê os estabelecimentos e o Simples (1ª passada) e depois as empresas das
// que ficaram (2ª passada). Sócios (pessoas físicas) não são lidos.
// Variáveis: CNPJ_DB_ID (id do arquivo no Drive; padrão abaixo), CADASTRO_SAIDA, PRIVADO_SENHA (para --publicar),
// CADASTRO_SO_SONDAR=1 (só acha as partes do arquivo e os códigos das cidades, sem varrer).
import fs from 'node:fs';
import zlib from 'node:zlib';
import { CIDADES_CLIENTES } from '../src/data/clientesConfig.js';
import { chaveDaSenha, cifrar } from '../src/lib/cofre.js';
import { lerTabela, linhasDaPagina, PAGINA, tamanhoDaPagina } from '../src/lib/sqliteFolhas.js';
import { nomeSemCpf } from '../src/lib/possiveisClientes.js';

/** cnpj.db no Drive de Allan, compartilhado por link (dados abertos da Receita Federal) */
export const ARQUIVO_PADRAO = '1tIJNbYa3PEoORTYI2K2A5y5CJqt8r0na';
const ID = process.env.CNPJ_DB_ID || ARQUIVO_PADRAO;
/** Endereço de download de um arquivo do Drive compartilhado por link */
export const urlDoArquivo = (id) => `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
const URL_ARQ = urlDoArquivo(ID);
const SAIDA = process.env.CADASTRO_SAIDA || 'cadastro-cnpj.json.gz';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const semAcento = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace('EUZEBIA', 'EUSEBIA');

// ---------------------------------------------------------------- leitura pelo Drive

/** Um trecho do arquivo (bytes de..até, inclusive) */
export async function trecho(de, ate, url = URL_ARQ) {
  for (let t = 0; ; t++) {
    try {
      const r = await fetch(url, { headers: { Range: `bytes=${de}-${ate}` }, signal: AbortSignal.timeout(120e3) });
      if (r.status !== 206 && r.status !== 200) throw new Error(`Drive respondeu ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    } catch (e) {
      if (t >= 5) throw e;
      await sleep(3000 * (t + 1));
    }
  }
}

/**
 * Lê as páginas [de, ate) em sequência e entrega cada uma a `cada(numero, bytes)`. Se a conexão cair, continua de onde
 * parou (pedido com Range a partir da página seguinte).
 */
export async function varrer(T, de, ate, cada, rotulo, url = URL_ARQ) {
  let proxima = de;
  let tentativas = 0;
  const t0 = Date.now();
  let avisoEm = Date.now();
  while (proxima < ate) {
    try {
      const r = await fetch(url, { headers: { Range: `bytes=${(proxima - 1) * T}-${(ate - 1) * T - 1}` } });
      if (r.status !== 206) throw new Error(`Drive respondeu ${r.status}`);
      const leitor = r.body.getReader();
      let resto = new Uint8Array(0);
      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        let buf = value;
        if (resto.length) {
          buf = new Uint8Array(resto.length + value.length);
          buf.set(resto);
          buf.set(value, resto.length);
        }
        let p = 0;
        while (buf.length - p >= T) {
          cada(proxima, buf.subarray(p, p + T));
          proxima++;
          p += T;
        }
        resto = buf.slice(p);
        if (Date.now() - avisoEm > 60e3) {
          avisoEm = Date.now();
          const gb = ((proxima - de) * T) / 1e9;
          console.log(
            `  ${rotulo}: ${gb.toFixed(1)} de ${(((ate - de) * T) / 1e9).toFixed(1)} GB (${Math.round((gb * 1e3) / ((Date.now() - t0) / 1e3))} MB/s)`,
          );
        }
      }
      tentativas = 0;
    } catch (e) {
      if (++tentativas > 8) throw e;
      console.log(`  ${rotulo}: a conexão caiu na página ${proxima} (${e.message}); continuando`);
      await sleep(5000 * tentativas);
    }
  }
  console.log(`  ${rotulo}: ${(((ate - de) * T) / 1e9).toFixed(1)} GB em ${Math.round((Date.now() - t0) / 1e3)} s`);
}

// ---------------------------------------------------------------- reconhecimento das tabelas

/** De qual tabela é a linha (pelo número de colunas e pelo conteúdo) */
export function tabelaDaLinha(v) {
  const n = v.length;
  if (n >= 25) return 'estabelecimento';
  if (n === 11) return 'socios';
  if (n === 7 || n === 8) return typeof v[1] === 'string' && v[1].length <= 1 ? 'simples' : 'empresas';
  if (n === 2) return 'dicionario';
  return '';
}
export const ORDEM = { empresas: 0, estabelecimento: 1, socios: 2, simples: 3, indice: 4 };

/** Colunas de uma tabela, pelo CREATE TABLE */
export function colunas(sql) {
  const dentro = String(sql).slice(String(sql).indexOf('(') + 1, String(sql).lastIndexOf(')'));
  return dentro
    .split(',')
    .map((c) =>
      c
        .trim()
        .split(/\s+/)[0]
        .replace(/["`[\]]/g, ''),
    )
    .filter(Boolean);
}

/**
 * Uma linha de estabelecimento da cidade escolhida, no formato que vai para o site.
 * @param {Record<string, number>} col  nome da coluna → posição
 */
export function estabelecimento(v, col) {
  const g = (nome) => {
    const x = v[col[nome]];
    return x == null ? '' : String(x).trim();
  };
  const tel = (ddd, n) => {
    const d = `${g(ddd)}${g(n)}`.replace(/\D/g, '');
    return d.length >= 10 ? d : '';
  };
  return {
    cnpj: `${g('cnpj_basico')}${g('cnpj_ordem')}${g('cnpj_dv')}`,
    matriz: g('matriz_filial') === '1',
    fantasia: nomeSemCpf(g('nome_fantasia')),
    abertura: g('data_inicio_atividades'),
    cnae: g('cnae_fiscal'),
    cnaes: g('cnae_fiscal_secundaria')
      .split(/[,;\s]+/)
      .filter((x) => /^\d{7}$/.test(x)),
    endereco: [[g('tipo_logradouro'), g('logradouro')].filter(Boolean).join(' '), g('numero'), g('complemento')].filter(Boolean).join(', '),
    bairro: g('bairro'),
    cep: g('cep'),
    municipio: g('municipio'),
    uf: g('uf'),
    tel1: tel('ddd1', 'telefone1'),
    tel2: tel('ddd2', 'telefone2'),
    email: g('correio_eletronico').toLowerCase(),
  };
}

/** Data AAAAMMDD → AAAA-MM-DD */
const data = (s) => (/^\d{8}$/.test(s) && !s.startsWith('0000') ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : '');

// ---------------------------------------------------------------- extração

async function extrair() {
  const t0 = Date.now();
  const inicio = await trecho(0, 1024 * 1024 - 1);
  const T = tamanhoDaPagina(inicio);
  const cacheP = new Map();
  const pagina = async (n) => {
    if (n * T <= inicio.length) return inicio.subarray((n - 1) * T, n * T);
    if (!cacheP.has(n)) cacheP.set(n, await trecho((n - 1) * T, n * T - 1));
    return cacheP.get(n);
  };
  const mestre = (await lerTabela(pagina, 1)).map((l) => ({ tipo: l.valores[0], nome: l.valores[1], raiz: l.valores[3], sql: l.valores[4] }));
  const tabela = (nome) => mestre.find((m) => m.tipo === 'table' && m.nome === nome);
  for (const t of ['estabelecimento', 'empresas', 'simples', 'municipio', 'cnae']) if (!tabela(t)) throw new Error(`O arquivo não tem a tabela ${t}`);
  const posicao = (nome) => Object.fromEntries(colunas(tabela(nome).sql).map((c, i) => [c, i]));
  const colEst = posicao('estabelecimento');
  const colEmp = posicao('empresas');
  const colSim = posicao('simples');

  // dicionários pequenos (no começo do arquivo)
  const dic = async (nome) =>
    new Map((await lerTabela(pagina, tabela(nome).raiz)).map((l) => [String(l.valores[0]).trim(), String(l.valores[1] || '').trim()]));
  const municipios = await dic('municipio');
  const cnaes = await dic('cnae');
  const naturezas = tabela('natureza_juridica') ? await dic('natureza_juridica') : new Map();
  const alvo = new Map(); // código da Receita → nome da cidade escolhida
  for (const c of CIDADES_CLIENTES)
    for (const [cod, nome] of municipios) if (semAcento(nome) === semAcento(c.nome)) alvo.set(cod.replace(/^0+/, ''), { nome: c.nome, uf: c.uf });
  const faltando = CIDADES_CLIENTES.filter((c) => ![...alvo.values()].some((a) => a.nome === c.nome));
  console.log(`Arquivo: páginas de ${T} bytes; ${municipios.size} municípios, ${cnaes.size} atividades. Cidades: ${alvo.size} códigos.`);
  if (faltando.length) console.log(`::warning::Cidades sem código na Receita: ${faltando.map((c) => c.nome).join(', ')}`);

  // onde começa cada parte: sondagem (busca binária) pela ordem empresas < estabelecimentos < sócios < Simples < índices
  const tamArq = Number((await fetch(URL_ARQ, { headers: { Range: 'bytes=0-0' } })).headers.get('content-range')?.split('/')[1]);
  const total = Math.floor(tamArq / T);
  const ordemDa = async (n) => {
    for (let k = 0; k < 40 && n + k <= total; k++) {
      const b = await pagina(n + k);
      if (b[0] === PAGINA.INDICE_FOLHA || b[0] === PAGINA.INDICE_INTERNA) return ORDEM.indice;
      const r = linhasDaPagina(b);
      const t = r.linhas.length ? tabelaDaLinha(r.linhas[0].valores) : '';
      if (t in ORDEM) return ORDEM[t];
    }
    return ORDEM.indice;
  };
  const primeiraCom = async (ordem, de, ate) => {
    while (ate - de > 64) {
      const meio = Math.floor((de + ate) / 2);
      if ((await ordemDa(meio)) >= ordem) ate = meio;
      else de = meio;
    }
    return de;
  };
  const inicioEst = await primeiraCom(ORDEM.estabelecimento, 101, total);
  const inicioIdx = await primeiraCom(ORDEM.indice, inicioEst, total);
  console.log(`Códigos das cidades: ${JSON.stringify(Object.fromEntries([...alvo].map(([k, v]) => [k, v.nome])))}`);
  const MARGEM = 4096; // 16 MB antes de cada parte, por segurança (cada página é reconhecida de novo na leitura)
  console.log(
    `Partes: estabelecimentos a partir de ${((inicioEst * T) / 1e9).toFixed(1)} GB, índices a partir de ${((inicioIdx * T) / 1e9).toFixed(1)} GB (arquivo de ${(tamArq / 1e9).toFixed(1)} GB).`,
  );

  if (process.env.CADASTRO_SO_SONDAR === '1') return;

  // 1ª passada: estabelecimentos ativos das cidades escolhidas (e o Simples/MEI de cada um)
  const est = new Map();
  const basicos = new Set();
  const simples = new Map();
  let grandes = 0;
  await varrer(
    T,
    Math.max(101, inicioEst - MARGEM),
    // a sondagem para até 64 páginas antes de onde os índices começam: lê um pouco além para não perder o fim do Simples
    Math.min(total + 1, inicioIdx + 129),
    (n, b) => {
      const r = linhasDaPagina(b);
      grandes += r.grandes;
      for (const { valores: v } of r.linhas) {
        const t = tabelaDaLinha(v);
        if (t === 'estabelecimento') {
          const mun = String(v[colEst.municipio] ?? '').replace(/^0+/, '');
          const a = alvo.get(mun);
          if (!a || String(v[colEst.uf] ?? '').trim() !== a.uf || Number(v[colEst.situacao_cadastral]) !== 2) continue;
          const e = estabelecimento(v, colEst);
          e.cidade = a.nome;
          est.set(e.cnpj, e);
          basicos.add(e.cnpj.slice(0, 8));
        } else if (t === 'simples') {
          const b8 = String(v[colSim.cnpj_basico] ?? '');
          if (basicos.has(b8))
            simples.set(b8, {
              simples: v[colSim.opcao_simples] === 'S',
              mei: v[colSim.opcao_mei] === 'S',
              meiDesde: data(String(v[colSim.data_opcao_mei] ?? '')),
            });
        }
      }
    },
    'estabelecimentos e Simples',
  );
  console.log(`Estabelecimentos ativos nas cidades: ${est.size} (${basicos.size} empresas); Simples/MEI: ${simples.size}; linhas grandes puladas: ${grandes}.`);

  // 2ª passada: a empresa (razão social, porte, natureza jurídica, capital) de cada estabelecimento
  const empresas = new Map();
  await varrer(
    T,
    2,
    inicioEst + MARGEM,
    (n, b) => {
      for (const { valores: v } of linhasDaPagina(b).linhas) {
        if (tabelaDaLinha(v) !== 'empresas') continue;
        const b8 = String(v[colEmp.cnpj_basico] ?? '');
        if (!basicos.has(b8)) continue;
        const capital = v[colEmp.capital_social] ?? String(v[colEmp.capital_social_str] ?? '').replace(',', '.');
        empresas.set(b8, {
          razao: nomeSemCpf(String(v[colEmp.razao_social] ?? '')),
          natureza: String(v[colEmp.natureza_juridica] ?? ''),
          porte: String(v[colEmp.porte_empresa] ?? ''),
          capital: Number(capital) || 0,
        });
      }
    },
    'empresas',
  );

  const lista = [...est.values()].map((e) => {
    const emp = empresas.get(e.cnpj.slice(0, 8)) || {};
    const s = simples.get(e.cnpj.slice(0, 8)) || {};
    return {
      ...e,
      abertura: data(e.abertura),
      razao: emp.razao || e.fantasia,
      natureza: emp.natureza || '',
      porte: emp.porte || '',
      capital: emp.capital || 0,
      ...s,
    };
  });
  const usados = new Set(lista.flatMap((e) => [e.cnae, ...e.cnaes]));
  const saida = {
    geradoEm: new Date().toISOString(),
    fonte: { arquivo: ID, bytes: tamArq },
    cidades: CIDADES_CLIENTES.map((c) => c.nome),
    cnae: Object.fromEntries([...usados].filter((c) => cnaes.has(c)).map((c) => [c, cnaes.get(c)])),
    natureza: Object.fromEntries([...new Set(lista.map((e) => e.natureza))].filter((c) => naturezas.has(c)).map((c) => [c, naturezas.get(c)])),
    empresas: lista,
  };
  fs.writeFileSync(SAIDA, zlib.gzipSync(JSON.stringify(saida)));
  const porCidade = {};
  for (const e of lista) porCidade[e.cidade] = (porCidade[e.cidade] || 0) + 1;
  console.log(
    `Cadastro: ${lista.length} empresas ativas (${lista.filter((e) => e.tel1 || e.tel2).length} com telefone, ${lista.filter((e) => e.email).length} com e-mail) em ${Math.round((Date.now() - t0) / 60e3)} min. ${JSON.stringify(porCidade)}`,
  );
}

// ---------------------------------------------------------------- publicação (cifrada)

/** Histórico em licitações de cada CNPJ, pelas atas lidas na Prospecção (clientes-cache.json) */
export function historicoLicitacoes(cache) {
  const h = new Map();
  for (const c of Object.values(cache?.compras || {}))
    for (const it of c.itens || [])
      for (const [cnpj, col] of it.c) {
        const x = h.get(cnpj) || { itens: 0, vitorias: 0, perto: 0, ultima: '' };
        x.itens++;
        if (col === 1 && it.v != null) x.vitorias++;
        if (col === 0 || (col >= 2 && col <= 5)) x.perto++;
        if (String(c.data) > x.ultima) x.ultima = String(c.data);
        h.set(cnpj, x);
      }
  return h;
}

async function publicar() {
  const destino = 'public/prospeccao/cadastro.bin';
  fs.rmSync(destino, { force: true });
  if (!fs.existsSync(SAIDA)) return console.log('Consulta CNPJ: ainda não há cadastro extraído (workflow "Cadastro CNPJ").');
  if (!process.env.PRIVADO_SENHA) return console.log('::warning::Consulta CNPJ não publicada: falta o segredo PRIVADO_SENHA no GitHub.');
  const dados = JSON.parse(zlib.gunzipSync(fs.readFileSync(SAIDA)).toString('utf8'));
  let cache = null;
  try {
    cache = JSON.parse(fs.readFileSync(process.env.CLIENTES_CACHE || 'clientes-cache.json', 'utf8'));
  } catch {
    /* sem o histórico em licitações */
  }
  const hist = historicoLicitacoes(cache);
  let comHist = 0;
  for (const e of dados.empresas) {
    const x = hist.get(e.cnpj);
    if (x) {
      e.lic = x;
      comHist++;
    }
  }
  dados.publicadoEm = new Date().toISOString();
  const chave = await chaveDaSenha(process.env.PRIVADO_SENHA);
  fs.mkdirSync('public/prospeccao', { recursive: true });
  fs.writeFileSync(destino, await cifrar(zlib.gzipSync(JSON.stringify(dados)), chave));
  console.log(`Consulta CNPJ: ${dados.empresas.length} empresas publicadas (cifradas), ${comHist} com histórico em licitações.`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  if (process.argv.includes('--publicar')) await publicar();
  else await extrair();
}
