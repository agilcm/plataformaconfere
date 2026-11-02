// Histórico do que a AGIL já ganhou, usado pela Super Sugestão (aba AGIL CNAE). Três origens, e vale a mais recente:
//   - a leitura da pasta do Privado que o GitHub publica com o site a cada 3 horas (privado/leitura.json);
//   - o guardado neste navegador (ao abrir o Privado ou importar um cache);
//   - o histórico embutido no site (src/data/historicoPadrao.json), se as outras não estiverem disponíveis.
import { vigencia } from './privado/relatorios.js';

const CHAVE = 'agilcm:historico-vitorias';

/** "Prefeitura Municipal de Astolfo Dutra" -> "Astolfo Dutra" */
export function cidadeDoOrgao(orgao) {
  const s = String(orgao || '').trim();
  const m =
    s.match(/(?:municipal|munic[ií]pio|saaed?|esgoto|autarquia|cons[oó]rcio|fundo|instituto)\b.*?\s+d[eoa]s?\s+(.+)$/i) || s.match(/\s+d[eoa]s?\s+([^,]+)$/i);
  return (m ? m[1] : s).replace(/\s*[-/]\s*MG$/i, '').trim();
}

/** Histórico no formato do cache a partir dos processos lidos no Privado */
export function historicoDeProcessos(processos, situacaoDe, atualizadoEm = new Date().toISOString()) {
  return {
    atualizadoEm,
    processos: processos.map((p) => ({
      orgao: p.orgao,
      cidade: cidadeDoOrgao(p.orgao),
      processo: `${String(Number(p.processo.numero)).padStart(3, '0')}/${p.processo.ano}`,
      data: p.dataHomologacao || p.dataTermo || null,
      situacao: situacaoDe ? situacaoDe(p) : '',
      itens: p.itens.map((i) => ({ descricao: i.descricao, quantidade: i.quantidade, medida: i.medida, unitario: i.unitario })),
    })),
  };
}

export function salvarHistorico(processos, situacaoDe) {
  const dados = historicoDeProcessos(processos, situacaoDe);
  try {
    localStorage.setItem(CHAVE, JSON.stringify(dados));
  } catch {
    /* sem armazenamento: a Super Sugestão pede para abrir o Privado de novo */
  }
}

/** @returns {{ atualizadoEm: string, processos: any[] } | null} */
export function lerHistorico() {
  try {
    const d = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    return d && Array.isArray(d.processos) ? d : null;
  } catch {
    return null;
  }
}

const FORMATO = 'agilcm-historico-vitorias';

/** Conteúdo do arquivo de cache para baixar (JSON) */
export function exportarHistorico(dados = lerHistorico()) {
  if (!dados) return null;
  return JSON.stringify({ formato: FORMATO, versao: 1, ...dados }, null, 1);
}

const texto = (v, n = 2000) => (typeof v === 'string' ? v.slice(0, n) : '');
const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Lê um arquivo de cache baixado do Privado, confere o formato e guarda neste navegador.
 * @returns {{ atualizadoEm: string, processos: any[] }}
 */
export function importarHistorico(conteudo) {
  let d;
  try {
    d = JSON.parse(conteudo);
  } catch {
    throw new Error('O arquivo não é um cache da área Privado (JSON inválido).');
  }
  const dados = normalizarHistorico(d);
  try {
    localStorage.setItem(CHAVE, JSON.stringify(dados));
  } catch {
    throw new Error('O navegador não deixou guardar o cache (armazenamento cheio ou bloqueado).');
  }
  return dados;
}

/** Confere o formato do cache e fica só com os campos conhecidos, com o tipo certo. */
export function normalizarHistorico(d) {
  if (!d || d.formato !== FORMATO || !Array.isArray(d.processos)) throw new Error('O arquivo não é um cache da área Privado.');
  const dados = {
    atualizadoEm: texto(d.atualizadoEm, 40) || new Date().toISOString(),
    processos: d.processos.slice(0, 5000).map((p) => ({
      orgao: texto(p?.orgao, 300),
      cidade: texto(p?.cidade, 200),
      processo: texto(p?.processo, 40),
      data: texto(p?.data, 40) || null,
      situacao: ['vigente', 'vencendo', 'vencido', 'sem-data'].includes(p?.situacao) ? p.situacao : '',
      itens: (Array.isArray(p?.itens) ? p.itens : []).slice(0, 2000).map((i) => ({
        descricao: texto(i?.descricao),
        quantidade: numero(i?.quantidade),
        medida: texto(i?.medida, 40),
        unitario: numero(i?.unitario),
      })),
    })),
  };
  if (!dados.processos.length) throw new Error('O cache não tem nenhum processo.');
  return dados;
}

/** Histórico padrão do sistema (arquivo do site, carregado sob demanda). */
export async function historicoPadrao() {
  const m = await import('../data/historicoPadrao.json');
  return normalizarHistorico(m.default);
}

/** Leitura do Privado publicada pelo GitHub (sem login), convertida para o formato do histórico */
export async function historicoPublicado(fetchImpl = fetch) {
  const base = import.meta.env?.BASE_URL || '/';
  const r = await fetchImpl(`${base}privado/leitura.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`leitura do Privado indisponível (${r.status})`);
  const l = await r.json();
  if (!Array.isArray(l?.resultado?.processos) || !l.resultado.processos.length) throw new Error('leitura do Privado vazia');
  return historicoDeProcessos(l.resultado.processos, (p) => vigencia(p).situacao, l.atualizadoEm);
}

/**
 * O histórico mais recente entre a leitura do Privado, o deste navegador e o embutido no site.
 * @returns {Promise<{ dados: { atualizadoEm: string, processos: any[] }, origem: 'privado' | 'navegador' | 'sistema' } | null>}
 */
export async function carregarHistorico() {
  const [publicado, padrao] = await Promise.allSettled([historicoPublicado(), historicoPadrao()]);
  const opcoes = [
    publicado.status === 'fulfilled' ? { dados: publicado.value, origem: 'privado' } : null,
    lerHistorico() ? { dados: lerHistorico(), origem: 'navegador' } : null,
    padrao.status === 'fulfilled' ? { dados: padrao.value, origem: 'sistema' } : null,
  ].filter(Boolean);
  if (!opcoes.length) return null;
  return opcoes.reduce((a, b) => (String(b.dados.atualizadoEm) > String(a.dados.atualizadoEm) ? b : a));
}

/** Baixa o cache como arquivo .json */
export function baixarHistorico(dados = lerHistorico()) {
  const conteudo = exportarHistorico(dados);
  if (!conteudo) return false;
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `agil-historico-licitacoes-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
