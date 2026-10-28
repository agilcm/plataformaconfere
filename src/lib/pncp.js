// Acesso à API pública do PNCP (Portal Nacional de Contratações Públicas — pncp.gov.br).
// Usado pelas funções do servidor (pasta /api) e, como plano B, direto pelo navegador.
//
// O PNCP oscila com frequência (erros 5xx, lentidão, limite de requisições). Por isso toda
// chamada passa por fetchJson(), que tem tempo limite, novas tentativas com espera crescente
// e mensagens de erro claras.
import { microrregiaoDe } from '../data/zonaDaMata.js';

const SEARCH = 'https://pncp.gov.br/api/search/';
const API = 'https://pncp.gov.br/api/pncp/v1';

// ---------------------------------------------------------------- utilidades

export class PncpError extends Error {
  constructor(message, { status = 0, retryable = true } = {}) {
    super(message);
    this.name = 'PncpError';
    this.status = status;
    this.retryable = retryable;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * GET com tempo limite e novas tentativas.
 * Tenta de novo em falha de rede, tempo esgotado, 429 e 5xx. Erros 4xx (exceto 429) não repetem.
 */
export async function fetchJson(url, { retries = 3, timeout = 15000, fetchImpl = fetch } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeout) : null;
    try {
      const res = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: ctrl?.signal });
      if (res.status === 204) return null;
      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        throw new PncpError(`PNCP respondeu ${res.status}`, { status: res.status, retryable });
      }
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (e) {
      last =
        e instanceof PncpError
          ? e
          : new PncpError(e?.name === 'AbortError' ? 'PNCP demorou demais para responder' : 'Falha de conexão com o PNCP');
      if (!last.retryable || attempt === retries) break;
      await sleep(Math.min(8000, 700 * 2 ** attempt) + Math.random() * 300);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw last;
}

/** Corrige textos com acentuação quebrada vindos do PNCP ("aquisiÃ§Ã£o" → "aquisição") */
export function fixText(s) {
  const str = String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!/Ã[\u0080-¿]|Ã§|Ã£|Ã©|Ãº|Ã³/.test(str)) return str;
  try {
    return decodeURIComponent(escape(str));
  } catch {
    return str;
  }
}

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const termsOf = (q) => norm(q).split(/[^a-z0-9/.,-]+/).filter((t) => t.length > 1);
const matchesAll = (text, terms) => {
  const hay = norm(text);
  return terms.every((t) => hay.includes(t));
};

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

/** "/compras/CNPJ/ANO/SEQ" ou "CNPJ-1-000015/2026" → { cnpj, ano, seq } */
export function parseCompraRef(ref) {
  const s = String(ref || '');
  let m = s.match(/(\d{14})\/(\d{4})\/(\d+)/);
  if (m) return { cnpj: m[1], ano: m[2], seq: String(Number(m[3])) };
  m = s.match(/^(\d{14})-\d-(\d+)\/(\d{4})$/);
  if (m) return { cnpj: m[1], ano: m[3], seq: String(Number(m[2])) };
  return null;
}

async function mapLimit(list, limit, fn) {
  const out = new Array(list.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, list.length) }, async () => {
      while (i < list.length) {
        const idx = i++;
        out[idx] = await fn(list[idx], idx);
      }
    }),
  );
  return out;
}

// ---------------------------------------------------------------- editais abertos

export function buildSearchUrl({ pagina = 1, tamanho = 50, q = '', tipo = 'edital', status = 'recebendo_proposta' } = {}) {
  const p = new URLSearchParams({
    q,
    tipos_documento: tipo,
    ordenacao: '-data', // mais recentes primeiro (última atualização)
    pagina: String(pagina),
    tam_pagina: String(tamanho),
    ufs: 'MG',
  });
  if (status) p.set('status', status);
  return `${SEARCH}?${p.toString()}`;
}

