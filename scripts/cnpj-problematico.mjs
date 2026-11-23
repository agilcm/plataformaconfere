// Consulta CNPJ → "CNPJ problemático" (só da equipe): empresas das cidades escolhidas (src/data/problematicosConfig.js)
// com o CNPJ inapto ou excluídas do Simples ou do MEI no ano da base ou no anterior, com sócios, telefone, e-mail e o
// motivo provável (regras em src/lib/cnpjProblematico.js). Fonte: Dados Abertos do CNPJ da Receita Federal, lidos direto
// do servidor da Receita (arquivos.receitafederal.gov.br), sem guardar os arquivos inteiros: cada zip é lido em sequência
// e só ficam as linhas das cidades. Se o servidor da Receita não responder (ele não aceita conexões do GitHub), lê a
// mesma base no cnpj.db do Google Drive, o do workflow Cadastro CNPJ.
//
//   node scripts/cnpj-problematico.mjs              extrai e grava cnpj-problematico.bin (guardado no cache do Actions)
//   node scripts/cnpj-problematico.mjs --publicar   copia o arquivo para public/prospeccao/problematicos.bin
//
// O arquivo sai cifrado com a senha do Privado (segredo PRIVADO_SENHA) já na extração: o repositório é público e a lista
// tem nomes e contatos, então nada vai em texto aberto para o cache nem para o log (que só mostra contagens).
// Variáveis: PRIVADO_SENHA (obrigatória), CNPJ_FONTE (auto, receita ou drive), CNPJ_BASE (AAAA-MM; vazio = a mais recente
// completa), CNPJ_LOCAL (pasta com os zips já baixados, para testar sem a internet), CNPJ_DB_ID (id do cnpj.db no Drive),
// CNPJ_DB_URL (endereço do cnpj.db, para testar), CNPJ_PROBLEMATICO_SAIDA.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import zlib from 'node:zlib';
import { ANOS_EXCLUSAO_ANTES, CIDADES_PROBLEMATICOS } from '../src/data/problematicosConfig.js';
import { casosDe, classeDe, dataIso, individual, prioridadeDe, telefone, titularCpf } from '../src/lib/cnpjProblematico.js';
import { chaveDaSenha, cifrar, decifrar } from '../src/lib/cofre.js';
import { lerTabela, linhasDaPagina, PAGINA, tamanhoDaPagina } from '../src/lib/sqliteFolhas.js';
import { ARQUIVO_PADRAO, ORDEM, tabelaDaLinha, trecho, urlDoArquivo, varrer } from './cadastro-cnpj.mjs';

/** Pasta pública dos Dados Abertos do CNPJ (compartilhamento do Nextcloud da Receita; o "usuário" é o código do link) */
const DAV = 'https://arquivos.receitafederal.gov.br/public.php/webdav/Dados/Cadastros/CNPJ/';
const LINK = 'gn672Ad4CF8N6TK';
const SAIDA = process.env.CNPJ_PROBLEMATICO_SAIDA || 'cnpj-problematico.bin';
const DESTINO = 'public/prospeccao/problematicos.bin';
const PARTES = [...Array(10).keys()];
const NECESSARIOS = [
  'Municipios',
  'Motivos',
  'Qualificacoes',
  'Naturezas',
  'Cnaes',
  'Simples',
  ...PARTES.flatMap((i) => [`Estabelecimentos${i}`, `Socios${i}`, `Empresas${i}`]),
];

const aspas = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const semAcento = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]+/g, ' ')
    .trim();
/** Nome de cidade para comparar com a tabela da Receita (que às vezes troca Z por S, Y por I) */
export const chaveCidade = (s) => semAcento(s).replace(/Z/g, 'S').replace(/Y/g, 'I');

/** Uma linha do CSV da Receita (campos entre aspas, separados por ;) */
export function campos(linha) {
  let l = linha.endsWith('\r') ? linha.slice(0, -1) : linha;
  if (l.startsWith('"')) l = l.slice(1);
  if (l.endsWith('"')) l = l.slice(0, -1);
  return l.split('";"');
}

// ---------------------------------------------------------------- leitura

/** Bases (AAAA-MM) da pasta da Receita, da mais nova para a mais velha, e os arquivos de cada uma */
async function listar(url) {
  const r = await fetch(url, {
    method: 'PROPFIND',
    headers: { Depth: '1', Authorization: `Basic ${Buffer.from(`${LINK}:`).toString('base64')}` },
    signal: AbortSignal.timeout(60e3),
  });
  if (!r.ok) throw new Error(`Receita respondeu ${r.status} ao listar ${url}`);
  const xml = await r.text();
  return [...xml.matchAll(/<d:href>([^<]+)<\/d:href>/g)].map((m) => decodeURIComponent(m[1]).replace(/\/$/, '').split('/').pop());
}

