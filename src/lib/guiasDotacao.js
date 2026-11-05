// Dona Euzébia · guias de INSS separadas: FUNDEB e o restante.
// Lê o relatório "Detalhamento de Guias por Dotação" do SiplanWeb (uma página por centro de custo) e calcula
// a guia do FUNDEB sem as deduções de salário-família e salário-maternidade; o restante = guia original − FUNDEB.
// Funções puras: recebem as linhas do PDF já lidas (lib/privado/pdfTexto.js).

/** "70.055,75" → 70055.75 */
export const numeroBR = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
export const centavos = (v) => Math.round((Number(v) || 0) * 100) / 100 || 0; // || 0: nunca "-0"

const ROTULOS = {
  base: 'Empresa Total',
  segurados: 'Segurado (Empregados)',
  autonomos: 'Contrib. Individuais (Autônomos)',
  autonomosTransporte: 'Contrib. Individuais (Aut. Transporte)',
  patronal: 'Empresa + (AcdTrab x FAP)',
  salarioFamilia: 'Deduções FPAS (Sal. Família/Aux. Nat.)',
  maternidade: 'Deduções FPAS (Sal. Maternidade)',
  maternidade13: 'Deduções FPAS (13º Sal. Maternidade)',
  acumuladoDeducoes: 'Acumulado Deduções',
  compensado: 'Valor Compensado',
  liquido: 'Total Líquido da GPS',
  irrf: 'I. R. s/ Folha',
};

/**
 * Valor que vem logo depois do rótulo na linha (as duas colunas do relatório saem na mesma linha).
 * Pula o que estiver entre parênteses depois do rótulo, como "(16,40 + 3,3840)".
 */
function valorDe(textos, rotulo, ocorrencia = 0) {
  let n = -1;
  for (const t of textos) {
    const i = t.indexOf(rotulo);
    if (i < 0) continue;
    if (++n < ocorrencia) continue;
    const resto = t.slice(i + rotulo.length).replace(/^\s*(\([^)]*\)\s*)*/, '');
    const m = resto.match(/^\s*\*?\s*(-?[\d.]+,\d{2})/);
    return m ? numeroBR(m[1]) : 0;
  }
  return 0;
}

/** "Fundeb-2." → { nome: "Fundeb", codigo: "2" } */
function separarCodigo(s) {
  const t = String(s || '')
    .trim()
    .replace(/\.$/, '');
  const m = t.match(/^(.*?)-\s*(\d+)$/);
  return m ? { nome: m[1].trim(), codigo: m[2] } : { nome: t, codigo: '' };
}

/** As linhas de cada página do PDF, em texto */
function porPagina(linhas) {
  const paginas = new Map();
  for (const l of linhas) {
    const p = l.pagina ?? 0;
    if (!paginas.has(p)) paginas.set(p, []);
    paginas.get(p).push(l.texto ?? String(l));
  }
  return [...paginas.entries()].sort((a, b) => a[0] - b[0]);
}

/**
 * Centros de custo do relatório (uma página cada).
 * @param {{ texto: string, pagina: number }[]} linhas
 */
