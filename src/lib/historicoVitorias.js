// Histórico do que a AGIL já ganhou (vem da área Privado) guardado neste navegador.
// A Super Sugestão da aba AGIL CNAE usa esse histórico. Há também um histórico padrão do sistema
// (src/data/historicoPadrao.json, exportado do Privado), carregado só quando a Super Sugestão abre.

const CHAVE = 'agilcm:historico-vitorias';

/** "Prefeitura Municipal de Astolfo Dutra" -> "Astolfo Dutra" */
export function cidadeDoOrgao(orgao) {
  const s = String(orgao || '').trim();
  const m =
    s.match(/(?:municipal|munic[ií]pio|saaed?|esgoto|autarquia|cons[oó]rcio|fundo|instituto)\b.*?\s+d[eoa]s?\s+(.+)$/i) || s.match(/\s+d[eoa]s?\s+([^,]+)$/i);
  return (m ? m[1] : s).replace(/\s*[-/]\s*MG$/i, '').trim();
}

export function salvarHistorico(processos, situacaoDe) {
  const dados = {
    atualizadoEm: new Date().toISOString(),
    processos: processos.map((p) => ({
      orgao: p.orgao,
      cidade: cidadeDoOrgao(p.orgao),
      processo: `${String(Number(p.processo.numero)).padStart(3, '0')}/${p.processo.ano}`,
      data: p.dataHomologacao || p.dataTermo || null,
      situacao: situacaoDe ? situacaoDe(p) : '',
      itens: p.itens.map((i) => ({ descricao: i.descricao, quantidade: i.quantidade, medida: i.medida, unitario: i.unitario })),
    })),
  };
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

const CHAVE_FONTE = 'agilcm:historico-fonte';
/** Qual histórico a Super Sugestão usa: o padrão do sistema (padrão) ou o existente neste navegador. */
export function lerFonte() {
  try {
    return localStorage.getItem(CHAVE_FONTE) === 'local' ? 'local' : 'padrao';
  } catch {
    return 'padrao';
  }
}
export function gravarFonte(fonte) {
  try {
    localStorage.setItem(CHAVE_FONTE, fonte);
  } catch {
    /* sem armazenamento: volta ao padrão na próxima visita */
  }
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
