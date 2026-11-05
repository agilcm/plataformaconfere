import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  abasReferencia,
  aplicarAliquotas,
  departamentos,
  juntarCentros,
  lerDetalhamento,
  porcentagem,
  separarGuias,
  valorDaGuia,
} from '../src/lib/guiasDotacao.js';
import { criarXlsx } from '../src/lib/xlsx.js';

// Uma página do "Detalhamento de Guias por Dotação" como o leitor de PDF entrega (as duas colunas na mesma linha)
const pagina = (p, dep, cc, v) =>
  [
    'DETALHAMENTO DE GUIAS POR DOTAÇÃO',
    'PREFEITURA MUNICIPAL DE EXEMPLO   Página(s): 1/2',
    `Depart.:${dep}. C. Custo:${cc}. Compet.:Outubro/2026`,
    `Empresa Total   ${v.base}   FGTS Sem 13º (8%)   0,00`,
    `Segurado (Empregados)   ${v.seg}   TOTAL DEPÓSITO FGTS SEFIP (2%)   0,00`,
    'Contrib. Individuais (Autônomos)   0,00   TOTAL DEPÓSITO FGTS (8%)   0,00',
    'Segurado (Empregados)   0,00',
    `Empresa + (AcdTrab x FAP) (16,40 + 3,3840)   ${v.pat}   INSS Folha   ${v.base}`,
    `Deduções FPAS (Sal. Família/Aux. Nat.)   ${v.sf}`,
    `Deduções FPAS (Sal. Maternidade)   ${v.mat}`,
    'Deduções FPAS (13º Sal. Maternidade)   0,00',
    'Acumulado Deduções   0,00   DARF',
    `Total Líquido da GPS   ${v.liq}   Código RAT *   0000`,
    `I. R. s/ Folha   ${v.ir}`,
  ].map((texto) => ({ texto, pagina: p }));

const linhas = [
  ...pagina(0, 'Fundeb-2', 'Educacao Infantil-5', {
    base: '70.055,75',
    seg: '7.077,04',
    pat: '13.859,83',
    sf: '270,16',
    mat: '0,00',
    liq: '20.666,71',
    ir: '2.679,17',
  }),
  ...pagina(1, 'Fundeb-2', 'Educação - Inclusiva-48', {
    base: '40.005,21',
    seg: '3.220,26',
    pat: '7.577,38',
    sf: '1.013,10',
    mat: '1.704,64',
    liq: '8.079,90',
    ir: '0,00',
  }),
  ...pagina(2, 'Saude-3', 'Posto Central-7', { base: '10.000,00', seg: '900,00', pat: '1.978,40', sf: '100,00', mat: '0,00', liq: '2.778,40', ir: '0,00' }),
];

test('lê cada centro de custo do detalhamento', () => {
  const r = lerDetalhamento(linhas);
  assert.equal(r.prefeitura, 'PREFEITURA MUNICIPAL DE EXEMPLO');
  assert.equal(r.centros.length, 3);
  const c = r.centros[0];
  assert.deepEqual(
    [c.departamento, c.depCodigo, c.centro, c.ccCodigo, c.competencia, c.aliquota],
    ['Fundeb', '2', 'Educacao Infantil', '5', 'Outubro/2026', '16,40 + 3,3840'],
  );
  assert.deepEqual([c.base, c.segurados, c.patronal, c.salarioFamilia, c.liquido, c.irrf], [70055.75, 7077.04, 13859.83, 270.16, 20666.71, 2679.17]);
  // guia sem salário-família = segurados + patronal
  assert.equal(c.valorGuia, 20936.87);
  assert.equal(c.outros, 0);
  assert.equal(r.centros[1].valorGuia, 10797.64); // 8.079,90 + 1.013,10 + 1.704,64
});

test('separa FUNDEB e restante pela guia original', () => {
  const { centros } = lerDetalhamento(linhas);
  assert.deepEqual(
    departamentos(centros).map((d) => [d.nome, d.centros]),
    [
      ['Fundeb', 2],
      ['Saude', 1],
    ],
  );
  const g = separarGuias(centros, new Set(['Fundeb']), 31525.01);
  assert.equal(g.guiaFundeb, 31734.51);
  assert.equal(g.guiaRestante, -209.5); // a guia original de mentira é menor: o aviso aparece na tela
  assert.equal(g.deducoesForaDoFundeb, 2987.9);
  const ok = separarGuias(centros, new Set(['Fundeb']), 34513.41);
  assert.equal(ok.guiaRestante, 2778.9);
  assert.equal(separarGuias(centros, new Set(['Fundeb']), null).guiaRestante, null);
  // a mesma página enviada de novo não conta duas vezes
  assert.equal(juntarCentros([centros, centros]).length, 3);
});

