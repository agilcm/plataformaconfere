import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepararDados } from '../src/lib/eleicao.js';
import {
  compararCandidatos,
  intervaloCorrelacao,
  ligacao,
  postos,
  pValorCorrelacao,
  pValorSobreposicao,
  pValorSobreposicaoMenor,
  rotuloQuadrante,
  spearman,
  topoDoEixo,
  dominioEixo,
  trechoTendencia,
} from '../src/lib/eleicaoComparar.js';
import { abasComparacao, blocosComparacao } from '../src/lib/eleicaoRelatorios.js';

test('estatística: postos com empate, Spearman, p-valor e intervalo', () => {
  assert.deepEqual(postos([10, 20, 20, 30]), [1, 2.5, 2.5, 4]);
  assert.equal(spearman([1, 2, 3, 4, 5], [2, 4, 9, 16, 25]), 1, 'monotônica = 1, mesmo sem ser reta');
  assert.equal(spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]), -1);
  assert.equal(Math.round(pValorCorrelacao(0.5, 20) * 10000), 248, 'r = 0,5 com 20 pares: p = 0,0248');
  assert.ok(pValorCorrelacao(0.1, 19) > 0.6);
  const ic = intervaloCorrelacao(0.5, 20);
  assert.deepEqual(ic.map((v) => Math.round(v * 1000)), [74, 772]);
  assert.equal(Math.round(pValorSobreposicao(3, 10, 3, 3) * 120 * 1000) / 1000, 1, '3 de 3 em 10: 1/120');
  assert.equal(Math.round(pValorSobreposicaoMenor(0, 10, 3, 3) * 1000) / 1000, Math.round((35 / 120) * 1000) / 1000, 'nenhuma em comum: C(7,3)/C(10,3)');
  assert.equal(ligacao(0.6, 0.001).curto, 'Ligação forte');
  assert.equal(ligacao(-0.35, 0.01).curto, 'Bases opostas (moderada)');
  assert.equal(ligacao(0.4, 0.2).id, 'nenhuma', 'sem significância não há ligação');
  assert.equal(topoDoEixo(0.05), 0.08);
  assert.equal(topoDoEixo(0.7), 0.8);
  assert.deepEqual(dominioEixo([0, 0.2]), { min: 0, max: 0.2 });
  assert.deepEqual(dominioEixo([0.36, 0.78]), { min: 0.2, max: 1 }, 'eixo do prefeito não começa no zero');
  assert.deepEqual(dominioEixo([0.012, 0.019]), { min: 0.01, max: 0.03 }, '4 intervalos de 0,5 ponto');
  const tr = trechoTendencia({ a: 0, b: 1 }, { min: 0, max: 0.5 }, { min: 0.1, max: 0.3 });
  assert.deepEqual(tr.map((p) => p.map((v) => Math.round(v * 100) / 100)), [[0.1, 0.1], [0.3, 0.3]], 'só o trecho dentro do gráfico');
});

/** 16 urnas: o vereador VERA vai bem onde a prefeita ANA vai bem (e o rival RUI vai mal) */
function cidade() {
  const d = { cities: ['Z'], turnout: [], votes: [], profile: [], candidates: [] };
  for (let s = 1; s <= 16; s++) {
    const base = { city: 'Z', year: 2024, zone: '5', section: String(s), localCode: s <= 8 ? 'L1' : 'L2', localName: s <= 8 ? 'ESCOLA NORTE' : 'ESCOLA SUL' };
    d.turnout.push({ ...base, aptos: 300, turnout: 250, abstentions: 50 });
    const ana = 60 + s * 8; // 68..188 de 240
    const v = (cand, cargo, numero, partido, votos) => d.votes.push({ ...base, cargo, candidateNumber: numero, candidateName: cand, party: partido, votes: votos });
    v('ANA', 'Prefeito', '15', 'MDB', ana);
    v('RUI', 'Prefeito', '12', 'PDT', 240 - ana);
    v('VERA', 'Vereador', '15111', 'MDB', 2 + s * 2); // cresce junto com ANA
    v('LEO', 'Vereador', '12222', 'PDT', 20);
    v('OUTROS', 'Vereador', '12333', 'PDT', 218 - (2 + s * 2));
    const idosos = 40 + s * 6;
    const prof = (dimension, category, count) => d.profile.push({ ...base, dimension, category, count });
    prof('Faixa etária', '25 a 29 anos', 300 - idosos);
    prof('Faixa etária', '65 a 69 anos', idosos);
    prof('Escolaridade', 'ENSINO MÉDIO COMPLETO', 300);
    prof('Gênero', 'FEMININO', 150);
    prof('Gênero', 'MASCULINO', 150);
  }
  d.candidates.push(
    { year: 2024, cargo: 'Prefeito', number: '15', scope: 'Z', name: 'ANA MARIA SOUZA', ballotName: 'ANA', party: 'MDB', situation: 'Eleito', person: 'p1' },
    { year: 2024, cargo: 'Vereador', number: '15111', scope: 'Z', name: 'VERA LÚCIA', ballotName: 'VERA', party: 'MDB', situation: 'Eleito', person: 'p2' },
  );
  return prepararDados(d);
}

