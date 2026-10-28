// Planilha Excel dos editais abertos (abas Editais e Itens), usada em "Editais abertos" e "AGIL CNAE".
// Na aba Itens as informações do edital se repetem em cada linha (sem mesclar células), para filtrar e somar.
import { CATALOGO_POR_ID } from './catalogoCnae.js';

const nomeCnae = (id) => {
  const c = CATALOGO_POR_ID.get(id);
  return c ? `${c.rotulo} ${c.descricao}` : id;
};

/** "Pregão Eletrônico nº 90012/2025" -> "90012/2025" */
export const numeroDoEdital = (titulo) => String(titulo || '').match(/n[º°o.]*\s*(\d[\d.]*\s*\/\s*\d{4})/i)?.[1].replace(/\s+/g, '') || '';

/**
 * @param {any[]} editais  formato mapItem (pncp.js), com cnaes/termos na aba AGIL CNAE
 * @param {Map<string, { itens: any[] | null, erro?: string }>} itensPorId
 */
export function abasEditais(editais, itensPorId, { agil = false } = {}) {
  const situacaoItens = (e) => {
    const r = itensPorId.get(e.id);
    if (!e.compra) return 'Sem referência da compra no PNCP';
    if (!r) return 'Não consultado';
    if (r.erro || !r.itens) return 'PNCP não respondeu; consulte o edital';
    return r.itens.length ? '' : 'Nenhum item publicado';
  };
  const basicas = [
    { titulo: 'Nº controle PNCP', largura: 30 },
    { titulo: 'Modalidade', largura: 22 },
    { titulo: 'Nº do edital / pregão', largura: 16 },
    { titulo: 'Título', largura: 34 },
    { titulo: 'Órgão', largura: 38 },
    { titulo: 'Unidade', largura: 30 },
    { titulo: 'Município', largura: 20 },
    { titulo: 'Microrregião (Zona da Mata)', largura: 20 },
    { titulo: 'Objeto', largura: 70 },
    { titulo: 'Valor estimado', largura: 16, tipo: 'moeda' },
    { titulo: 'Data do pregão (fim das propostas)', largura: 18, tipo: 'dataHora' },
    { titulo: 'Publicado em', largura: 16, tipo: 'dataHora' },
    { titulo: 'Atualizado em', largura: 16, tipo: 'dataHora' },
    { titulo: 'Fonte (plataforma)', largura: 22 },
    { titulo: 'Local do pregão', largura: 26 },
    { titulo: 'Link do local do pregão', largura: 50 },
    ...(agil ? [{ titulo: 'CNAEs', largura: 40 }, { titulo: 'Termos encontrados no objeto', largura: 34 }] : []),
    { titulo: 'Qtde de itens', largura: 10, tipo: 'numero' },
    { titulo: 'Itens', largura: 30 },
    { titulo: 'Link no PNCP', largura: 50 },
    { titulo: 'Link na plataforma', largura: 50 },
  ];
  const linhasEditais = editais.map((e) => {
    const r = itensPorId.get(e.id);
    return [
      e.id,
      e.modalidade,
      numeroDoEdital(e.titulo),
      e.titulo,
      e.orgao,
      e.unidade,
      e.municipio,
      e.microrregiao || '',
      e.objeto,
      e.valor,
      e.propostasAte,
      e.publicadoEm,
      e.atualizadoEm,
      e.fonte || '',
      e.local || '',
      e.linkLocal || '',
      ...(agil ? [(e.cnaes || []).map(nomeCnae).join('; '), (e.termos || []).join(', ')] : []),
      r?.itens ? r.itens.length : null,
      situacaoItens(e),
      e.link,
      e.linkOrigem && /^https?:\/\//.test(e.linkOrigem) ? e.linkOrigem : '',
    ];
  });

  const colItens = [
    { titulo: 'Nº controle PNCP', largura: 30 },
    { titulo: 'Modalidade', largura: 22 },
    { titulo: 'Nº do edital / pregão', largura: 16 },
    { titulo: 'Órgão', largura: 38 },
    { titulo: 'Município', largura: 20 },
    { titulo: 'Data do pregão (fim das propostas)', largura: 18, tipo: 'dataHora' },
    { titulo: 'Local do pregão', largura: 26 },
    { titulo: 'Objeto', largura: 50 },
    { titulo: 'Nº do item', largura: 10, tipo: 'numero' },
    { titulo: 'Item', largura: 70 },
    { titulo: 'Quantidade', largura: 12, tipo: 'numero' },
    { titulo: 'Unidade', largura: 12 },
    { titulo: 'Valor unitário estimado', largura: 18, tipo: 'moeda' },
    { titulo: 'Valor total estimado', largura: 18, tipo: 'moeda' },
    { titulo: 'Situação do item', largura: 18 },
    { titulo: 'Link no PNCP', largura: 50 },
  ];
  const linhasItens = [];
  for (const e of editais) {
    const itens = itensPorId.get(e.id)?.itens || [];
    for (const it of itens) {
      const total = it.valorTotalEstimado ?? (it.quantidade != null && it.valorUnitarioEstimado != null ? Math.round(it.quantidade * it.valorUnitarioEstimado * 100) / 100 : null);
      linhasItens.push([
        e.id,
        e.modalidade,
        numeroDoEdital(e.titulo),
        e.orgao,
        e.municipio,
        e.propostasAte,
        e.local || '',
        e.objeto,
        it.numero ?? null,
        it.descricao,
        it.quantidade,
        it.unidade,
        it.valorUnitarioEstimado,
        total,
        it.situacao || '',
        e.link,
      ]);
    }
  }
  return [
    { nome: 'Editais', colunas: basicas, linhas: linhasEditais },
    { nome: 'Itens', colunas: colItens, linhas: linhasItens },
  ];
}