test('planilha de referência tem as fórmulas da conta', () => {
  const { centros } = lerDetalhamento(linhas);
  const cs = aplicarAliquotas(centros, { patronal: 16.4, rat: 3.384 });
  const abas = abasReferencia(separarGuias(cs, new Set(['Fundeb']), 34513.41), { prefeitura: 'X', competencia: 'Outubro/2026', patronal: 16.4, rat: 3.384 });
  assert.deepEqual(
    abas.map((a) => a.nome),
    ['Resumo', 'FUNDEB', 'Por código', 'Restante'],
  );
  // sem a guia completa, a aba Por código traz os códigos do FUNDEB e o restante fica em branco
  const cod = abas[2].linhas;
  assert.deepEqual(
    cod.map((l) => l[0]),
    ['1082-01', '1138-01', '1646-01', 'Total'],
  );
  assert.deepEqual(cod[0][2], { f: 'FUNDEB!E4' });
  assert.deepEqual(cod[0][4], { f: 'IF(D2="","",D2-C2)' });
  const fundeb = abas[1];
  // patronal e RAT = base patronal × alíquotas que ficam no Resumo
  assert.deepEqual(fundeb.linhas[0][5], { f: 'ROUND(D2*Resumo!$B$4/100,2)' });
  assert.deepEqual(fundeb.linhas[0][6], { f: 'ROUND(D2*Resumo!$B$5/100,2)' });
  assert.deepEqual(fundeb.linhas[0][11], { f: 'SUM(E2:K2)' });
  assert.deepEqual(fundeb.linhas.at(-1)[11], { f: 'SUM(L2:L3)' });
  const resumo = abas[0].linhas;
  assert.deepEqual(resumo[2], ['Alíquota patronal (%)', { v: 16.4, tipo: 'numero' }, 'Digitada na ferramenta. Troque aqui e a planilha recalcula']);
  assert.deepEqual(resumo[4][1], { f: 'FUNDEB!L4' });
  assert.deepEqual(resumo[12][1], { f: 'IF(B13="","",B13-B6)' });
  const xlsx = new TextDecoder().decode(criarXlsx(abas));
  assert.ok(xlsx.includes('<f>ROUND(D2*Resumo!$B$4/100,2)</f>') && xlsx.includes('<c r="B4" s="5"><v>16.4</v></c>') && xlsx.includes('fullCalcOnLoad="1"'));
});

test('alíquotas digitadas recalculam patronal e RAT sobre a base patronal', () => {
  const { centros } = lerDetalhamento(linhas);
  const c = aplicarAliquotas(centros, { patronal: 20, rat: 2 })[0];
  assert.deepEqual([c.patronalEmpresa, c.gilrat, c.valorGuia], [14011.15, 1401.12, 22489.31]); // 70.055,75 × 20% e × 2%, + segurados 7.077,04
  assert.equal(c.diferencaRelatorio, 1552.44); // 15.412,27 − 13.859,83 do relatório
  // sem alíquotas, fica o que o relatório calculou
  assert.equal(aplicarAliquotas(centros, { patronal: null, rat: null })[0].valorGuia, 20936.87);
  assert.equal(porcentagem('16,40%'), 16.4);
  assert.equal(porcentagem(' 3,384 '), 3.384);
  assert.equal(porcentagem(''), null);
});

test('acha o valor total numa guia (DARF/GPS)', () => {
  const darf = ['Documento de Arrecadação de Receitas Federais', 'Valor Total do Documento', '312.456,78'].map((texto) => ({ texto, pagina: 0 }));
  assert.equal(valorDaGuia(darf), 312456.78);
  assert.equal(valorDaGuia([{ texto: 'nada aqui', pagina: 0 }]), null);
});

