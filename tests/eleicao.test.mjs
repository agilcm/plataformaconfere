import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparecimento, filtrar, historicoCandidato, matriz, porPartido, resultadoCargo, tipoVoto, totaisComparecimento } from '../src/lib/eleicao.js';
import { abasCandidatosPorSecao, abasExcelCompleto, blocosPdf } from '../src/lib/eleicaoRelatorios.js';

const voto = (local, secao, cargo, numero, nome, partido, votos, ano = 2024) => ({
  city: 'X', year: ano, zone: '1', section: String(secao), localCode: local, localName: `ESCOLA ${local}`, cargo, candidateNumber: String(numero), candidateName: nome, party: partido, votes: votos,
});
const dados = {
  cities: ['X'],
  turnout: [
    { city: 'X', year: 2024, zone: '1', section: '1', localCode: 'A', localName: 'ESCOLA A', aptos: 100, turnout: 80, abstentions: 20 },
    { city: 'X', year: 2024, zone: '1', section: '2', localCode: 'B', localName: 'ESCOLA B', aptos: 100, turnout: 70, abstentions: 30 },
    { city: 'X', year: 2024, zone: '1', section: '3', localCode: 'B', localName: 'ESCOLA B', aptos: 90, turnout: 0, abstentions: 0 }, // agregada
  ],
  votes: [
    voto('A', 1, 'Prefeito', 15, 'MARIA', 'MDB', 50),
    voto('A', 1, 'Prefeito', 12, 'JOÃO', 'PDT', 20),
    voto('A', 1, 'Prefeito', 95, 'Branco', '#NULO#', 4),
    voto('A', 1, 'Prefeito', 96, 'Nulo', '#NULO#', 6),
    voto('B', 2, 'Prefeito', 15, 'MARIA', 'MDB', 20),
    voto('B', 2, 'Prefeito', 12, 'JOÃO', 'PDT', 40),
    voto('A', 1, 'Vereador', 15123, 'ANA', 'MDB', 30),
    voto('A', 1, 'Vereador', 15, 'MDB', 'MDB', 10), // legenda
    voto('B', 2, 'Vereador', 12345, 'BETO', 'PDT', 40),
    voto('A', 1, 'Prefeito', 15, 'MARIA', 'MDB', 300, 2020),
  ],
  profile: [{ city: 'X', year: 2024, zone: '1', section: '1', localCode: 'A', localName: 'ESCOLA A', dimension: 'Gênero', category: 'FEMININO', count: 60 }],
};

test('tipos de voto: nominal, legenda, branco e nulo', () => {
  assert.deepEqual(dados.votes.slice(0, 4).map(tipoVoto), ['nominal', 'nominal', 'branco', 'nulo']);
  assert.equal(tipoVoto(dados.votes[7]), 'legenda');
  assert.equal(tipoVoto({ ...dados.votes[7], cargo: 'Prefeito' }), 'nominal', 'só cargos proporcionais têm legenda');
});

test('resultado: válidos sem brancos e nulos; legenda conta nos proporcionais', () => {
  const f = filtrar(dados, { cidade: 'X', ano: 2024 });
  const p = resultadoCargo(f.votos, 'Prefeito');
  assert.deepEqual(p.candidatos.map((c) => [c.nome, c.votos, c.posicao]), [['MARIA', 70, 1], ['JOÃO', 60, 2]]);
  assert.equal(p.validos, 130);
  assert.deepEqual([p.brancos, p.nulos], [4, 6]);
  assert.equal(Math.round(p.candidatos[0].pctValidos * 1000), 538);
  const v = resultadoCargo(f.votos, 'Vereador');
  assert.deepEqual([v.nominais, v.legenda, v.validos], [70, 10, 80]);
  assert.deepEqual(porPartido(v).map((x) => [x.partido, x.nominais, x.legenda]), [['PDT', 40, 0], ['MDB', 30, 10]]);
});

test('matriz por local e onde cada candidato é mais forte (pela fatia do local)', () => {
  const f = filtrar(dados, { cidade: 'X', ano: 2024 });
  const m = matriz(f.votos, 'Prefeito');
  assert.deepEqual(m.colunas.map((c) => c.nome), ['Escola A', 'Escola B']);
  assert.deepEqual(m.linhas[0].votosCol, [50, 20]);
  assert.deepEqual(m.validosCol, [70, 60]);
  assert.equal(m.linhas[0].melhor.coluna, 'Escola A');
  assert.equal(m.linhas[1].melhor.coluna, 'Escola B');
  const s = matriz(f.votos, 'Prefeito', 'secao');
  assert.equal(s.colunas[0].secao, '1');
});

test('comparecimento ignora seções agregadas (sem votação própria)', () => {
  const f = filtrar(dados, { cidade: 'X', ano: 2024 });
  const t = totaisComparecimento(f.secoes);
  assert.deepEqual([t.aptos, t.comparecimento, t.secoes, t.agregadas], [200, 150, 2, 1]);
  assert.equal(t.pctComparecimento, 0.75);
  assert.equal(comparecimento(f.secoes, 'secao').length, 2);
});

test('filtro por local e histórico do candidato entre eleições', () => {
  const fa = filtrar(dados, { cidade: 'X', ano: 2024, local: 'A|ESCOLA A' });
  assert.equal(resultadoCargo(fa.votos, 'Prefeito').validos, 70);
  const h = historicoCandidato(dados, 'X', 'maria');
  assert.deepEqual(h.map((x) => [x.ano, x.votos, x.posicao]), [[2020, 300, 1], [2024, 70, 1]]);
  assert.equal(historicoCandidato(dados, 'X', '12').length, 1, 'busca pelo número');
});

test('relatórios: Excel completo, Excel por seção e PDF', () => {
  const f = filtrar(dados, { cidade: 'X', ano: 2024 });
  const abas = abasExcelCompleto(f, { cidade: 'X', ano: 2024 });
  assert.deepEqual(abas.map((a) => a.nome), [
    'Resumo',
    'Prefeito - resultado',
    'Prefeito - por local',
    'Prefeito - por seção',
    'Vereador - resultado',
    'Vereador - partidos',
    'Vereador - por local',
    'Vereador - por seção',
    'Comparecimento por seção',
    'Perfil do eleitorado',
  ]);
  assert.ok(abas.every((a) => a.nome.length <= 31));
  const sec = abasCandidatosPorSecao(dados, 'X', [{ ano: 2024, cargo: 'Prefeito', id: 'Prefeito|15|MARIA' }]);
  assert.deepEqual(sec[0].linhas, [['MARIA', '15', 'MDB', 50, 20, 70]]);
  const b = blocosPdf(f, { cidade: 'X', ano: 2024, dataText: 'X, hoje' });
  // um cargo por página, candidatos em ordem alfabética, número logo depois e locais nas colunas
  assert.ok(b.some((x) => x.type === 'heading' && x.text === 'VEREADOR · X · 2024'));
  assert.equal(b.filter((x) => x.type === 'pagebreak').length, b.filter((x) => x.type === 'table').length - 1);
  const pref = b.find((x) => x.type === 'table');
  assert.deepEqual(pref.header.slice(0, 2), ['Candidato (partido)', 'Nº']);
  assert.equal(pref.header.at(-1), 'Total');
  const nomes = pref.rows.slice(0, pref.rows.length - pref.totalRows).map((r) => r[0]);
  assert.deepEqual(nomes, [...nomes].sort((x, y) => x.localeCompare(y, 'pt-BR')));
});