export function lerDetalhamento(linhas) {
  const centros = [];
  let prefeitura = '';
  for (const [pagina, textos] of porPagina(linhas)) {
    const cab = textos.join(' ').match(/Depart\.:\s*(.+?)\s+C\. Custo:\s*(.+?)\s+Compet\.:\s*([^\s]+)/);
    if (!cab) continue;
    prefeitura ||= (textos.find((t) => /PREFEITURA|MUNIC[IÍ]PIO/i.test(t)) || '').replace(/\s+P[áa]gina\(s\).*$/i, '').trim();
    const v = Object.fromEntries(Object.entries(ROTULOS).map(([k, r]) => [k, valorDe(textos, r)]));
    const dep = separarCodigo(cab[1]);
    const cc = separarCodigo(cab[2]);
    // segurados de competências anteriores (segunda linha "Segurado (Empregados)")
    const seguradosAnteriores = valorDe(textos, ROTULOS.segurados, 1);
    const aliquota = (textos.join(' ').match(/AcdTrab x FAP\)\s*\(([^)]*)\)/) || [])[1] || '';
    const deducoes = centavos(v.salarioFamilia + v.maternidade + v.maternidade13);
    // a guia sem as deduções de salário-família e maternidade
    const valorGuia = centavos(v.liquido + deducoes);
    centros.push({
      pagina: pagina + 1,
      departamento: dep.nome,
      depCodigo: dep.codigo,
      centro: cc.nome,
      ccCodigo: cc.codigo,
      competencia: cab[3].replace(/\.$/, ''),
      aliquota,
      base: v.base,
      segurados: centavos(v.segurados + seguradosAnteriores),
      patronal: v.patronal,
      outros: centavos(valorGuia - v.segurados - seguradosAnteriores - v.patronal),
      salarioFamilia: v.salarioFamilia,
      maternidade: centavos(v.maternidade + v.maternidade13),
      acumuladoDeducoes: v.acumuladoDeducoes,
      compensado: v.compensado,
      liquido: v.liquido,
      irrf: v.irrf,
      valorGuia,
    });
  }
  return { prefeitura, centros };
}

/**
 * Valor total de uma guia que não é o detalhamento (DARF/GPS), para preencher a "guia original".
 * Procura "Valor Total do Documento", "Total a Recolher" ou "Valor Total"; devolve null se não achar.
 */
export function valorDaGuia(linhas) {
  const textos = linhas.map((l) => l.texto ?? String(l));
  for (const re of [/valor\s+total\s+do\s+documento/i, /total\s+a\s+recolher/i, /valor\s+total/i, /total\s+a\s+pagar/i]) {
    for (let i = 0; i < textos.length; i++) {
      if (!re.test(textos[i])) continue;
      const aqui = textos[i].slice(textos[i].search(re)).match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
      const proxima = (textos[i + 1] || '').match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);
      const m = aqui || proxima;
      if (m) return numeroBR(m[1]);
    }
  }
  return null;
}

/** Junta os centros de vários PDFs (a mesma página enviada duas vezes conta uma vez só) */
export function juntarCentros(listas) {
  const vistos = new Map();
  for (const c of listas.flat()) vistos.set(`${c.departamento}|${c.depCodigo}|${c.centro}|${c.ccCodigo}|${c.competencia}`, c);
  return [...vistos.values()];
}

export const ehFundeb = (departamento) => /fundeb/i.test(departamento);

const somar = (lista, campo) => centavos(lista.reduce((s, c) => s + (Number(c[campo]) || 0), 0));
export function totais(lista) {
  return Object.fromEntries(
    ['base', 'segurados', 'patronal', 'outros', 'salarioFamilia', 'maternidade', 'liquido', 'valorGuia', 'irrf'].map((k) => [k, somar(lista, k)]),
  );
}

/**
 * As duas guias.
 * @param {any[]} centros  de lerDetalhamento/juntarCentros
 * @param {Set<string>} departamentosFundeb  nomes de departamento que vão para a guia do FUNDEB
 * @param {number|null} guiaOriginal  valor total da guia original (o que a prefeitura pagaria numa guia só)
 */
export function separarGuias(centros, departamentosFundeb, guiaOriginal) {
  const fundeb = centros.filter((c) => departamentosFundeb.has(c.departamento));
  const outros = centros.filter((c) => !departamentosFundeb.has(c.departamento));
  const tf = totais(fundeb);
  const to = totais(outros);
  const original = guiaOriginal == null || !Number.isFinite(guiaOriginal) ? null : centavos(guiaOriginal);
  return {
    fundeb,
    outros,
    totalFundeb: tf,
    totalOutros: to,
    guiaFundeb: tf.valorGuia,
    guiaOriginal: original,
    guiaRestante: original == null ? null : centavos(original - tf.valorGuia),
    // deduções que não entram na guia do FUNDEB: ficam (abatidas) na guia do restante
    deducoesForaDoFundeb: centavos(tf.salarioFamilia + tf.maternidade),
  };
}