test('lê o DARF do DCTFWeb por código e divide FUNDEB e restante', async () => {
  const { lerDarf, dividirPorCodigo, mesmoMunicipio } = await import('../src/lib/guiasDotacao.js');
  const darf = lerDarf(
    [
      'Documento de Arrecadação',
      'CNPJ   Razão Social',
      '11.111.111/0001-11   MUNICIPIO DE EXEMPLO',
      'outubro/2026   19/11/2026   07.16.00000.0000000-0',
      'Valor Total do Documento',
      '61.600,00',
      'Composição do Documento de Arrecadação',
      'Código Denominação   Principal   Multa   Juros   Total',
      '1082   CONTR PREV DESCONTA SEGURADO-EMPREGADO/AVULSO   20.000,00   20.000,00',
      '01 CP SEGURADOS - EMPREGADOS/AVULSO',
      '1138   CONTRIB PREVIDENCIÁRIA EMPRESA/EMPREGADOR   36.000,00   36.000,00',
      '01 CP PATRONAL - EMPREGADOS/AVULSOS',
      '1138   CONTRIB PREVIDENCIÁRIA EMPRESA/EMPREGADOR   600,00   600,00',
      '04 CP PATRONAL - CONTRIBUINTES INDIVIDUAIS',
      '1646   CONTRIB PREV RISCO AMBIENTAL/APOSENT ESPECIAL   5.000,00   5.000,00',
      '01 CP PATRONAL - GILRAT AJUSTADO',
      'Totais   61.600,00   61.600,00',
    ].map((texto) => ({ texto, pagina: 0 })),
  );
  assert.deepEqual(
    [darf.cnpj, darf.contribuinte, darf.periodo, darf.vencimento, darf.total],
    ['11.111.111/0001-11', 'MUNICIPIO DE EXEMPLO', 'outubro/2026', '19/11/2026', 61600],
  );
  assert.deepEqual(
    darf.itens.map((i) => `${i.codigo}-${i.detalhe}:${i.total}`),
    ['1082-01:20000', '1138-01:36000', '1138-04:600', '1646-01:5000'],
  );
  // o patronal do relatório (empresa + RAT×FAP) vem dividido pelas alíquotas "16,40 + 3,3840"
  const { centros } = lerDetalhamento(linhas);
  const fundeb = separarGuias(centros, new Set(['Fundeb']), darf.total).totalFundeb;
  assert.equal(fundeb.patronalEmpresa + fundeb.gilrat, fundeb.patronal);
  assert.equal(fundeb.patronalEmpresa, Math.round(((fundeb.patronal * 16.4) / 19.784) * 100) / 100);
  const d = dividirPorCodigo(darf, fundeb);
  const l = Object.fromEntries(d.linhas.map((x) => [`${x.codigo}-${x.detalhe}`, x]));
  assert.equal(l['1082-01'].fundeb, 10297.3);
  assert.equal(l['1082-01'].restante, 9702.7);
  assert.equal(l['1138-04'].fundeb, 0); // sem contribuintes individuais no FUNDEB: tudo para o restante
  assert.equal(Math.round(d.linhas.reduce((s, x) => s + x.fundeb, 0) * 100) / 100, 31734.51); // = guia do FUNDEB
  assert.equal(mesmoMunicipio('MUNICIPIO DE DONA EUSEBIA', 'PREFEITURA MUNICIPAL DE DONA EUZEBIA'), true);
  assert.equal(mesmoMunicipio('MUNICIPIO DE ASTOLFO DUTRA', 'PREFEITURA MUNICIPAL DE DONA EUZEBIA'), false);
});

test('tabela de códigos: só FUNDEB e, com a guia completa, o restante (não FUNDEB) de cada código', async () => {
  const { tabelaCodigos } = await import('../src/lib/guiasDotacao.js');
  const tf = { segurados: 100, patronalEmpresa: 200, gilrat: 30, contribIndividuais: 0, patronalIndividuais: 0, adicionalEspecial: 5 };
  const so = tabelaCodigos(tf);
  assert.deepEqual(
    so.linhas.map((l) => [l.chave, l.fundeb, l.restante]),
    [
      ['1082-01', 100, null],
      ['1138-01', 200, null],
      ['1646-01', 30, null],
      ['1141-01', 5, null],
    ],
  );
  assert.deepEqual(so.total, { fundeb: 335, completa: null, restante: null });
  const darf = {
    itens: [
      { codigo: '1082', detalhe: '01', descricao: 'A', total: 1000 },
      { codigo: '1138', detalhe: '01', descricao: 'B', total: 2000 },
      { codigo: '1646', detalhe: '01', descricao: 'C', total: 300 },
    ],
  };
  const com = tabelaCodigos(tf, darf);
  assert.deepEqual(
    com.linhas.map((l) => [l.chave, l.completa, l.fundeb, l.restante]),
    [
      ['1082-01', 1000, 100, 900],
      ['1138-01', 2000, 200, 1800],
      ['1646-01', 300, 30, 270],
      ['1141-01', 0, 5, -5], // o FUNDEB tem 1141 mas a guia completa não: aparece para conferir
    ],
  );
  assert.deepEqual(com.total, { fundeb: 335, completa: 3300, restante: 2965 });
});