test('comparar: vereador e prefeita que crescem juntos nas mesmas urnas', () => {
  const d = cidade();
  const o = compararCandidatos(d, { cidade: 'Z', a: { ano: 2024, cargo: 'Vereador', id: 'Vereador|15111|VERA' }, b: { ano: 2024, cargo: 'Prefeito', id: 'Prefeito|15|ANA' } });
  assert.equal(o.N, 16);
  assert.equal(o.rho, 1, 'mesma ordem nas 16 urnas');
  assert.ok(o.p < 0.001);
  assert.equal(o.ligacao.curto, 'Ligação forte');
  assert.ok(o.mesmoPartido);
  assert.equal(o.sobreposicao.comuns, 4, 'os 4 redutos de um são os 4 do outro');
  assert.equal(o.sobreposicao.esperado, 1);
  assert.ok(o.sobreposicao.p < 0.01);
  assert.ok(o.cruzado.bNosRedutosDeA > o.mediaB, 'a prefeita vai acima da média nos redutos do vereador');
  const q = Object.fromEntries(o.quadrantes.map((x) => [x.id, x.urnas]));
  assert.equal(q.ambos + q.nenhum, 16, 'só os quadrantes "os dois acima" e "os dois abaixo"');
  const ambos = o.quadrantes.find((x) => x.id === 'ambos');
  assert.equal(ambos.leitura.idade.includes('mais velho'), true, 'onde os dois vão bem, o eleitorado é mais velho');
  assert.match(o.manchete, /^VERA e ANA têm ligação forte nas urnas de Z/);
  assert.ok(o.frases.some((f) => f.includes('Os dois são do MDB')));
  assert.equal(o.locais[0].local, 'Escola Sul');
  assert.equal(rotuloQuadrante('soA', o), 'Só VERA acima');
  // como ler o gráfico: 4 passos com a conta das médias e os 4 grupos
  assert.equal(o.comoLer.passos.length, 4);
  assert.match(o.comoLer.passos[1].texto, new RegExp(`VERA: ${o.totaisA.votos.toLocaleString('pt-BR')} ÷ ${o.totaisA.validos.toLocaleString('pt-BR')} = `));
  assert.match(o.comoLer.passos[2].texto, /vereador dividiu os votos entre 3 candidatos e prefeito entre 2/);
  assert.match(o.comoLer.passos[3].texto, /Aqui, os pontos sobem da esquerda para a direita: ligação forte/);
  assert.deepEqual(o.comoLer.grupos.map((g) => g.onde), ['em cima, à direita', 'embaixo, à direita', 'em cima, à esquerda', 'embaixo, à esquerda']);
});

test('comparar: rivais têm bases opostas; relatórios fecham as colunas', () => {
  const d = cidade();
  const o = compararCandidatos(d, { cidade: 'Z', a: { ano: 2024, cargo: 'Prefeito', id: 'Prefeito|15|ANA' }, b: { ano: 2024, cargo: 'Prefeito', id: 'Prefeito|12|RUI' } });
  assert.equal(o.rho, -1);
  assert.equal(o.ligacao.sinal, -1);
  assert.match(o.comoLer.passos[2].texto, /Os dois disputam o mesmo cargo/);
  assert.match(o.comoLer.passos[3].texto, /descem/);
  assert.equal(o.sobreposicao.comuns, 0);
  assert.ok(o.frases.some((f) => f.startsWith('Nenhuma das 4 urnas mais fortes de ANA')));
  const b = blocosComparacao(o, { dataText: 'hoje' });
  const sc = b.find((x) => x.type === 'scatter');
  assert.equal(sc.points.length, 16);
  assert.ok(sc.xMax >= Math.max(...o.pares.map((p) => p.pA)) && sc.xMin <= Math.min(...o.pares.map((p) => p.pA)));
  for (const t of b.filter((x) => x.type === 'table')) for (const r of t.rows) assert.equal(r.length, t.widths.length);
  const abas = abasComparacao(o);
  assert.deepEqual(abas.map((a) => a.nome), ['Comparação', 'Urnas', 'Grupos de urnas', 'Locais']);
  for (const a of abas.slice(1)) for (const l of a.linhas) assert.equal(l.length, a.colunas.length);
  assert.equal(compararCandidatos(d, { cidade: 'Z', a: { ano: 2024, cargo: 'Prefeito', id: 'Prefeito|99|X' }, b: { ano: 2024, cargo: 'Prefeito', id: 'Prefeito|12|RUI' } }), null);
});