async function escolherBase() {
  if (process.env.CNPJ_BASE) return process.env.CNPJ_BASE;
  const bases = (await listar(DAV))
    .filter((n) => /^\d{4}-\d{2}$/.test(n))
    .sort()
    .reverse();
  for (const b of bases.slice(0, 3)) {
    const arquivos = new Set(await listar(`${DAV}${b}/`));
    const faltam = NECESSARIOS.filter((n) => !arquivos.has(`${n}.zip`));
    if (!faltam.length) return b;
    console.log(`Base ${b} ainda incompleta (faltam ${faltam.length} arquivos); tentando a anterior.`);
  }
  throw new Error('Nenhuma base completa do CNPJ encontrada na Receita.');
}

/** Comando que escreve no stdout o CSV de dentro do zip (cada zip da Receita tem um só arquivo) */
function fonte(base, nome) {
  if (process.env.CNPJ_LOCAL) return `funzip < ${aspas(path.join(process.env.CNPJ_LOCAL, `${nome}.zip`))}`;
  return `curl -sS --fail --connect-timeout 60 -u ${LINK}: ${aspas(`${DAV}${base}/${nome}.zip`)} | funzip`;
}

/**
 * Roda `fonte | filtro` e grava em `arquivo`. Se a conexão cair no meio, recomeça o arquivo (até 4 vezes).
 * O grep sem nenhuma linha achada sai com 1, o que não é erro.
 */
async function extrairPara(cmd, arquivo, rotulo) {
  const t0 = Date.now();
  for (let t = 1; ; t++) {
    const parte = `${arquivo}.parte`;
    const codigo = await new Promise((ok) => {
      const p = spawn('bash', ['-c', `set -o pipefail; { ${cmd}; } > ${aspas(parte)}`], {
        stdio: ['ignore', 'ignore', 'pipe'],
        env: { ...process.env, LC_ALL: 'C' },
      });
      let erro = '';
      p.stderr.on('data', (d) => (erro += d).length > 2000 && (erro = erro.slice(-2000)));
      p.on('close', (c) => {
        if (c) console.log(`${rotulo}: falhou (código ${c}) ${erro.trim().split('\n').pop() || ''}`);
        ok(c);
      });
    });
    if (codigo === 0) {
      fs.renameSync(parte, arquivo);
      console.log(`${rotulo}: ${Math.round((Date.now() - t0) / 1000)} s`);
      return;
    }
    if (t >= 4) throw new Error(`${rotulo}: não foi possível ler da Receita`);
    await new Promise((r) => setTimeout(r, 20e3 * t));
  }
}

/** Roda as tarefas com no máximo `n` ao mesmo tempo */
async function emParalelo(tarefas, n) {
  const fila = [...tarefas];
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (fila.length) await fila.shift()();
    }),
  );
}

async function* linhas(arquivo) {
  const rl = readline.createInterface({ input: fs.createReadStream(arquivo, { encoding: 'latin1' }), crlfDelay: Infinity });
  for await (const l of rl) if (l) yield campos(l);
}

async function tabela(arquivo) {
  const m = new Map();
  for await (const c of linhas(arquivo)) if (c.length >= 2) m.set(c[0], c[1].trim());
  return m;
}

/** Filtro exato pelo CNPJ básico (1º campo): o grep corta o volume e o awk confere o campo, sem casar datas */
function filtroBasicos(pasta) {
  const g = path.join(pasta, 'basicos.grep');
  const a = path.join(pasta, 'basicos.awk');
  return `{ grep -a -F -f ${aspas(g)} || test $? = 1; } | awk -F';' 'NR==FNR{b[$1];next} ($1 in b)' ${aspas(a)} -`;
}
function gravarBasicos(pasta, basicos) {
  fs.writeFileSync(path.join(pasta, 'basicos.grep'), [...basicos].map((b) => `"${b}";`).join('\n') + '\n');
  fs.writeFileSync(path.join(pasta, 'basicos.awk'), [...basicos].map((b) => `"${b}"`).join('\n') + '\n');
}

// ---------------------------------------------------------------- montagem

const capitalDe = (v) => {
  const n = Number(
    String(v || '')
      .replace(/\./g, '')
      .replace(',', '.'),
  );
  return Number.isFinite(n) && v ? n : null;
};

