// Dona Euzébia · guias de INSS separadas: FUNDEB e o restante.
// Lê o relatório "Detalhamento de Guias por Dotação" do SiplanWeb (uma página por centro de custo) e calcula
// a guia do FUNDEB sem as deduções de salário-família e salário-maternidade; o restante = guia original − FUNDEB.
// Funções puras: recebem as linhas do PDF já lidas (lib/privado/pdfTexto.js).

/** "70.055,75" → 70055.75 */
export const numeroBR = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
export const centavos = (v) => Math.round((Number(v) || 0) * 100) / 100 || 0; // || 0: nunca "-0"

const ROTULOS = {
  base: 'Empresa Total',
  baseTributavel: 'Empresa Tributável Patronal',
  segurados: 'Segurado (Empregados)',
  autonomos: 'Contrib. Individuais (Autônomos)',
  autonomosTransporte: 'Contrib. Individuais (Aut. Transporte)',
  conselheiros: 'Contrib. Individuais (Conselheiros Tutelares)',
  patronalAutonomos: 'Percentual Autônomos',
  patronalAutonomosTransporte: 'Percentual Autônomos - Transporte',
  patronalConselheiros: 'Percentual Conselheiros Tutelares',
  extraRat: 'Percentual Extra Aliq. RAT',
  nocivo15: 'RAT Agente Nocivo 12%',
  nocivo20: 'RAT Agente Nocivo 9%',
  nocivo25: 'RAT Agente Nocivo 6%',
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
    // "Empresa + (AcdTrab x FAP) (16,40 + 3,3840)": a parte da empresa (código 1138) e o GILRAT ajustado (1646)
    const [pEmpresa, pRat] = aliquota.split('+').map((x) => numeroBR(x.trim()));
    const patronalEmpresa = pEmpresa > 0 && pRat >= 0 ? centavos((v.patronal * pEmpresa) / (pEmpresa + pRat)) : v.patronal;
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
      // base do patronal e do RAT (sem a parte isenta, como o salário-maternidade)
      baseTributavel: v.baseTributavel || v.base,
      segurados: centavos(v.segurados + seguradosAnteriores),
      patronal: v.patronal,
      aliqEmpresa: pEmpresa > 0 ? pEmpresa : 0,
      aliqRat: pRat >= 0 ? pRat || 0 : 0,
      patronalEmpresa,
      gilrat: centavos(v.patronal - patronalEmpresa),
      contribIndividuais: centavos(v.autonomos + v.autonomosTransporte + v.conselheiros),
      patronalIndividuais: centavos(v.patronalAutonomos + v.patronalAutonomosTransporte + v.patronalConselheiros),
      adicionalEspecial: centavos(v.nocivo15 + v.nocivo20 + v.nocivo25 + v.extraRat),
      outros: centavos(valorGuia - v.segurados - seguradosAnteriores - v.patronal),
      patronalRelatorio: v.patronal,
      // o que sobra no relatório fora de segurados, patronal, RAT e contribuintes individuais (normalmente zero)
      outrosRelatorio: centavos(
        valorGuia -
          v.segurados -
          seguradosAnteriores -
          v.patronal -
          (v.autonomos + v.autonomosTransporte + v.conselheiros) -
          (v.patronalAutonomos + v.patronalAutonomosTransporte + v.patronalConselheiros) -
          (v.nocivo15 + v.nocivo20 + v.nocivo25 + v.extraRat),
      ),
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
/** "16,40" / "16.4" / "16,40%" → 16.4 (null se vazio ou inválido) */
export function porcentagem(s) {
  const t = String(s ?? '')
    .replace(/[\s%]/g, '')
    .replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Recalcula patronal e RAT ajustado de cada centro com as alíquotas digitadas: base patronal × %.
 * Guia = segurados + patronal + RAT (+ contribuintes individuais e adicional, quando houver), sem as deduções.
 * Sem alíquotas, fica o que o relatório calculou.
 * @param {any[]} centros
 * @param {{ patronal: number|null, rat: number|null }} aliq
 */
export function aplicarAliquotas(centros, aliq) {
  const p = aliq?.patronal;
  const r = aliq?.rat;
  const usar = p != null && r != null;
  return centros.map((c) => {
    const patronalEmpresa = usar ? centavos((c.baseTributavel * p) / 100) : c.patronalEmpresa;
    const gilrat = usar ? centavos((c.baseTributavel * r) / 100) : c.gilrat;
    const valorGuia = centavos(
      c.segurados + patronalEmpresa + gilrat + c.contribIndividuais + c.patronalIndividuais + c.adicionalEspecial + (c.outrosRelatorio || 0),
    );
    return {
      ...c,
      aliqEmpresa: usar ? p : c.aliqEmpresa,
      aliqRat: usar ? r : c.aliqRat,
      patronalEmpresa,
      gilrat,
      patronal: centavos(patronalEmpresa + gilrat),
      valorGuia,
      // patronal + RAT calculados com as alíquotas digitadas, menos o que o relatório trouxe
      diferencaRelatorio: centavos(patronalEmpresa + gilrat - c.patronalRelatorio),
    };
  });
}

export function totais(lista) {
  return Object.fromEntries(
    [
      'base',
      'segurados',
      'patronal',
      'patronalEmpresa',
      'gilrat',
      'patronalRelatorio',
      'diferencaRelatorio',
      'outrosRelatorio',
      'baseTributavel',
      'contribIndividuais',
      'patronalIndividuais',
      'adicionalEspecial',
      'outros',
      'salarioFamilia',
      'maternidade',
      'liquido',
      'valorGuia',
      'irrf',
    ].map((k) => [k, somar(lista, k)]),
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

// ---------------------------------------------------------------- guia original (DARF do DCTFWeb) por código de receita

const DINHEIRO = /\d{1,3}(?:\.\d{3})*,\d{2}/g;

/**
 * Lê o DARF (Documento de Arrecadação de Receitas Federais) do DCTFWeb: contribuinte, período, vencimento,
 * total e a composição por código de receita. Devolve null se o PDF não for um DARF.
 */
export function lerDarf(linhas) {
  const textos = linhas.map((l) => (l.texto ?? String(l)).trim());
  if (!textos.some((t) => /Composi[cç][aã]o do Documento de Arrecada/i.test(t))) return null;
  const contribuinte = textos.map((t) => t.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\s+(.+)/)).find(Boolean);
  const periodo = textos
    .map((t) =>
      t.match(/^((?:janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.-]+)/i),
    )
    .find(Boolean);
  const itens = [];
  for (let i = 0; i < textos.length; i++) {
    const m = textos[i].match(/^(\d{4})\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2}(?:\s+.*)?)$/);
    if (!m) continue;
    const valores = m[3].match(DINHEIRO).map(numeroBR);
    const detalhe = (textos[i + 1] || '').match(/^(\d{2})\s+(.+)$/);
    itens.push({
      codigo: m[1],
      detalhe: detalhe ? detalhe[1] : '',
      denominacao: m[2].trim(),
      descricao: detalhe ? detalhe[2].trim() : m[2].trim(),
      principal: valores[0],
      total: valores.at(-1),
    });
  }
  return {
    cnpj: contribuinte?.[1] || '',
    contribuinte: contribuinte?.[2]?.trim() || '',
    periodo: periodo?.[1] || '',
    vencimento: periodo?.[2] || '',
    numero: periodo?.[3] || '',
    total: valorDaGuia(linhas),
    itens,
  };
}

/** Parte do FUNDEB em cada código de receita do DARF (o que vem do relatório de cada centro) */
export const CODIGOS_FUNDEB = [
  { chave: '1082-01', campo: 'segurados', nome: 'Segurados (empregados)', descricao: 'CP SEGURADOS - EMPREGADOS/AVULSO' },
  { chave: '1099-01', campo: 'contribIndividuais', nome: 'Segurados contribuintes individuais', descricao: 'CP SEGURADOS - CONTRIBUINTES INDIVIDUAIS - 11%' },
  { chave: '1138-01', campo: 'patronalEmpresa', nome: 'Patronal sobre empregados', descricao: 'CP PATRONAL - EMPREGADOS/AVULSOS' },
  { chave: '1138-04', campo: 'patronalIndividuais', nome: 'Patronal sobre contribuintes individuais', descricao: 'CP PATRONAL - CONTRIBUINTES INDIVIDUAIS' },
  { chave: '1646-01', campo: 'gilrat', nome: 'GILRAT ajustado (RAT × FAP)', descricao: 'CP PATRONAL - GILRAT AJUSTADO' },
  { chave: '1141-01', campo: 'adicionalEspecial', nome: 'Adicional para aposentadoria especial', descricao: 'CP PATRONAL - ADICIONAL GILRAT' },
];
// códigos que sempre aparecem na guia do FUNDEB (os outros, só quando têm valor)
const CODIGOS_SEMPRE = new Set(['1082-01', '1138-01', '1646-01']);

/**
 * Códigos de receita das guias. Sem a guia completa: os códigos da guia do FUNDEB.
 * Com ela (DARF): cada código da guia completa com a parte do FUNDEB e o restante, o que não é FUNDEB.
 * @param {any} totalFundeb  totais dos centros do FUNDEB (separarGuias(...).totalFundeb)
 * @param {ReturnType<typeof lerDarf>} [darf]
 */
export function tabelaCodigos(totalFundeb, darf = null) {
  const fundebDe = (chave) => {
    const c = CODIGOS_FUNDEB.find((x) => x.chave === chave);
    return c ? centavos(totalFundeb[c.campo]) : 0;
  };
  const partes = (chave) => chave.split('-');
  let linhas;
  if (!darf?.itens?.length) {
    linhas = CODIGOS_FUNDEB.filter((c) => CODIGOS_SEMPRE.has(c.chave) || centavos(totalFundeb[c.campo])).map((c) => ({
      chave: c.chave,
      codigo: partes(c.chave)[0],
      detalhe: partes(c.chave)[1],
      descricao: c.descricao,
      fundeb: fundebDe(c.chave),
      completa: null,
      restante: null,
      faltaNaGuia: false,
    }));
  } else {
    linhas = darf.itens.map((it) => {
      const chave = `${it.codigo}-${it.detalhe}`;
      const fundeb = fundebDe(chave);
      return {
        chave,
        codigo: it.codigo,
        detalhe: it.detalhe,
        descricao: it.descricao,
        fundeb,
        completa: it.total,
        restante: centavos(it.total - fundeb),
        faltaNaGuia: false,
      };
    });
    // parte do FUNDEB num código que a guia completa não tem: fica aqui, com restante negativo, para chamar a atenção
    for (const c of CODIGOS_FUNDEB) {
      const v = centavos(totalFundeb[c.campo]);
      if (v && !linhas.some((l) => l.chave === c.chave))
        linhas.push({
          chave: c.chave,
          codigo: partes(c.chave)[0],
          detalhe: partes(c.chave)[1],
          descricao: c.descricao,
          fundeb: v,
          completa: 0,
          restante: -v,
          faltaNaGuia: true,
        });
    }
  }
  const soma = (k) => (linhas.some((l) => l[k] != null) ? centavos(linhas.reduce((t, l) => t + (l[k] || 0), 0)) : null);
  return { linhas, total: { fundeb: soma('fundeb'), completa: soma('completa'), restante: soma('restante') } };
}

/**
 * Divide cada código do DARF entre a guia do FUNDEB e a do restante (restante = original − FUNDEB).
 * @returns {{ linhas: any[], semCodigo: any[] }}  semCodigo = parte do FUNDEB sem código correspondente na guia
 */
export function dividirPorCodigo(darf, totalFundeb) {
  const linhas = darf.itens.map((it) => {
    const c = CODIGOS_FUNDEB.find((x) => x.chave === `${it.codigo}-${it.detalhe}`);
    const fundeb = c ? centavos(totalFundeb[c.campo]) : 0;
    return { ...it, fundeb, restante: centavos(it.total - fundeb) };
  });
  const semCodigo = CODIGOS_FUNDEB.filter((c) => centavos(totalFundeb[c.campo]) && !darf.itens.some((it) => `${it.codigo}-${it.detalhe}` === c.chave)).map(
    (c) => ({
      ...c,
      valor: centavos(totalFundeb[c.campo]),
    }),
  );
  return { linhas, semCodigo };
}

/** "MUNICIPIO DE ASTOLFO DUTRA" × "PREFEITURA MUNICIPAL DE DONA EUZEBIA": é o mesmo município? */
export function mesmoMunicipio(a, b) {
  const nome = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/^.*?\b(MUNICIPIO|PREFEITURA MUNICIPAL|CAMARA MUNICIPAL)\s+(DE|DO|DA)\s+/, '')
      .replace(/[^A-Z ]/g, '')
      .replace(/\bS\b/g, 'Z')
      .replace(/S/g, 'Z')
      .trim();
  return !a || !b || nome(a) === nome(b);
}