// ---------------------------------------------------------------- fonte (plataforma que publicou no PNCP)
// O PNCP mostra "Fonte: ..." com o nome do sistema que enviou a compra (campo usuario_nome).
// Alguns vêm com a razão social da empresa dona da plataforma: trocamos pelo nome conhecido.
const FONTES_CONHECIDAS = [
  [/ecustomize|portal ?de ?compras ?p[uú]blicas|portaldecompraspublicas/i, 'Portal de Compras Públicas'],
  [/licitanet/i, 'Licitanet'],
  [/licitar ?digital|licitardigital/i, 'Licitar Digital'],
  [/ammlicita/i, 'Licitar Digital'],
  [/compras\.gov\.br|comprasnet|cnetmobile|serpro/i, 'Compras.gov.br'],
  [/compras do estado de minas|compras\.mg\.gov\.br/i, 'Portal de Compras de MG'],
  [/bolsa nacional de compras|\bbnc\b|bnccompras/i, 'BNC'],
  [/bbmnet/i, 'BBMNET'],
  [/\bbll\b|bllcompras/i, 'BLL Compras'],
  [/az inform[aá]tica|comprasbr/i, 'ComprasBR'],
  [/publicenter/i, 'Publicenter'],
  [/licitapp|sh3 inform/i, 'SH3 / Licitapp'],
  [/licita[cç][oõ]es-e|licitacoes-e/i, 'Licitações-e (BB)'],
];

export function fonteDe(it) {
  const nome = fixText(it.usuario_nome || '');
  const dom = String(it.link_sistema_origem || '');
  for (const [re, label] of FONTES_CONHECIDAS) if (re.test(nome)) return label;
  if (nome) {
    const limpo = nome
      .replace(/\s*[-–]\s*plataforma.*$/i, '')
      .replace(/\b(ltda|s\.?\s?a\.?|eireli|me|epp)\b\.?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const PEQ = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'para']);
    return limpo
      .split(' ')
      .map((w, i) => {
        const low = w.toLowerCase();
        if (i > 0 && PEQ.has(low)) return low;
        if (/^[A-Z&]{2,4}$/.test(w)) return w; // siglas: IPM, HLH, ADPM, E&L
        return low.charAt(0).toUpperCase() + low.slice(1);
      })
      .join(' ');
  }
  for (const [re, label] of FONTES_CONHECIDAS) if (re.test(dom)) return label;
  // Sem o campo: muitos órgãos colocam a plataforma entre colchetes no início do objeto
  const pref = String(it.description || '').match(/^\s*\[([^\]]{2,60})\]/);
  if (pref) {
    for (const [re, label] of FONTES_CONHECIDAS) if (re.test(pref[1])) return label;
    return pref[1].trim();
  }
  return 'Não informada';
}

// ---------------------------------------------------------------- local do pregão (onde acontece a disputa)
// Vem do link da plataforma informado no PNCP (link_sistema_origem); presencial quando a modalidade diz.
const LOCAIS_CONHECIDOS = [
  [/portaldecompraspublicas|ecustomize/i, 'Portal de Compras Públicas'],
  [/bnc\.org|bnccompras|bolsanacional/i, 'BNC'],
  [/bll\.org|bllcompras/i, 'BLL Compras'],
  [/licitanet/i, 'Licitanet'],
  [/ammlicita/i, 'AMM Licita'],
  [/licitardigital/i, 'Licitar Digital'],
  [/comprasnet|compras\.gov\.br|gov\.br\/compras|cnetmobile|estaleiro\.serpro/i, 'Compras.gov.br'],
  [/compras\.mg\.gov\.br|portaldecompras\.mg/i, 'Portal de Compras de MG'],
  [/bbmnet/i, 'BBMNET'],
  [/licitacoes-e|licitacoes-e2/i, 'Licitações-e (BB)'],
  [/comprasbr/i, 'ComprasBR'],
  [/publicenter/i, 'Publicenter'],
  [/licitapp/i, 'Licitapp'],
  [/novobbmnet|bbm/i, 'BBMNET'],
  [/portaldecompras|compraspublicas/i, 'Portal de Compras Públicas'],
];