/** Departamentos encontrados, com quantos centros e o valor de cada um */
export function departamentos(centros) {
  const m = new Map();
  for (const c of centros) {
    const d = m.get(c.departamento) || { nome: c.departamento, codigo: c.depCodigo, centros: 0, valorGuia: 0 };
    d.centros++;
    d.valorGuia = centavos(d.valorGuia + c.valorGuia);
    m.set(c.departamento, d);
  }
  return [...m.values()];
}

// ---------------------------------------------------------------- planilha de referência e PDF

const COLUNAS_CENTROS = [
  { titulo: 'Departamento', largura: 16 },
  { titulo: 'Centro de custo', largura: 40 },
  { titulo: 'Base INSS', tipo: 'moeda', largura: 16 },
  { titulo: 'Segurados', tipo: 'moeda', largura: 15 },
  { titulo: 'Patronal (20% + RAT×FAP)', tipo: 'moeda', largura: 24 },
  { titulo: 'Outros valores da GPS', tipo: 'moeda', largura: 20 },
  { titulo: 'Salário-família (desconsiderado)', tipo: 'moeda', largura: 28 },
  { titulo: 'Salário-maternidade (desconsiderado)', tipo: 'moeda', largura: 32 },
  { titulo: 'Total líquido no relatório', tipo: 'moeda', largura: 24 },
  { titulo: 'Valor para a guia', tipo: 'moeda', largura: 18 },
];

const temValor = (c) => c.valorGuia || c.base || c.liquido || c.salarioFamilia || c.maternidade;

