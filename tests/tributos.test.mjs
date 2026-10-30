import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aliquotaSimples, comparativo, irrfMensal, projecaoSimples, proLabore } from '../src/lib/tributos.js';

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
  const baixo = projecaoSimples({ atividadeId: 'servicos-fator-r', faturamentoMensal: 30000, folhaMensal: 3000, proLaboreMensal: 3000 });
  assert.equal(baixo.meses.length, 12);
  assert.equal(baixo.meses[0].anexo, 'V');
  perto(baixo.meses[0].das, 30000 * 0.1675);
  const alto = projecaoSimples({ atividadeId: 'servicos-fator-r', faturamentoMensal: 30000, folhaMensal: 3000, proLaboreMensal: 6000 });
  assert.equal(alto.meses[0].anexo, 'III');
  const cresc = projecaoSimples({ atividadeId: 'comercio', faturamentoMensal: 15000, crescimentoMensal: 0.1 });
  assert.ok(cresc.meses[11].faturamento > cresc.meses[0].faturamento);
  assert.ok(cresc.meses[11].rbt12 > cresc.meses[0].rbt12, 'RBT12 acompanha o crescimento');
  const iv = projecaoSimples({ atividadeId: 'servicos-iv', faturamentoMensal: 50000, folhaMensal: 20000, proLaboreMensal: 3000, rat: 0.03 });
  perto(iv.meses[0].cpp, 20000 * 0.23 + 3000 * 0.2);
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

test('comparativo: três regimes e crítica do Fator R abaixo de 28%', () => {
  const r = comparativo({ atividadeId: 'servicos-fator-r', faturamentoMensal: 30000, folhaMensal: 3000, proLaboreMensal: 3000, outrasDespesas: 5000 });
  assert.deepEqual(r.regimes.map((x) => x.id), ['simples', 'presumido', 'real']);
  assert.equal(r.anexoSimples, 'V');
  const c = r.criticaFatorR;
  assert.equal(c.ok, false);
  // 28% × 30.000 = 8.400 de folha por mês; salários 3.000 + 13º e férias 333,33 + FGTS 266,67 = 3.600 → pró-labore de 4.800
  perto(c.proLaboreNecessario, 4801, 0.02);
  assert.ok(c.ganhoLiquidoAno > 0);
  const presumido = r.regimes.find((x) => x.id === 'presumido');
  // serviços: PIS/COFINS 3,65% + IRPJ 15% × 32% + CSLL 9% × 32% = 11,33% + ISS 3%
  perto(presumido.linhas.slice(0, 4).reduce((s, l) => s + l.valor, 0), 30000 * (0.0365 + 0.048 + 0.0288 + 0.03));
  const ok = comparativo({ atividadeId: 'servicos-fator-r', faturamentoMensal: 30000, folhaMensal: 6000, proLaboreMensal: 3000 });
  assert.equal(ok.criticaFatorR.ok, true);
  assert.equal(comparativo({ atividadeId: 'comercio', faturamentoMensal: 500000, folhaMensal: 0, proLaboreMensal: 0 }).regimes[0].elegivel, false);
});