/** { nome, link } do local onde acontece a sessão do pregão */
export function localDoPregao(it) {
  const link = String(it.link_sistema_origem || '').trim();
  const modalidade = String(it.modalidade_licitacao_nome || '');
  if (/presencial/i.test(modalidade)) return { nome: 'Presencial (no órgão)', link: /^https?:\/\//.test(link) ? link : null };
  if (/^https?:\/\//.test(link)) {
    for (const [re, nome] of LOCAIS_CONHECIDOS) if (re.test(link)) return { nome, link };
    try {
      return { nome: new URL(link).hostname.replace(/^www\./, ''), link };
    } catch {
      /* link inválido: cai na fonte abaixo */
    }
  }
  // sem link: a plataforma que publicou costuma ser a da disputa
  const fonte = fonteDe(it);
  return { nome: fonte === 'Não informada' ? 'Não informado' : fonte, link: null };
}

/** Conta editais por local do pregão (para o filtro), do maior para o menor. */
export function contarLocais(list) {
  const m = new Map();
  for (const e of list) m.set(e.local || 'Não informado', (m.get(e.local || 'Não informado') || 0) + 1);
  return [...m.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
}

/** Conta editais por fonte (para os botões do filtro), do maior para o menor. */
export function contarFontes(list) {
  const m = new Map();
  for (const e of list) m.set(e.fonte || 'Não informada', (m.get(e.fonte || 'Não informada') || 0) + 1);
  return [...m.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
}

export function mapItem(it) {
  const ref = parseCompraRef(it.item_url);
  const path = String(it.item_url || '').replace(/^\/compras\//, '');
  const local = localDoPregao(it);
  return {
    id: it.numero_controle_pncp || it.id || it.item_url,
    titulo: fixText(it.title) || 'Edital',
    objeto: fixText(it.description),
    orgao: fixText(it.orgao_nome),
    unidade: fixText(it.unidade_nome),
    municipio: fixText(it.municipio_nome),
    microrregiao: microrregiaoDe(it.municipio_nome),
    modalidade: it.modalidade_licitacao_nome || '',
    valor: num(it.valor_total_estimado),
    publicadoEm: it.data_publicacao_pncp || '',
    atualizadoEm: it.data_atualizacao_pncp || it.data_publicacao_pncp || '',
    propostasAte: it.data_fim_recebimento_propostas || it.data_fim_vigencia || null,
    link: path ? `https://pncp.gov.br/app/editais/${path}` : 'https://pncp.gov.br/app/editais',
    linkOrigem: it.link_sistema_origem || null,
    fonte: fonteDe(it),
    local: local.nome,
    linkLocal: local.link,
    compra: ref,
  };
}

export const sortByUpdate = (list) =>
  [...list].sort((a, b) => (b.atualizadoEm || '').localeCompare(a.atualizadoEm || ''));

export async function fetchPage({ pagina = 1, tamanho = 50, q = '' } = {}, fetchImpl = fetch) {
  const data = await fetchJson(buildSearchUrl({ pagina, tamanho, q }), { fetchImpl });
  return {
    items: (data?.items || []).filter((i) => i && i.item_url).map(mapItem),
    total: Number(data?.total) || 0,
  };
}

/**
 * Busca todos os editais abertos de MG (várias páginas em paralelo). Páginas com erro são ignoradas.
 * @param {{ maxPages?: number, concurrency?: number, tamanho?: number, onProgress?: (loaded: number, total: number) => void }} options
 * @param {typeof fetch} fetchImpl
 */
export async function fetchAllMG({ maxPages = 200, concurrency = 6, tamanho = 50, onProgress } = {}, fetchImpl = fetch) {
  const first = await fetchPage({ pagina: 1, tamanho }, fetchImpl);
  const pages = Math.min(maxPages, Math.ceil(first.total / tamanho));
  const all = [...first.items];
  let failed = 0;
  onProgress?.(all.length, first.total);
  const rest = Array.from({ length: Math.max(0, pages - 1) }, (_, i) => i + 2);
  await mapLimit(rest, concurrency, async (n) => {
    try {
      const r = await fetchPage({ pagina: n, tamanho }, fetchImpl);
      all.push(...r.items);
      onProgress?.(all.length, first.total);
    } catch {
      failed++;
    }
  });
  const seen = new Set();
  return {
    items: sortByUpdate(all.filter((e) => (seen.has(e.id) ? false : seen.add(e.id)))),
    total: first.total,
    paginasComErro: failed,
  };
}

/**
 * @param {any[]} list
 * @param {{ regiao?: string, micro?: string, q?: string, fontes?: string | string[], locais?: string | string[] }} options
 */
export function filterEditais(list, { regiao = 'mg', micro = '', q = '', fontes = [], locais = [] } = {}) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  const fs = new Set(Array.isArray(fontes) ? fontes : String(fontes || '').split('|').filter(Boolean));
  const ls = new Set(Array.isArray(locais) ? locais : String(locais || '').split('|').filter(Boolean));
  return list.filter((e) => {
    if (fs.size && !fs.has(e.fonte || 'Não informada')) return false;
    if (ls.size && !ls.has(e.local || 'Não informado')) return false;
    if (regiao === 'zona-da-mata' && !e.microrregiao) return false;
    if (micro && e.microrregiao !== micro) return false;
    if (terms.length && !matchesAll(`${e.objeto} ${e.orgao} ${e.municipio} ${e.titulo}`, terms)) return false;
    return true;
  });
}

// ---------------------------------------------------------------- detalhes de uma compra (itens e arquivos)

export async function fetchItensCompra({ cnpj, ano, seq }, fetchImpl = fetch, maxPaginas = 10) {
  const itens = [];
  for (let p = 1; p <= maxPaginas; p++) {
    const page = await fetchJson(`${API}/orgaos/${cnpj}/compras/${ano}/${seq}/itens?pagina=${p}&tamanhoPagina=100`, { fetchImpl });
    const arr = Array.isArray(page) ? page : [];
    itens.push(...arr);
    if (arr.length < 100) break;
  }
  return itens.map((i) => ({
    numero: i.numeroItem,
    descricao: fixText(i.descricao),
    quantidade: Number(i.quantidade) || null,
    unidade: fixText(i.unidadeMedida),
    valorUnitarioEstimado: num(i.valorUnitarioEstimado),
    valorTotalEstimado: num(i.valorTotal),
    situacao: i.situacaoCompraItemNome || '',
    temResultado: !!i.temResultado,
  }));
}

export async function fetchResultadosItem({ cnpj, ano, seq }, numeroItem, fetchImpl = fetch) {
  const arr = await fetchJson(`${API}/orgaos/${cnpj}/compras/${ano}/${seq}/itens/${numeroItem}/resultados`, { fetchImpl, retries: 2 });
  return (Array.isArray(arr) ? arr : [])
    .filter((r) => !r.dataCancelamento)
    .map((r) => ({
      fornecedor: fixText(r.nomeRazaoSocialFornecedor),
      fornecedorDoc: r.niFornecedor || '',
      porte: r.porteFornecedorNome || '',
      quantidade: Number(r.quantidadeHomologada) || null,
      valorUnitario: num(r.valorUnitarioHomologado),
      valorTotal: num(r.valorTotalHomologado),
      data: r.dataResultado || '',
    }));
}

export async function fetchArquivosCompra({ cnpj, ano, seq }, fetchImpl = fetch) {
  const arr = await fetchJson(`${API}/orgaos/${cnpj}/compras/${ano}/${seq}/arquivos`, { fetchImpl, retries: 2 });
  return (Array.isArray(arr) ? arr : [])
    .filter((a) => a.statusAtivo !== false)
    .map((a) => ({ titulo: fixText(a.titulo), tipo: a.tipoDocumentoNome || 'Documento', url: a.url || a.uri }));
}

/** Itens + documentos de uma compra. Se uma das partes falhar, a outra ainda é entregue. */
export async function fetchDetalheCompra(ref, fetchImpl = fetch) {
  const [itens, arquivos] = await Promise.allSettled([fetchItensCompra(ref, fetchImpl), fetchArquivosCompra(ref, fetchImpl)]);
  if (itens.status === 'rejected' && arquivos.status === 'rejected') throw itens.reason;
  return {
    itens: itens.status === 'fulfilled' ? itens.value : null,
    arquivos: arquivos.status === 'fulfilled' ? arquivos.value : null,
  };
}

// ---------------------------------------------------------------- contratos: quem comprou o quê, por quanto

export function mapContrato(it) {
  const path = String(it.item_url || '').replace(/^\/contratos\//, '');
  return {
    id: it.numero_controle_pncp || it.id || it.item_url,
    titulo: fixText(it.title),
    objeto: fixText(it.description),
    orgao: fixText(it.orgao_nome),
    unidade: fixText(it.unidade_nome),
    esfera: it.esfera_id || '',
    municipio: fixText(it.municipio_nome),
    microrregiao: microrregiaoDe(it.municipio_nome),
    modalidade: it.modalidade_licitacao_nome || '',
    tipo: it.tipo_contrato_nome || '',
    fornecedor: fixText(it.fornecedor_nome),
    fornecedorDoc: it.fornecedor_ni || '',
    valorGlobal: num(it.valor_global),
    assinadoEm: it.data_assinatura || '',
    atualizadoEm: it.data_atualizacao_pncp || it.data_publicacao_pncp || '',
    compra: parseCompraRef(it.numero_contratacao),
    link: path ? `https://pncp.gov.br/app/contratos/${path}` : 'https://pncp.gov.br/app/contratos',
  };
}

/**
 * Pesquisa um produto nos contratos de MG e devolve, para cada compra, o item correspondente:
 * descrição/modelo solicitado, quantidade, valor estimado, valor homologado e fornecedor vencedor.
 *
 * @param {{ q: string, regiao?: 'mg'|'zona-da-mata', micro?: string, soMunicipios?: boolean, pagina?: number,
 *           alvo?: number, maxPaginas?: number }} opts
 */
export async function searchContratosProduto(
  { q, regiao = 'mg', micro = '', soMunicipios = true, pagina = 1, alvo = 12, maxPaginas = 5 },
  fetchImpl = fetch,
) {
  const terms = termsOf(q);
  if (!terms.length) return { rows: [], proximaPagina: null, totalBusca: 0, itensComErro: 0 };

  const contratos = [];
  let p = pagina;
  let totalBusca = 0;
  let fim = false;
  for (let lidas = 0; lidas < maxPaginas && contratos.length < alvo && !fim; lidas++, p++) {
    const data = await fetchJson(buildSearchUrl({ q, pagina: p, tamanho: 30, tipo: 'contrato', status: '' }), { fetchImpl });
    const items = (data?.items || []).filter((i) => i && i.item_url).map(mapContrato);
    totalBusca = Number(data?.total) || totalBusca;
    if (items.length < 30) fim = true;
    for (const c of items) {
      if (soMunicipios && c.esfera !== 'M') continue;
      if (regiao === 'zona-da-mata' && !c.microrregiao) continue;
      if (micro && c.microrregiao !== micro) continue;
      contratos.push(c);
    }
  }

  // Várias empenhos/contratos podem vir da mesma compra: busca os itens uma vez por compra
  const compras = new Map();
  for (const c of contratos) if (c.compra) compras.set(`${c.compra.cnpj}/${c.compra.ano}/${c.compra.seq}`, c.compra);
  let itensComErro = 0;
  const itensPorCompra = new Map();
  await mapLimit([...compras.entries()], 4, async ([key, ref]) => {
    try {
      const itens = (await fetchItensCompra(ref, fetchImpl, 5)).filter((i) => matchesAll(i.descricao, terms)).slice(0, 6);
      await mapLimit(itens, 3, async (i) => {
        if (!i.temResultado) return;
        try {
          i.resultados = await fetchResultadosItem(ref, i.numero, fetchImpl);
        } catch {
          i.resultados = null;
        }
      });
      itensPorCompra.set(key, itens);
    } catch {
      itensComErro++;
      itensPorCompra.set(key, null);
    }
  });

  const rows = [];
  const usados = new Set();
  for (const c of contratos) {
    const key = c.compra ? `${c.compra.cnpj}/${c.compra.ano}/${c.compra.seq}` : '';
    const itens = key ? itensPorCompra.get(key) : null;
    if (itens && itens.length) {
      if (usados.has(key)) continue; // mesma compra já listada por outro empenho
      usados.add(key);
      for (const i of itens) rows.push({ ...base(c), item: i });
    } else if (matchesAll(`${c.objeto} ${c.titulo}`, terms)) {
      rows.push({ ...base(c), item: null, itensIndisponiveis: itens === null });
    }
  }

  return { rows, proximaPagina: fim ? null : p, totalBusca, itensComErro };
}

const base = (c) => ({
  contratoId: c.id,
  titulo: c.titulo,
  objeto: c.objeto,
  orgao: c.orgao,
  unidade: c.unidade,
  municipio: c.municipio,
  microrregiao: c.microrregiao,
  esfera: c.esfera,
  modalidade: c.modalidade,
  tipo: c.tipo,
  fornecedor: c.fornecedor,
  valorGlobal: c.valorGlobal,
  assinadoEm: c.assinadoEm,
  link: c.link,
  linkCompra: c.compra ? `https://pncp.gov.br/app/editais/${c.compra.cnpj}/${c.compra.ano}/${c.compra.seq}` : null,
});

/** Menor, médio e maior preço unitário entre as linhas carregadas (homologado; se não houver, estimado) */
export function precoStats(rows) {
  const vals = [];
  for (const r of rows) {
    const v = r.item?.resultados?.find((x) => x.valorUnitario)?.valorUnitario ?? r.item?.valorUnitarioEstimado ?? null;
    if (v) vals.push(v);
  }
  if (!vals.length) return null;
  const soma = vals.reduce((a, b) => a + b, 0);
  return { menor: Math.min(...vals), medio: soma / vals.length, maior: Math.max(...vals), n: vals.length };
}