// ---------------------------------------------------------------- planilha de referência e PDF

const COLUNAS_CENTROS = [
  { titulo: 'Departamento', largura: 16 },
  { titulo: 'Centro de custo', largura: 40 },
  { titulo: 'Base INSS', tipo: 'moeda', largura: 16 },
  { titulo: 'Base patronal (tributável)', tipo: 'moeda', largura: 24 },
  { titulo: 'Segurados (1082)', tipo: 'moeda', largura: 18 },
  { titulo: 'Patronal (1138)', tipo: 'moeda', largura: 17 },
  { titulo: 'RAT ajustado (1646)', tipo: 'moeda', largura: 19 },
  { titulo: 'Contrib. individuais (1099)', tipo: 'moeda', largura: 24 },
  { titulo: 'Patronal contrib. individuais (1138-04)', tipo: 'moeda', largura: 34 },
  { titulo: 'Adicional aposent. especial (1141)', tipo: 'moeda', largura: 30 },
  { titulo: 'Outros do relatório', tipo: 'moeda', largura: 18 },
  { titulo: 'Valor para a guia', tipo: 'moeda', largura: 18 },
  { titulo: 'Salário-família (desconsiderado)', tipo: 'moeda', largura: 28 },
  { titulo: 'Salário-maternidade (desconsiderado)', tipo: 'moeda', largura: 32 },
  { titulo: 'Total líquido no relatório', tipo: 'moeda', largura: 24 },
  { titulo: 'Patronal + RAT no relatório', tipo: 'moeda', largura: 26 },
  { titulo: 'Diferença para o relatório', tipo: 'moeda', largura: 24 },
];
// coluna da aba de centros onde está a parte de cada código de receita
const COLUNA_DO_CODIGO = { '1082-01': 'E', '1138-01': 'F', '1646-01': 'G', '1099-01': 'H', '1138-04': 'I', '1141-01': 'J' };
// células do Resumo com as alíquotas (as fórmulas das abas de centros apontam para elas)
const CEL_PATRONAL = 'Resumo!$B$4';
const CEL_RAT = 'Resumo!$B$5';

