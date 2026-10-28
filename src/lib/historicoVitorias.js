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