export function estabelecimentoDe(c, motivos, cidade) {
  const motivo = c[7] && c[7] !== '00' ? motivos.get(c[7]) || `código ${c[7]}, sem descrição na tabela da Receita` : '';
  let endereco = [c[13], c[14]]
    .map((x) => x.trim())
    .filter(Boolean)
    .join(' ');
  if (c[15].trim()) endereco += `, ${c[15].trim()}`;
  if (c[16].trim()) endereco += ` ${c[16].trim()}`;
  return {
    cnpj: c[0] + c[1] + c[2],
    matriz: c[3] === '1',
    fantasia: c[4].trim(),
    situacao: c[5],
    dataSituacao: dataIso(c[6]),
    motivoSituacao: motivo,
    abertura: dataIso(c[10]),
    cnae: c[11],
    cnaes: c[12]
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
    endereco: endereco.trim(),
    bairro: c[17].trim(),
    cep: c[18].trim(),
    cidade,
    uf: c[19],
    tel1: telefone(c[21], c[22]),
    tel2: telefone(c[23], c[24]),
    fax: telefone(c[25], c[26]),
    email: c[27].trim().toLowerCase(),
    situacaoEspecial: c[28].trim() ? `${c[28].trim()}${dataIso(c[29]) ? ` (${dataIso(c[29]).split('-').reverse().join('/')})` : ''}` : '',
  };
}

export const simplesDe = (c) => ({
  opcao: c[1],
  dataOpcao: dataIso(c[2]),
  dataExclusao: dataIso(c[3]),
  mei: c[4],
  dataOpcaoMei: dataIso(c[5]),
  dataExclusaoMei: dataIso(c[6]),
});

export const socioDe = (c) => ({
  nome: c[2].trim(),
  doc: c[3].trim(),
  pj: c[1] === '1',
  qual: c[4],
  entrada: dataIso(c[5]),
  ...(c[1] === '2' && c[10] ? { faixa: Number(c[10]) } : {}),
  ...(c[8]?.trim() ? { rep: c[8].trim(), repQual: c[9] } : {}),
});

const anosDa = (base) => {
  const ano = Number(base.slice(0, 4));
  return Array.from({ length: ANOS_EXCLUSAO_ANTES + 1 }, (_, i) => String(ano - ANOS_EXCLUSAO_ANTES + i));
};
const temCaso = (anos, simples) => (e) => casosDe(e, simples.get(e.basico) || null, '', anos).length > 0;
const juntarSocio = (socios, c) => socios.set(c[0], [...(socios.get(c[0]) || []), socioDe(c)]);

/**
 * Códigos das cidades na tabela de municípios da Receita, como "UF;código" (sem zeros à esquerda) → nome da cidade.
 * A tabela não tem UF: o filtro usa UF + código, e nomes iguais de outros estados não entram.
 */
function codigosDasCidades(municipios) {
  const porNome = new Map();
  for (const [cod, nome] of municipios) porNome.set(chaveCidade(nome), [...(porNome.get(chaveCidade(nome)) || []), cod]);
  const cidadeDoCodigo = new Map();
  for (const c of CIDADES_PROBLEMATICOS) {
    const cods = porNome.get(chaveCidade(c.nome));
    if (!cods) throw new Error(`Cidade não achada na tabela de municípios da Receita: ${c.nome}`);
    for (const cod of cods) cidadeDoCodigo.set(`${c.uf};${cod.replace(/^0+/, '')}`, c.nome);
  }
  console.log(`Cidades: ${CIDADES_PROBLEMATICOS.length} (${cidadeDoCodigo.size} códigos na Receita).`);
  return cidadeDoCodigo;
}