const temValor = (c) => c.valorGuia || c.base || c.liquido || c.salarioFamilia || c.maternidade;

/**
 * Aba de centros: dados do relatório + fórmulas. Patronal e RAT = base patronal × alíquota do Resumo;
 * valor para a guia = segurados + patronal + RAT + contribuintes individuais + adicional + outros (sem as deduções)
 */
function abaCentros(nome, lista) {
  const linhas = lista.filter(temValor).map((c, i) => {
    const r = i + 2;
    return [
      c.departamento,
      `${c.centro}${c.ccCodigo ? ` (${c.ccCodigo})` : ''}`,
      c.base,
      c.baseTributavel,
      c.segurados,
      { f: `ROUND(D${r}*${CEL_PATRONAL}/100,2)` },
      { f: `ROUND(D${r}*${CEL_RAT}/100,2)` },
      c.contribIndividuais,
      c.patronalIndividuais,
      c.adicionalEspecial,
      c.outrosRelatorio || 0,
      { f: `SUM(E${r}:K${r})` },
      c.salarioFamilia,
      c.maternidade,
      c.liquido,
      c.patronalRelatorio,
      { f: `F${r}+G${r}-P${r}` },
    ];
  });
  const ultima = linhas.length + 1;
  const total = ultima + 1;
  const soma = (col) => ({ f: ultima >= 2 ? `SUM(${col}2:${col}${ultima})` : '0' });
  linhas.push(['Total', `${linhas.length} centros com valor`, ...'CDEFGHIJKLMNOPQ'.split('').map(soma)]);
  return { aba: { nome, colunas: COLUNAS_CENTROS, linhas }, total };
}