/** Aba de centros: dados do relatório + fórmulas (valor para a guia = líquido + deduções; outros = guia − segurados − patronal) e a linha de total */
function abaCentros(nome, lista) {
  const linhas = lista.filter(temValor).map((c, i) => {
    const r = i + 2;
    return [
      c.departamento,
      `${c.centro}${c.ccCodigo ? ` (${c.ccCodigo})` : ''}`,
      c.base,
      c.segurados,
      c.patronal,
      { f: `J${r}-D${r}-E${r}` },
      c.salarioFamilia,
      c.maternidade,
      c.liquido,
      { f: `I${r}+G${r}+H${r}` },
    ];
  });
  const ultima = linhas.length + 1;
  const total = ultima + 1;
  linhas.push([
    'Total',
    `${linhas.length} centros com valor`,
    ...['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].map((col) => ({ f: ultima >= 2 ? `SUM(${col}2:${col}${ultima})` : '0' })),
  ]);
  return { aba: { nome, colunas: COLUNAS_CENTROS, linhas }, total };
}

/**
 * Abas do Excel de referência: Resumo (guia original, FUNDEB e restante em fórmulas), FUNDEB e, se houver, Restante.
 * @param {ReturnType<typeof separarGuias>} g
 * @param {{ competencia: string, prefeitura: string, origemOriginal?: string }} info
 */
export function abasReferencia(g, info) {
  const f = abaCentros('FUNDEB', g.fundeb);
  const abas = [f.aba];
  const t = f.total;
  const resumo = [
    ['Prefeitura', info.prefeitura || '', ''],
    ['Competência', info.competencia || '', ''],
    ['Guia original (valor total)', g.guiaOriginal ?? '', info.origemOriginal || 'Digite aqui o valor da guia original, se ainda não estiver preenchido'],
    ['Guia do FUNDEB', { f: `FUNDEB!J${t}` }, 'Segurados + patronal dos centros do FUNDEB, sem salário-família e salário-maternidade (aba FUNDEB)'],
    ['Guia do restante', { f: 'IF(B4="","",B4-B5)' }, 'Guia original menos a guia do FUNDEB'],
    ['Segurados do FUNDEB', { f: `FUNDEB!D${t}` }, ''],
    ['Patronal do FUNDEB (20% + RAT×FAP)', { f: `FUNDEB!E${t}` }, ''],
    ['Salário-família desconsiderado no FUNDEB', { f: `FUNDEB!G${t}` }, 'Fica abatido na guia do restante'],
    ['Salário-maternidade desconsiderado no FUNDEB', { f: `FUNDEB!H${t}` }, 'Fica abatido na guia do restante'],
  ];
  if (g.outros.some(temValor)) {
    const o = abaCentros('Restante', g.outros);
    abas.push(o.aba);
    resumo.push([
      'Restante calculado pelo relatório (conferência)',
      { f: `Restante!I${o.total}` },
      'Total líquido dos outros departamentos; deve bater com a guia do restante quando a guia original é a soma de tudo',
    ]);
  }
  abas.unshift({
    nome: 'Resumo',
    colunas: [
      { titulo: 'Item', largura: 46 },
      { titulo: 'Valor', tipo: 'moeda', largura: 18 },
      { titulo: 'Como chegou nesse valor', largura: 90 },
    ],
    linhas: resumo,
  });
  return abas;
}

const brl = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

/** Blocos do relatório em PDF (layout Ágil CM, lib/pdfReport.ts) */
export function blocosPdfGuias(g, info) {
  const linhasCentros = (lista) =>
    lista
      .filter(temValor)
      .map((c) => [
        `${c.centro}${c.ccCodigo ? ` (${c.ccCodigo})` : ''}`,
        { text: brl(c.segurados), align: 'right' },
        { text: brl(c.patronal), align: 'right' },
        { text: brl(c.salarioFamilia + c.maternidade), align: 'right' },
        { text: brl(c.valorGuia), align: 'right', bold: true },
      ]);
  const tf = g.totalFundeb;
  const blocos = [
    { type: 'title', text: 'Guias de INSS: FUNDEB e restante' },
    { type: 'para', text: `${info.prefeitura || 'Prefeitura'} · competência ${info.competencia || '—'}`, color: 'muted' },
    {
      type: 'table',
      widths: [3, 1.4],
      header: ['Guia', 'Valor'],
      headerAlign: ['left', 'right'],
      rows: [
        ['Guia original (valor total)', { text: brl(g.guiaOriginal), align: 'right' }],
        ['Guia do FUNDEB (sem salário-família e maternidade)', { text: brl(g.guiaFundeb), align: 'right', bold: true }],
        ['Guia do restante (original - FUNDEB)', { text: brl(g.guiaRestante), align: 'right', bold: true }],
      ],
    },
    {
      type: 'note',
      text: `Guia do FUNDEB = segurados ${brl(tf.segurados)} + patronal ${brl(tf.patronal)}${tf.outros ? ` + outros ${brl(tf.outros)}` : ''}. Salário-família (${brl(tf.salarioFamilia)}) e salário-maternidade (${brl(tf.maternidade)}) dos centros do FUNDEB não foram abatidos: ficam na guia do restante.`,
    },
    { type: 'heading', text: 'Centros de custo do FUNDEB' },
    {
      type: 'table',
      widths: [3.2, 1.3, 1.3, 1.3, 1.4],
      header: ['Centro de custo', 'Segurados', 'Patronal', 'Deduções (fora)', 'Valor para a guia'],
      headerAlign: ['left', 'right', 'right', 'right', 'right'],
      rows: [
        ...linhasCentros(g.fundeb),
        [
          { text: 'Total', bold: true },
          { text: brl(tf.segurados), align: 'right', bold: true },
          { text: brl(tf.patronal), align: 'right', bold: true },
          { text: brl(tf.salarioFamilia + tf.maternidade), align: 'right', bold: true },
          { text: brl(tf.valorGuia), align: 'right', bold: true },
        ],
      ],
      totalRows: 1,
      size: 8.5,
    },
  ];
  return blocos;
}