/** Fonte 1: os zips dos Dados Abertos, direto do servidor da Receita */
async function daReceita() {
  const base = await escolherBase();
  const anos = anosDa(base);
  console.log(`Fonte: servidor da Receita, base ${base}. Exclusões de ${anos.join(' e ')}.`);
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'cnpj-problematico-'));
  try {
    const tab = {};
    await emParalelo(
      ['Municipios', 'Motivos', 'Qualificacoes', 'Naturezas', 'Cnaes'].map((n) => async () => {
        await extrairPara(fonte(base, n), path.join(pasta, `${n}.csv`), n);
        tab[n] = await tabela(path.join(pasta, `${n}.csv`));
      }),
      5,
    );
    const cidadeDoCodigo = codigosDasCidades(tab.Municipios);
    const padrao = [...tab.Municipios.keys()]
      .map((cod) => CIDADES_PROBLEMATICOS.filter((c) => cidadeDoCodigo.has(`${c.uf};${cod.replace(/^0+/, '')}`)).map((c) => `"${c.uf}";"${cod}";`))
      .flat();
    fs.writeFileSync(path.join(pasta, 'cidades.grep'), padrao.join('\n') + '\n');

    // estabelecimentos das cidades (os 10 arquivos ao mesmo tempo)
    await emParalelo(
      PARTES.map(
        (i) => () =>
          extrairPara(
            `${fonte(base, `Estabelecimentos${i}`)} | { grep -a -F -f ${aspas(path.join(pasta, 'cidades.grep'))} || test $? = 1; }`,
            path.join(pasta, `est${i}.csv`),
            `Estabelecimentos${i}`,
          ),
      ),
      10,
    );
    const ests = [];
    for (const i of PARTES)
      for await (const c of linhas(path.join(pasta, `est${i}.csv`))) {
        const cidade = c.length >= 30 && cidadeDoCodigo.get(`${c[19]};${c[20].replace(/^0+/, '')}`);
        if (cidade) ests.push({ basico: c[0], ...estabelecimentoDe(c, tab.Motivos, cidade) });
      }
    const basicosCidades = new Set(ests.map((e) => e.basico));
    console.log(`Estabelecimentos nas cidades: ${ests.length} (${basicosCidades.size} empresas).`);

    // Simples e MEI dessas empresas
    gravarBasicos(pasta, basicosCidades);
    await extrairPara(`${fonte(base, 'Simples')} | ${filtroBasicos(pasta)}`, path.join(pasta, 'simples.csv'), 'Simples');
    const simples = new Map();
    for await (const c of linhas(path.join(pasta, 'simples.csv'))) if (c.length >= 7) simples.set(c[0], simplesDe(c));
    console.log(`Com registro no Simples/MEI: ${simples.size}.`);

    // só das empresas com algum caso se buscam o nome empresarial e os sócios
    const escolhidos = ests.filter(temCaso(anos, simples));
    gravarBasicos(pasta, new Set(escolhidos.map((e) => e.basico)));
    await emParalelo(
      PARTES.flatMap((i) => [`Socios${i}`, `Empresas${i}`]).map(
        (n) => () => extrairPara(`${fonte(base, n)} | ${filtroBasicos(pasta)}`, path.join(pasta, `${n}.csv`), n),
      ),
      6,
    );
    const empresas = new Map();
    const socios = new Map();
    for (const i of PARTES) {
      for await (const c of linhas(path.join(pasta, `Empresas${i}.csv`))) if (c.length >= 7) empresas.set(c[0], c);
      for await (const c of linhas(path.join(pasta, `Socios${i}.csv`))) if (c.length >= 11) juntarSocio(socios, c);
    }
    return {
      base,
      fonte: 'Servidor da Receita Federal',
      anos,
      escolhidos,
      simples,
      empresas,
      socios,
      cnae: tab.Cnaes,
      natureza: tab.Naturezas,
      qualificacao: tab.Qualificacoes,
    };
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }
}

/**
 * Fonte 2: o cnpj.db (a mesma base em SQLite, ~28 GB) no Google Drive, o mesmo do workflow Cadastro CNPJ, lido em
 * sequência pelo link, sem baixar inteiro. O GitHub não alcança o servidor da Receita; o Drive, sim.
 * O arquivo tem, nesta ordem: empresas, estabelecimentos, sócios, Simples e índices; as colunas seguem os CSVs da Receita.
 * 1ª passada: estabelecimentos das cidades, os sócios e o Simples deles; 2ª passada: as empresas com algum caso.
 */
