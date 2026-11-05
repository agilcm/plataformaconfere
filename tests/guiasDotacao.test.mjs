import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abasReferencia, departamentos, juntarCentros, lerDetalhamento, separarGuias, valorDaGuia } from '../src/lib/guiasDotacao.js';
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
  ...pagina(0, 'Fundeb-2', 'Educacao Infantil-5', { base: '70.055,75', seg: '7.077,04', pat: '13.859,83', sf: '270,16', mat: '0,00', liq: '20.666,71', ir: '2.679,17' }),
  ...pagina(1, 'Fundeb-2', 'Educação - Inclusiva-48', { base: '40.005,21', seg: '3.220,26', pat: '7.577,38', sf: '1.013,10', mat: '1.704,64', liq: '8.079,90', ir: '0,00' }),
  ...pagina(2, 'Saude-3', 'Posto Central-7', { base: '10.000,00', seg: '900,00', pat: '1.978,40', sf: '100,00', mat: '0,00', liq: '2.778,40', ir: '0,00' }),
];

test('lê cada centro de custo do detalhamento', () => {
  const r = lerDetalhamento(linhas);
  assert.equal(r.prefeitura, 'PREFEITURA MUNICIPAL DE EXEMPLO');
  assert.equal(r.centros.length, 3);
  const c = r.centros[0];
  assert.deepEqual([c.departamento, c.depCodigo, c.centro, c.ccCodigo, c.competencia, c.aliquota], ['Fundeb', '2', 'Educacao Infantil', '5', 'Outubro/2026', '16,40 + 3,3840']);
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
  const abas = abasReferencia(separarGuias(centros, new Set(['Fundeb']), 34513.41), { prefeitura: 'X', competencia: 'Outubro/2026' });
  assert.deepEqual(
    abas.map((a) => a.nome),
    ['Resumo', 'FUNDEB', 'Restante'],
  );
  const fundeb = abas[1];
  assert.deepEqual(fundeb.linhas[0][9], { f: 'I2+G2+H2' });
  assert.deepEqual(fundeb.linhas.at(-1)[9], { f: 'SUM(J2:J3)' });
  const resumo = abas[0].linhas;
  assert.deepEqual(resumo[3][1], { f: 'FUNDEB!J4' });
  assert.deepEqual(resumo[4][1], { f: 'IF(B4="","",B4-B5)' });
  const xlsx = new TextDecoder().decode(criarXlsx(abas));
  assert.ok(xlsx.includes('<f>I2+G2+H2</f>') && xlsx.includes('fullCalcOnLoad="1"'));
});

test('acha o valor total numa guia (DARF/GPS)', () => {
  const darf = ['Documento de Arrecadação de Receitas Federais', 'Valor Total do Documento', '312.456,78'].map((texto) => ({ texto, pagina: 0 }));
  assert.equal(valorDaGuia(darf), 312456.78);
  assert.equal(valorDaGuia([{ texto: 'nada aqui', pagina: 0 }]), null);
});