/**
 * Abas do Excel de referência: Resumo (alíquotas, guia do FUNDEB e, com a guia original, o restante), FUNDEB,
 * Por código (com o DARF) e, se houver outros departamentos no relatório, Restante.
 * @param {ReturnType<typeof separarGuias>} g
 * @param {{ competencia: string, prefeitura: string, origemOriginal?: string, patronal?: number|null, rat?: number|null }} info
 * @param {ReturnType<typeof lerDarf>} [darf]
 */
export function abasReferencia(g, info, darf = null) {
  const f = abaCentros('FUNDEB', g.fundeb);
  const abas = [f.aba];
  const t = f.total;
  const pct = (v, alt) => ({ v: Number(v ?? alt ?? 0), tipo: 'numero' });
  const aliqRel = g.fundeb.find((c) => c.aliqEmpresa || c.aliqRat) || {};
  const resumo = [
    ['Prefeitura', info.prefeitura || '', ''],
    ['Competência', info.competencia || '', ''],
    ['Alíquota patronal (%)', pct(info.patronal, aliqRel.aliqEmpresa), 'Digitada na ferramenta. Troque aqui e a planilha recalcula'],
    ['Alíquota RAT ajustado (%)', pct(info.rat, aliqRel.aliqRat), 'RAT × FAP. Digitada na ferramenta. Troque aqui e a planilha recalcula'],
    ['Guia do FUNDEB', { f: `FUNDEB!L${t}` }, 'Segurados + patronal + RAT dos centros do FUNDEB, sem salário-família e salário-maternidade (aba FUNDEB)'],
    ['Segurados (1082)', { f: `FUNDEB!E${t}` }, ''],
    ['Patronal (1138)', { f: `FUNDEB!F${t}` }, 'Base patronal × alíquota patronal'],
    ['RAT ajustado (1646)', { f: `FUNDEB!G${t}` }, 'Base patronal × alíquota do RAT ajustado'],
    ['Salário-família desconsiderado', { f: `FUNDEB!M${t}` }, 'Não entra na guia do FUNDEB'],
    ['Salário-maternidade desconsiderado', { f: `FUNDEB!N${t}` }, 'Não entra na guia do FUNDEB'],
    ['Diferença para o relatório (patronal + RAT)', { f: `FUNDEB!Q${t}` }, 'Patronal + RAT com as alíquotas digitadas, menos o que o relatório calculou'],
    ['Guia completa (valor total)', g.guiaOriginal ?? '', info.origemOriginal || 'Opcional: digite aqui o valor da guia completa para calcular o restante'],
    ['Guia do restante (não FUNDEB)', { f: 'IF(B13="","",B13-B6)' }, 'Guia completa menos a guia do FUNDEB'],
  ];
  // códigos de receita: os do FUNDEB sempre; com a guia completa, também a guia completa e o restante de cada código
  const tab = tabelaCodigos(g.totalFundeb, darf);
  const linhasCod = tab.linhas.map((l, i) => {
    const r = i + 2;
    const col = COLUNA_DO_CODIGO[l.chave];
    return [
      l.chave,
      l.descricao,
      col ? { f: `FUNDEB!${col}${t}` } : 0,
      l.completa ?? '',
      { f: `IF(D${r}="","",D${r}-C${r})` },
      col ? `Aba FUNDEB, coluna ${col} (total)` : 'Sem parte do FUNDEB: vai todo para o restante',
    ];
  });
  const ultCod = linhasCod.length + 1;
  const totCod = ultCod + 1;
  linhasCod.push([
    'Total',
    'Guias a gerar',
    { f: `SUM(C2:C${ultCod})` },
    { f: `IF(COUNT(D2:D${ultCod})=0,"",SUM(D2:D${ultCod}))` },
    { f: `IF(D${totCod}="","",D${totCod}-C${totCod})` },
    '',
  ]);
  abas.push({
    nome: 'Por código',
    colunas: [
      { titulo: 'Código', largura: 10 },
      { titulo: 'Descrição', largura: 48 },
      { titulo: 'Guia do FUNDEB', tipo: 'moeda', largura: 18 },
      { titulo: 'Guia completa', tipo: 'moeda', largura: 18 },
      { titulo: 'Guia do restante (não FUNDEB)', tipo: 'moeda', largura: 28 },
      { titulo: 'De onde vem o valor do FUNDEB', largura: 46 },
    ],
    linhas: linhasCod,
  });
  resumo.push(["Conferência: soma dos códigos do FUNDEB (aba 'Por código')", { f: `'Por código'!C${totCod}` }, 'Tem que ser igual à guia do FUNDEB']);
  if (darf?.itens?.length)
    resumo.push(["Conferência: soma dos códigos do restante (aba 'Por código')", { f: `'Por código'!E${totCod}` }, 'Tem que ser igual à guia do restante']);
  if (g.outros.some(temValor)) {
    const o = abaCentros('Restante', g.outros);
    abas.push(o.aba);
    resumo.push(['Restante calculado pelo relatório (conferência)', { f: `Restante!L${o.total}` }, 'Outros departamentos com as mesmas alíquotas']);
  }
  abas.unshift({
    nome: 'Resumo',
    colunas: [
      { titulo: 'Item', largura: 52 },
      { titulo: 'Valor', tipo: 'moeda', largura: 18 },
      { titulo: 'Como chegou nesse valor', largura: 90 },
    ],
    linhas: resumo,
  });
  return abas;
}