async function doDrive() {
  const url = process.env.CNPJ_DB_URL || urlDoArquivo(process.env.CNPJ_DB_ID || ARQUIVO_PADRAO);
  const inicio = await trecho(0, 1024 * 1024 - 1, url);
  const T = tamanhoDaPagina(inicio);
  const cacheP = new Map();
  const pagina = async (n) => {
    if (n * T <= inicio.length) return inicio.subarray((n - 1) * T, n * T);
    if (!cacheP.has(n)) cacheP.set(n, await trecho((n - 1) * T, n * T - 1, url));
    return cacheP.get(n);
  };
  const mestre = (await lerTabela(pagina, 1)).map((l) => ({ tipo: l.valores[0], nome: l.valores[1], raiz: l.valores[3] }));
  const raiz = (nome) => {
    const t = mestre.find((m) => m.tipo === 'table' && m.nome === nome);
    if (!t) throw new Error(`O cnpj.db não tem a tabela ${nome}`);
    return t.raiz;
  };
  for (const t of ['estabelecimento', 'empresas', 'simples', 'socios_original']) raiz(t);
  const dic = async (nome) => new Map((await lerTabela(pagina, raiz(nome))).map((l) => [String(l.valores[0]).trim(), String(l.valores[1] || '').trim()]));
  const municipios = await dic('municipio');
  const motivos = await dic('motivo');
  const cnae = await dic('cnae');
  const natureza = await dic('natureza_juridica');
  const qualificacao = await dic('qualificacao_socio');
  const cidadeDoCodigo = codigosDasCidades(municipios);

  // onde começa cada parte: sondagem (busca binária) pela ordem empresas < estabelecimentos < sócios < Simples < índices
  const tamArq = Number((await fetch(url, { headers: { Range: 'bytes=0-0' } })).headers.get('content-range')?.split('/')[1]);
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
  const MARGEM = 4096; // 16 MB antes de cada parte, por segurança (cada página é reconhecida de novo na leitura)
  // a sondagem para até 64 páginas antes de onde os índices começam: lê um pouco além para não perder o fim do Simples
  const fimDados = Math.min(total + 1, inicioIdx + 129);
  const texto = (v) => {
    const c = v.map((x) => (x == null ? '' : String(x)));
    while (c.length < 30) c.push('');
    return c;
  };

  const ests = [];
  const basicosCidades = new Set();
  const socios = new Map();
  const simples = new Map();
  let ultimaData = '';
  await varrer(
    T,
    Math.max(101, inicioEst - MARGEM),
    fimDados,
    (n, b) => {
      for (const { valores: v } of linhasDaPagina(b).linhas) {
        const t = tabelaDaLinha(v);
        if (t === 'estabelecimento') {
          const c = texto(v);
          const cidade = cidadeDoCodigo.get(`${c[19].trim()};${c[20].trim().replace(/^0+/, '')}`);
          if (!cidade) continue;
          ests.push({ basico: c[0], ...estabelecimentoDe(c, motivos, cidade) });
          basicosCidades.add(c[0]);
          for (const d of [c[6], c[10]]) if (/^\d{8}$/.test(d) && d > ultimaData) ultimaData = d;
        } else if (t === 'socios') {
          if (basicosCidades.has(String(v[0]))) juntarSocio(socios, texto(v));
        } else if (t === 'simples') {
          if (basicosCidades.has(String(v[0]))) simples.set(String(v[0]), simplesDe(texto(v)));
        }
      }
    },
    'estabelecimentos, sócios e Simples',
    url,
  );
  const hoje = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const ref = ultimaData && ultimaData <= hoje ? ultimaData : hoje;
  const base = `${ref.slice(0, 4)}-${ref.slice(4, 6)}`;
  const anos = anosDa(base);
  console.log(`Fonte: cnpj.db do Google Drive (base de ${base}, pela data mais recente do cadastro). Exclusões de ${anos.join(' e ')}.`);
  console.log(`Estabelecimentos nas cidades: ${ests.length} (${basicosCidades.size} empresas); Simples/MEI: ${simples.size}.`);

  const escolhidos = ests.filter(temCaso(anos, simples));
  const basicos = new Set(escolhidos.map((e) => e.basico));
  const empresas = new Map();
  await varrer(
    T,
    2,
    inicioEst + MARGEM,
    (n, b) => {
      for (const { valores: v } of linhasDaPagina(b).linhas)
        if (tabelaDaLinha(v) === 'empresas' && basicos.has(String(v[0]))) empresas.set(String(v[0]), texto(v));
    },
    'empresas',
    url,
  );
  for (const b of basicosCidades) if (!basicos.has(b)) socios.delete(b);
  return { base, fonte: 'cnpj.db do Google Drive', anos, escolhidos, simples, empresas, socios, cnae, natureza, qualificacao };
}

