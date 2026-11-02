// Super Sugestão Google: para cada edital sugerido pela Super Sugestão (com base no cache de vitórias),
// procura os itens do edital nas planilhas de custo da Ágil (Google Drive) e monta um CSV com
// o item, o valor estimado pelo órgão e o preço de compra encontrado (marca, link e origem).
import { buscarNaBase } from './privado/baseCustos.js';

const ALERTA = { forte: 'Mesmo produto na mesma cidade', media: 'Mesma categoria na mesma cidade', fraca: 'Mesmo produto em outra cidade' };

/**
 * Uma linha por item de edital sugerido.
 * @param {any[]} sugestoes resultado de superSugestao()
 * @param {Map<string, any[]>} itensPorEdital itens de cada edital (id do edital → itens do PNCP)
 * @param {any[]} base base de custos indexada (indexar())
 */
export function linhasSuperGoogle(sugestoes, itensPorEdital, base) {
  const out = [];
  for (const s of sugestoes) {
    const e = s.edital;
    const itens = itensPorEdital.get(e.id) || [];
    const comum = { alerta: ALERTA[s.nivel] || '', orgao: e.orgao, cidade: e.municipio, objeto: e.objeto, propostasAte: e.propostasAte, link: e.link };
    if (!itens.length) {
      out.push({
        ...comum,
        item: '',
        descricao: '(o PNCP não entregou os itens deste edital)',
        quantidade: null,
        unidade: '',
        valorUnitario: e.valor ?? null,
        achado: null,
        confiavel: false,
      });
      continue;
    }
    for (const it of itens) {
      const termo = { produto: it.descricao, especificacao: '', descricao: it.descricao, valorTermo: it.valorUnitarioEstimado ?? null };
      const r = buscarNaBase(termo, base);
      // sem cotação confiável, sugere a mais parecida para conferir
      const achado = r.confiavel ? r.melhor : r.melhor || r.alternativas[0] || null;
      out.push({
        ...comum,
        item: it.numero,
        descricao: it.descricao,
        quantidade: it.quantidade,
        unidade: it.unidade,
        valorUnitario: it.valorUnitarioEstimado ?? null,
        achado,
        confiavel: r.confiavel,
      });
    }
  }
  return out;
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? String(Math.round(v * 100) / 100).replace('.', ',') : '');
const dataHora = (s) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  return m ? `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` ${m[4]}:${m[5]}` : ''}` : '';
};
const campo = (v) => {
  const t = String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export const CABECALHO_CSV = [
  'Alerta',
  'Órgão do edital',
  'Cidade',
  'Objeto do edital',
  'Propostas até',
  'Link do edital (PNCP)',
  'Item',
  'Descrição do item',
  'Quantidade',
  'Unidade',
  'Valor unitário estimado (edital)',
  'Valor total estimado',
  'Nas planilhas Google',
  'Preço de compra',
  'Marca',
  'Link de referência',
  'Planilha › aba',
  'Aderência (%)',
  'Diferença estimado × compra (%)',
];

/** CSV para o Excel brasileiro: separador ";", vírgula decimal e BOM UTF-8. */
export function csvSuperGoogle(linhas) {
  const rows = linhas.map((l) => {
    const a = l.achado;
    const total = l.valorUnitario != null && l.quantidade != null ? l.valorUnitario * l.quantidade : null;
    const dif = a && l.valorUnitario ? (l.valorUnitario / a.compra - 1) * 100 : null;
    return [
      l.alerta,
      l.orgao,
      l.cidade,
      l.objeto,
      dataHora(l.propostasAte),
      l.link,
      l.item,
      l.descricao,
      num(l.quantidade),
      l.unidade,
      num(l.valorUnitario),
      num(total),
      a ? (l.confiavel ? 'Sim' : 'Conferir') : 'Não',
      a ? num(a.compra) : '',
      a?.marca || '',
      a ? a.link || a.referencia || '' : '',
      a ? `${a.arquivo} › ${a.aba}` : '',
      a ? String(Math.round(a.aderencia * 100)) : '',
      num(dif),
    ]
      .map(campo)
      .join(';');
  });
  return `﻿${[CABECALHO_CSV.join(';'), ...rows].join('\r\n')}\r\n`;
}
