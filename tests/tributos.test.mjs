import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aliquotaSimples, aliquotasPresumido, criticarFatorR, faturamentosDe, irrfMensal, projecaoPresumido, projecaoSimples, proLabore, rbt12DosMeses } from '../src/lib/tributos.js';
import { atividade } from '../src/data/atividadesFiscais.js';

const perto = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test('Simples: alíquota efetiva pelas tabelas dos anexos', () => {
  perto(aliquotaSimples('I', 180000).efetiva, 0.04, 1e-9);
  perto(aliquotaSimples('III', 360000).efetiva, 0.086, 1e-9);
  perto(aliquotaSimples('V', 360000).efetiva, 0.1675, 1e-9);
  perto(aliquotaSimples('IV', 1200000).efetiva, 0.10685, 1e-9);
  assert.equal(aliquotaSimples('III', 360000).faixa, 2);
});

test('pró-labore: INSS de 11% até o teto e IRRF com a redução da Lei 15.270/2025', () => {
  const a = proLabore(5000);
  assert.deepEqual([a.inss, a.irrf, a.liquido], [550, 0, 4450]);
  const b = proLabore(6000);
  assert.deepEqual([b.inss, b.irrf], [660, 380.02]);
  const c = proLabore(10000, { cppEmpresa: true });
  assert.equal(c.inss, 932.31, 'limitado ao teto');
  assert.equal(c.patronal, 2000);
  assert.equal(irrfMensal(3000).imposto, 0);
  assert.equal(irrfMensal(8000, { inss: 880 }).reducao, 0);
});

test('projeção do Simples: 12 meses, Fator R define Anexo III ou V', () => {
  const ex = (receita12) => ({ tipo: 'existente', receita12 });
  const baixo = projecaoSimples({ atividadeId: 'servicos-fator-r', faturamentos: faturamentosDe(30000), historico: ex(360000), folhaMensal: 3000, proLaboreMensal: 3000 });
  assert.equal(baixo.meses.length, 12);
  assert.equal(baixo.meses[0].anexo, 'V');
  perto(baixo.meses[0].das, 30000 * 0.1675);
  const alto = projecaoSimples({ atividadeId: 'servicos-fator-r', faturamentos: faturamentosDe(30000), historico: ex(360000), folhaMensal: 3000, proLaboreMensal: 6000 });
  assert.equal(alto.meses[0].anexo, 'III');
  const iv = projecaoSimples({ atividadeId: 'servicos-iv', faturamentos: faturamentosDe(50000), historico: ex(600000), folhaMensal: 20000, proLaboreMensal: 3000, rat: 0.03 });
  perto(iv.meses[0].cpp, 20000 * 0.23 + 3000 * 0.2);
});

test('alíquota do Simples sobe mês a mês quando a receita dos 12 meses anteriores cresce', () => {
  // receita anterior menor que o ritmo atual: a RBT12 cresce e a alíquota sobe gradualmente
  const r = projecaoSimples({ atividadeId: 'comercio', faturamentos: faturamentosDe(30000), historico: { tipo: 'existente', receita12: 120000 } });
  const aliq = r.meses.map((m) => m.aliquota);
  assert.ok(aliq.every((a, i) => i === 0 || a >= aliq[i - 1] - 1e-12), 'nunca cai');
  assert.ok(aliq[11] > aliq[0], 'sobe ao longo do ano');
  perto(r.meses[0].rbt12, 120000);
  perto(r.meses[11].rbt12, 120000 / 12 + 30000 * 11);
  // crescimento do faturamento também sobe a RBT12
  const c = projecaoSimples({ atividadeId: 'comercio', faturamentos: faturamentosDe(15000, 0.1), historico: { tipo: 'existente', receita12: 180000 } });
  assert.ok(c.meses[11].rbt12 > c.meses[0].rbt12 && c.meses[11].aliquota > c.meses[0].aliquota);
  // faturamento igual e receita anterior igual: alíquota constante (é o que a lei manda)
  const k = projecaoSimples({ atividadeId: 'comercio', faturamentos: faturamentosDe(30000), historico: { tipo: 'existente', receita12: 360000 } });
  assert.equal(new Set(k.meses.map((m) => m.aliquota)).size, 1);
});

test('empresa nova: RBT12 proporcional (LC 123, art. 18, § 2º)', () => {
  const rb = rbt12DosMeses([10000, 20000, 30000], { tipo: 'nova' });
  assert.deepEqual(rb, [120000, 120000, 180000]);
});

test('Simples × Lucro Presumido com alíquotas padrão e editáveis; crítica do Fator R', () => {
  const ativ = atividade('servicos-fator-r');
  const fats = faturamentosDe(30000);
  const a = aliquotasPresumido(ativ);
  const pr = projecaoPresumido(fats, { folhaMensal: 3000, proLaboreMensal: 3000 }, a);
  // serviços: PIS/COFINS 3,65% + IRPJ 15% × 32% + CSLL 9% × 32% + ISS 3%
  perto(pr.meses[0].pisCofins + pr.meses[0].irpj + pr.meses[0].csll + pr.meses[0].local, 30000 * (0.0365 + 0.048 + 0.0288 + 0.03));
  perto(pr.meses[0].encargosFolha, 3000 * (0.2 + 0.02 + 0.058 + 0.08));
  perto(pr.meses[0].patronalPl, 600);
  const iss5 = projecaoPresumido(fats, { folhaMensal: 0, proLaboreMensal: 0 }, { ...a, local: 0.05 });
  perto(iss5.meses[0].local, 1500);
  const grande = projecaoPresumido([300000], {}, a);
  perto(grande.meses[0].irpj, 300000 * 0.32 * 0.15 + (300000 * 0.32 - 20000) * 0.1);
  const c = criticarFatorR({ atividadeId: 'servicos-fator-r', faturamento: 30000, rbt12: 360000, folhaMensal: 3000, proLaboreMensal: 3000 });
  assert.equal(c.ok, false);
  // 28% × 30.000 = 8.400 de folha por mês; salários 3.000 + 13º e férias 333,33 + FGTS 266,67 = 3.600 → pró-labore de 4.800
  perto(c.proLaboreNecessario, 4801, 0.02);
  assert.ok(c.ganhoLiquidoAno > 0);
  assert.equal(criticarFatorR({ atividadeId: 'comercio', faturamento: 1, rbt12: 12 }), null);
});

test('Fator R: folha com 13º, 1/3 de férias e FGTS (LC 123, art. 18, § 24)', async () => {
  const { contaFatorR } = await import('../src/lib/tributos.js');
  const c = contaFatorR(3000, 3000, 360000);
  perto(c.salarios12, 36000);
  perto(c.decimoFerias12, 4000);
  perto(c.fgts12, 3200);
  perto(c.proLabore12, 36000);
  perto(c.folha12, 79200);
  perto(c.fator, 0.22, 1e-9);
});