/** Os registros da lista, a partir do que cada fonte leu */
function montar({ base, fonte: origem, anos, escolhidos, simples, empresas, socios, cnae, natureza, qualificacao }) {
  const usados = { cnae: new Set(), natureza: new Set(), qual: new Set() };
  const lista = escolhidos.map(({ basico, ...e }) => {
    const emp = empresas.get(basico) || [];
    const nat = emp[2] || '';
    const natNome = natureza.get(nat) || '';
    const s = simples.get(basico) || null;
    const casos = casosDe(e, s, natNome, anos);
    const soc = (socios.get(basico) || []).sort((a, b) => (a.entrada || '9999').localeCompare(b.entrada || '9999') || a.nome.localeCompare(b.nome));
    const r = {
      ...e,
      razao: (emp[1] || '').trim(),
      natureza: nat,
      qualResp: emp[3] || '',
      capital: capitalDe(emp[4]),
      porte: emp[5] || '',
      simples: s,
      socios: soc,
      titularCpf: individual(natNome) ? titularCpf(emp[1]) : '',
      casos,
      classe: classeDe(casos),
    };
    r.prioridade = prioridadeDe(r);
    [r.cnae, ...r.cnaes].forEach((x) => usados.cnae.add(x));
    usados.natureza.add(nat);
    [r.qualResp, ...soc.flatMap((x) => [x.qual, x.repQual])].filter(Boolean).forEach((x) => usados.qual.add(x));
    return r;
  });
  const so = (m, chaves) => Object.fromEntries([...chaves].filter((k) => m.has(k)).map((k) => [k, m.get(k)]));
  const conta = (f) => lista.filter(f).length;
  console.log(
    `CNPJ problemático: ${lista.length} estabelecimentos — ${conta((r) => r.classe === 'problema')} problema, ${conta((r) => r.classe === 'crescimento')} crescimento, ` +
      `${conta((r) => r.classe === 'verificar')} verificar; prioridade alta ${conta((r) => r.prioridade === 'alta')}; inaptas ${conta((r) => r.casos.some((c) => c.tipo === 'inapta'))}; ` +
      anos
        .map(
          (a) =>
            `Simples ${a}: ${conta((r) => r.casos.some((c) => c.tipo === 'simples' && c.data.startsWith(a)))}, MEI ${a}: ${conta((r) => r.casos.some((c) => c.tipo === 'mei' && c.data.startsWith(a)))}`,
        )
        .join('; '),
  );
  return {
    geradoEm: new Date().toISOString(),
    base,
    fonte: origem,
    anos,
    cidades: CIDADES_PROBLEMATICOS.map((c) => c.nome),
    cnae: so(cnae, usados.cnae),
    natureza: so(natureza, usados.natureza),
    qualificacao: so(qualificacao, usados.qual),
    empresas: lista,
  };
}

async function extrair() {
  if (!process.env.PRIVADO_SENHA) throw new Error('Falta o segredo PRIVADO_SENHA: a lista só é gravada cifrada.');
  const chave = await chaveDaSenha(process.env.PRIVADO_SENHA);
  const qual = process.env.CNPJ_FONTE || 'auto'; // auto | receita | drive
  let lido = null;
  if (qual !== 'drive')
    try {
      lido = await daReceita();
    } catch (e) {
      if (qual === 'receita') throw e;
      console.log(`Servidor da Receita fora do alcance (${e.cause?.code || e.message}); lendo o cnpj.db do Google Drive.`);
    }
  if (!lido) lido = await doDrive();
  const dados = montar(lido);
  fs.writeFileSync(SAIDA, await cifrar(zlib.gzipSync(JSON.stringify(dados)), chave));
  console.log(`Gravado ${SAIDA} (cifrado, ${Math.round(fs.statSync(SAIDA).size / 1024)} KB).`);
}

/** Publicação do site: confere que o arquivo abre com a senha atual e o põe em public/prospeccao */
async function publicar() {
  fs.rmSync(DESTINO, { force: true });
  if (!fs.existsSync(SAIDA)) return console.log('CNPJ problemático: ainda não há lista extraída (workflow "CNPJ problemático").');
  if (!process.env.PRIVADO_SENHA) return console.log('::warning::CNPJ problemático não publicado: falta o segredo PRIVADO_SENHA no GitHub.');
  const arquivo = fs.readFileSync(SAIDA);
  try {
    const dados = JSON.parse(zlib.gunzipSync(await decifrar(arquivo, await chaveDaSenha(process.env.PRIVADO_SENHA))).toString('utf8'));
    fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
    fs.writeFileSync(DESTINO, arquivo);
    console.log(`CNPJ problemático: ${dados.empresas.length} estabelecimentos publicados (cifrados), base ${dados.base}.`);
  } catch {
    console.log('::warning::CNPJ problemático não publicado: a lista guardada foi cifrada com outra senha. Rode o workflow "CNPJ problemático" de novo.');
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  if (process.argv.includes('--publicar')) await publicar();
  else await extrair();
}
