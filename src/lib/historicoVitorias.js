// Histórico do que a AGIL já ganhou (vem da área Privado) guardado neste navegador.
// A Super Sugestão da aba AGIL CNAE usa esse histórico; os dados nunca vão para o código do site.

const CHAVE = 'agilcm:historico-vitorias';

/** "Prefeitura Municipal de Astolfo Dutra" -> "Astolfo Dutra" */
export function cidadeDoOrgao(orgao) {
  const s = String(orgao || '').trim();
  const m = s.match(/(?:municipal|munic[ií]pio|saaed?|esgoto|autarquia|cons[oó]rcio|fundo|instituto)\b.*?\s+d[eoa]s?\s+(.+)$/i) || s.match(/\s+d[eoa]s?\s+([^,]+)$/i);
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
  if (!d || d.formato !== FORMATO || !Array.isArray(d.processos)) throw new Error('O arquivo não é um cache da área Privado.');
  // só os campos conhecidos, com o tipo certo
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
  try {
    localStorage.setItem(CHAVE, JSON.stringify(dados));
  } catch {
    throw new Error('O navegador não deixou guardar o cache (armazenamento cheio ou bloqueado).');
  }
  return dados;
}

/** Baixa o cache como arquivo .json */
export function baixarHistorico() {
  const conteudo = exportarHistorico();
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
