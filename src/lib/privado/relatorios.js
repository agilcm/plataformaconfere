// Relatórios consolidados dos processos ganhos pela AGIL: planilhas (CSV para Excel) e blocos do PDF.

const brl = (v) => (v == null ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const moeda = (v) => (v == null ? '—' : `R$ ${brl(v)}`);
const qtd = (v) => (v == null ? '' : v.toLocaleString('pt-BR', { maximumFractionDigits: 4 }));

/** "2025-07-04T08:41:22" -> "04/07/2025 08:41" (sem hora: só a data) */
export function dataBR(iso, comHora = false) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}${comHora && m[4] ? ` ${m[4]}` : ''}`;
}

export const rotulo = (p) => `${String(Number(p.processo.numero)).padStart(3, '0')}/${p.processo.ano}`;
const edital = (p) => (p.edital ? `${p.modalidade} ${String(Number(p.edital.numero)).padStart(3, '0')}/${p.edital.ano}` : p.modalidade || '');
const conferencia = (p) => (p.conferido == null ? 'Sem itens no termo' : p.conferido ? 'Conferido' : 'Divergente');

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Produtos ganhos somados entre todos os processos (mesma descrição e unidade). */
export function consolidarProdutos(processos) {
  const m = new Map();
  for (const p of processos) {
    for (const it of p.itens) {
      const k = `${norm(it.descricao).slice(0, 140)}|${norm(it.medida)}`;
      if (!m.has(k)) m.set(k, { descricao: it.descricao, medida: it.medida, quantidade: 0, valor: 0, precos: [], processos: new Set(), orgaos: new Set(), marcas: new Set() });
      const g = m.get(k);
      g.quantidade += it.quantidade || 0;
      g.valor += it.subtotal || 0;
      if (it.unitario != null) g.precos.push(it.unitario);
      g.processos.add(`${p.orgao} ${rotulo(p)}`);
      g.orgaos.add(p.orgao);
      if (it.marca) g.marcas.add(it.marca);
    }
  }
  return [...m.values()]
    .map((g) => ({
      descricao: g.descricao,
      medida: g.medida,
      quantidade: Math.round(g.quantidade * 10000) / 10000,
      valor: Math.round(g.valor * 100) / 100,
      precoMin: g.precos.length ? Math.min(...g.precos) : null,
      precoMax: g.precos.length ? Math.max(...g.precos) : null,
      processos: g.processos.size,
      orgaos: [...g.orgaos],
      marcas: [...g.marcas],
    }))
    .sort((a, b) => b.valor - a.valor);
}

export function resumo(processos) {
  const total = processos.reduce((s, p) => s + (p.valorAgil || 0), 0);
  const porOrgao = new Map();
  const porAno = new Map();
  for (const p of processos) {
    const o = porOrgao.get(p.orgao) || { orgao: p.orgao, processos: 0, valor: 0, itens: 0 };
    o.processos++;
    o.valor += p.valorAgil || 0;
    o.itens += p.itens.length;
    porOrgao.set(p.orgao, o);
    const ano = p.processo.ano;
    porAno.set(ano, (porAno.get(ano) || 0) + (p.valorAgil || 0));
  }
  return {
    total: Math.round(total * 100) / 100,
    processos: processos.length,
    itens: processos.reduce((s, p) => s + p.itens.length, 0),
    orgaos: [...porOrgao.values()].sort((a, b) => b.valor - a.valor),
    anos: [...porAno.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([ano, valor]) => ({ ano, valor })),
    divergentes: processos.filter((p) => p.conferido === false).length,
  };
}

// ---------------------------------------------------------------- CSV (Excel em português: ";" e vírgula decimal)

const celula = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csv = (cab, linhas) => `﻿${[cab, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n')}\r\n`;

export function csvProcessos(processos) {
  return csv(
    ['Órgão', 'CNPJ do órgão', 'Processo', 'Modalidade / nº', 'Objeto', 'Data do pregão', 'Data do termo', 'Data do documento', 'Termo usado', 'Valor ganho pela AGIL (R$)', 'Estimado (R$)', 'Soma dos itens (R$)', 'Conferência', 'Itens', 'Arquivos', 'Pasta no Drive'],
    processos.map((p) => [
      p.orgao,
      p.cnpjOrgao,
      rotulo(p),
      edital(p),
      p.objeto,
      dataBR(p.dataPregao, true),
      dataBR(p.dataTermo, true),
      dataBR(p.dataDocumento),
      p.termoUsado === 'homologacao' ? 'Homologação' : 'Adjudicação',
      brl(p.valorAgil),
      brl(p.estimadoAgil),
      brl(p.somaItens),
      conferencia(p),
      p.itens.length,
      p.termos.map((t) => t.nome).join(' | '),
      p.pasta?.link || '',
    ]),
  );
}

export function csvItens(processos) {
  return csv(
    ['Órgão', 'Processo', 'Modalidade / nº', 'Data do termo', 'Lote', 'Descrição do item', 'Quantidade', 'Unidade', 'Valor unitário (R$)', 'Valor total (R$)', 'Marca', 'Fabricante', 'Modelo', 'Conferir'],
    processos.flatMap((p) =>
      p.itens.map((it) => [
        p.orgao,
        rotulo(p),
        edital(p),
        dataBR(it.data || p.dataTermo, true),
        it.lote,
        it.descricao,
        qtd(it.quantidade),
        it.medida,
        brl(it.unitario),
        brl(it.subtotal),
        it.marca,
        it.fabricante,
        it.modelo,
        it.conferir ? 'Quantidade × unitário não bate com o total' : '',
      ]),
    ),
  );
}

export function csvProdutos(processos) {
  return csv(
    ['Produto', 'Unidade', 'Quantidade total', 'Valor total (R$)', 'Menor preço (R$)', 'Maior preço (R$)', 'Processos', 'Órgãos', 'Marcas'],
    consolidarProdutos(processos).map((g) => [g.descricao, g.medida, qtd(g.quantidade), brl(g.valor), brl(g.precoMin), brl(g.precoMax), g.processos, g.orgaos.join(', '), g.marcas.join(', ')]),
  );
}

export function csvPendencias(pendencias, avisos = []) {
  return csv(
    ['Pasta / arquivo', 'Problema', 'Link'],
    [...pendencias.map((p) => [p.nome, p.motivo, p.link || '']), ...avisos.map((a) => [a.nome, a.motivo, a.link || ''])],
  );
}

// ---------------------------------------------------------------- PDF (blocos de pdfReport.ts)

const corta = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function blocosRelatorio(processos, pendencias, { dataText }) {
  const r = resumo(processos);
  const b = [
    { type: 'date', text: dataText },
    { type: 'title', text: 'Relatório consolidado de licitações ganhas' },
    { type: 'para', text: `AGIL CM Produtos Alimentícios LTDA · total ganho ${moeda(r.total)}`, bold: true, gapAfter: 2 },
    { type: 'para', text: `${r.processos} processos homologados ou adjudicados · ${r.itens} itens`, gapAfter: 10 },
  ];
  if (pendencias.length) {
    b.push({ type: 'note', text: `${pendencias.length} pasta(s) sem termo de homologação ou adjudicação: ${pendencias.map((p) => p.nome).join('; ')}.` });
  }
  b.push({ type: 'heading', text: 'Por órgão' });
  b.push({
    type: 'table',
    widths: [0.58, 0.14, 0.28],
    header: ['Órgão', 'Processos', 'Valor ganho'],
    headerAlign: ['left', 'center', 'right'],
    rows: [
      ...r.orgaos.map((o) => [o.orgao, { text: String(o.processos), align: 'center' }, { text: moeda(o.valor), align: 'right' }]),
      [{ text: 'Total', bold: true }, { text: String(r.processos), align: 'center', bold: true }, { text: moeda(r.total), align: 'right', bold: true }],
    ],
    totalRows: 1,
  });
  b.push({ type: 'heading', text: 'Processos' });
  b.push({
    type: 'table',
    widths: [0.3, 0.14, 0.16, 0.14, 0.26],
    header: ['Órgão', 'Processo', 'Modalidade', 'Termo', 'Valor ganho'],
    headerAlign: ['left', 'center', 'left', 'center', 'right'],
    rows: processos.map((p) => [
      p.orgao,
      { text: rotulo(p), align: 'center' },
      edital(p),
      { text: dataBR(p.dataTermo), align: 'center' },
      { text: `${moeda(p.valorAgil)}${p.conferido === false ? ' (!)' : ''}`, align: 'right' },
    ]),
  });
  const prods = consolidarProdutos(processos);
  if (prods.length) {
    b.push({ type: 'heading', text: 'Produtos ganhos (somados entre os processos)' });
    b.push({
      type: 'table',
      widths: [0.5, 0.14, 0.14, 0.22],
      header: ['Produto', 'Qtde', 'Processos', 'Valor total'],
      headerAlign: ['left', 'right', 'center', 'right'],
      rows: prods.map((g) => [corta(g.descricao, 160), { text: `${qtd(g.quantidade)} ${g.medida}`.trim(), align: 'right' }, { text: String(g.processos), align: 'center' }, { text: moeda(g.valor), align: 'right' }]),
    });
  }
  for (const p of processos) {
    if (!p.itens.length) continue;
    b.push({ type: 'heading', text: `${p.orgao} · Processo ${rotulo(p)}` });
    b.push({
      type: 'para',
      text: `${edital(p)}${p.dataPregao ? ` · pregão em ${dataBR(p.dataPregao, true)}` : ''} · termo de ${p.termoUsado === 'homologacao' ? 'homologação' : 'adjudicação'} em ${dataBR(p.dataTermo, true)}${p.objeto ? ` · ${corta(p.objeto, 220)}` : ''}`,
      size: 9,
      color: 'muted',
    });
    b.push({
      type: 'table',
      widths: [0.08, 0.44, 0.14, 0.14, 0.2],
      header: ['Lote', 'Item', 'Qtde', 'Unitário', 'Total'],
      headerAlign: ['center', 'left', 'right', 'right', 'right'],
      rows: [
        ...p.itens.map((it) => [
          { text: it.lote || '', align: 'center' },
          corta(`${it.descricao}${it.marca ? ` (marca ${it.marca})` : ''}`, 200),
          { text: `${qtd(it.quantidade)} ${it.medida}`.trim(), align: 'right' },
          { text: moeda(it.unitario), align: 'right' },
          { text: moeda(it.subtotal), align: 'right' },
        ]),
        [{ text: '' }, { text: 'Total do processo', bold: true }, { text: '' }, { text: '' }, { text: moeda(p.valorAgil ?? p.somaItens), align: 'right', bold: true }],
      ],
      totalRows: 1,
    });
  }
  return b;
}