const brl = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

/**
 * Blocos do relatório em PDF (layout Ágil CM, lib/pdfReport.ts)
 * @param {ReturnType<typeof separarGuias>} g
 * @param {{ competencia: string, prefeitura: string, patronal?: number|null, rat?: number|null }} info
 * @param {ReturnType<typeof lerDarf>} [darf]
 */
export function blocosPdfGuias(g, info, darf = null) {
  const linhasCentros = (lista) =>
    lista
      .filter(temValor)
      .map((c) => [
        `${c.centro}${c.ccCodigo ? ` (${c.ccCodigo})` : ''}`,
        { text: brl(c.segurados), align: 'right' },
        { text: brl(c.patronalEmpresa), align: 'right' },
        { text: brl(c.gilrat), align: 'right' },
        { text: brl(c.valorGuia), align: 'right', bold: true },
      ]);
  const pct = (v) => (v == null ? '—' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%`);
  const aliq = g.fundeb.find((c) => c.aliqEmpresa || c.aliqRat) || {};
  const tf = g.totalFundeb;
  const blocos = [
    { type: 'title', text: g.guiaOriginal == null ? 'Guia de INSS do FUNDEB' : 'Guias de INSS: FUNDEB e restante' },
    { type: 'para', text: `${info.prefeitura || 'Prefeitura'} · competência ${info.competencia || '—'}`, color: 'muted' },
    {
      type: 'table',
      widths: [3, 1.4],
      header: ['Guia', 'Valor'],
      headerAlign: ['left', 'right'],
      rows: [
        ['Guia do FUNDEB (sem salário-família e maternidade)', { text: brl(g.guiaFundeb), align: 'right', bold: true }],
        ...(g.guiaOriginal == null
          ? []
          : [
              ['Guia completa (valor total)', { text: brl(g.guiaOriginal), align: 'right' }],
              ['Guia do restante, não FUNDEB (completa - FUNDEB)', { text: brl(g.guiaRestante), align: 'right', bold: true }],
            ]),
      ],
    },
    {
      type: 'note',
      text: `Guia do FUNDEB = segurados ${brl(tf.segurados)} + patronal ${brl(tf.patronalEmpresa)} (${pct(info.patronal ?? aliq.aliqEmpresa)} da base patronal) + RAT ajustado ${brl(tf.gilrat)} (${pct(info.rat ?? aliq.aliqRat)})${
        tf.contribIndividuais + tf.patronalIndividuais + tf.adicionalEspecial + tf.outrosRelatorio
          ? ` + outros ${brl(tf.contribIndividuais + tf.patronalIndividuais + tf.adicionalEspecial + tf.outrosRelatorio)}`
          : ''
      }. Salário-família (${brl(tf.salarioFamilia)}) e salário-maternidade (${brl(tf.maternidade)}) não foram abatidos.`,
    },
    ...(() => {
      const tab = tabelaCodigos(tf, darf);
      const comGuia = tab.total.completa != null;
      const cel = (v, bold = false) => ({ text: brl(v), align: 'right', bold });
      return [
        { type: 'heading', text: comGuia ? 'Códigos das guias (FUNDEB e restante)' : 'Códigos da guia do FUNDEB' },
        {
          type: 'table',
          widths: comGuia ? [0.9, 3.2, 1.3, 1.3, 1.3] : [0.9, 3.6, 1.4],
          header: comGuia ? ['Código', 'Descrição', 'Guia completa', 'FUNDEB', 'Restante'] : ['Código', 'Descrição', 'Guia do FUNDEB'],
          headerAlign: comGuia ? ['left', 'left', 'right', 'right', 'right'] : ['left', 'left', 'right'],
          rows: [
            ...tab.linhas.map((l) =>
              comGuia ? [l.chave, l.descricao, cel(l.completa), cel(l.fundeb, true), cel(l.restante, true)] : [l.chave, l.descricao, cel(l.fundeb, true)],
            ),
            comGuia
              ? [{ text: 'Total', bold: true }, '', cel(tab.total.completa, true), cel(tab.total.fundeb, true), cel(tab.total.restante, true)]
              : [{ text: 'Total', bold: true }, '', cel(tab.total.fundeb, true)],
          ],
          totalRows: 1,
          size: 8.5,
        },
        ...(darf
          ? [
              {
                type: 'note',
                text: `Guia completa: DARF ${darf.numero || ''} · ${darf.contribuinte || ''} · período ${darf.periodo || '—'} · vencimento ${darf.vencimento || '—'}`,
              },
              ...(mesmoMunicipio(darf.contribuinte, info.prefeitura)
                ? []
                : [
                    { type: 'para', bold: true, text: `Atenção: a guia é de ${darf.contribuinte} e o relatório é de ${info.prefeitura}. Confira os arquivos.` },
                  ]),
            ]
          : []),
      ];
    })(),
    { type: 'heading', text: 'Centros de custo do FUNDEB' },
    {
      type: 'table',
      widths: [3.2, 1.3, 1.3, 1.3, 1.4],
      header: ['Centro de custo', 'Segurados', 'Patronal', 'RAT ajustado', 'Valor para a guia'],
      headerAlign: ['left', 'right', 'right', 'right', 'right'],
      rows: [
        ...linhasCentros(g.fundeb),
        [
          { text: 'Total', bold: true },
          { text: brl(tf.segurados), align: 'right', bold: true },
          { text: brl(tf.patronalEmpresa), align: 'right', bold: true },
          { text: brl(tf.gilrat), align: 'right', bold: true },
          { text: brl(tf.valorGuia), align: 'right', bold: true },
        ],
      ],
      totalRows: 1,
      size: 8.5,
    },
  ];
  return blocos;
}
