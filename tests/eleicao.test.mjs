import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidaturasDaPessoa, comparecimento, filtrar, historicoCandidato, matriz, porPartido, prepararDados, resultadoCargo, tipoVoto, totaisComparecimento } from '../src/lib/eleicao.js';
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
  // cadastro do TSE: nome civil, situação e a mesma pessoa (p1) em 2020 e 2024
  candidates: [
    { year: 2024, cargo: 'Prefeito', number: '15', scope: 'X', name: 'MARIA DA SILVA', ballotName: 'MARIA', party: 'MDB', situation: 'Eleito', person: 'p1' },
    { year: 2024, cargo: 'Prefeito', number: '12', scope: 'X', name: 'JOÃO PEREIRA', ballotName: 'JOÃO', party: 'PDT', situation: 'Não eleito', person: 'p2' },
    { year: 2020, cargo: 'Prefeito', number: '15', scope: 'X', name: 'MARIA DA SILVA', ballotName: 'MARIA', party: 'MDB', situation: 'Eleito', person: 'p1' },
  ],
};
prepararDados(dados);

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
  assert.deepEqual(sec[0].linhas, [['MARIA DA SILVA', 'MARIA', '15', 'MDB', 50, 20, 70]]);
  const b = blocosPdf(f, { cidade: 'X', ano: 2024, dataText: 'X, hoje' });
  // um cargo por página, candidatos em ordem alfabética, número logo depois e locais nas colunas
  assert.ok(b.some((x) => x.type === 'heading' && x.text === 'VEREADOR · X · 2024'));
  assert.equal(b.filter((x) => x.type === 'pagebreak').length, b.filter((x) => x.type === 'table').length - 1);
  const pref = b.find((x) => x.type === 'table');
  assert.deepEqual(pref.header.slice(0, 3), ['Nome do candidato', 'Nome de urna (partido)', 'Nº']);
  assert.equal(pref.header.at(-1), 'Total');
  assert.equal(pref.header.length, pref.widths.length);
  const nomes = pref.rows.slice(0, pref.rows.length - pref.totalRows).map((r) => r[0]);
  assert.deepEqual(nomes, ['JOÃO PEREIRA', 'MARIA DA SILVA'], 'ordem pelo nome do candidato');
  assert.equal(pref.rows[1][1], 'MARIA (MDB) · eleito');
  for (const r of pref.rows) assert.equal(r.length, pref.widths.length);
  const res = abas.find((a) => a.nome === 'Prefeito - resultado');
  assert.deepEqual(res.colunas.slice(1, 3).map((c) => c.titulo), ['Nome do candidato', 'Nome de urna']);
  assert.deepEqual(res.linhas[0].slice(1, 6), ['MARIA DA SILVA', 'MARIA', '15', 'MDB', 'Eleito']);
});

test('cadastro do TSE: nome civil e a mesma pessoa em outras eleições', () => {
  const f = filtrar(dados, { cidade: 'X', ano: 2024 });
  const r = resultadoCargo(f.votos, 'Prefeito');
  assert.deepEqual(r.candidatos.map((c) => [c.nome, c.nomeCivil, c.situacao, c.pessoa]), [['MARIA', 'MARIA DA SILVA', 'Eleito', 'p1'], ['JOÃO', 'JOÃO PEREIRA', 'Não eleito', 'p2']]);
  assert.deepEqual(candidaturasDaPessoa(dados, 'X', 'p1').map((c) => [c.ano, c.cargo, c.votos]), [[2020, 'Prefeito', 300], [2024, 'Prefeito', 70]]);
  assert.equal(historicoCandidato(dados, 'X', 'pereira')[0].nome, 'JOÃO', 'busca pelo nome civil');
  assert.deepEqual(resultadoCargo(f.votos, 'Vereador').candidatos.map((c) => c.nomeCivil), ['', ''], 'sem cadastro, fica vazio');
});

// ------------------------------------------------------------------ votos por urna e "Traçar perfil"
import { anosDeEstudo, correlacao, faixaEtaria, nivelEscolar, perfilDoCandidato, votosPorUrna } from '../src/lib/eleicaoUrnas.js';
import { abasVotosPorUrna, blocosVotosPorUrna } from '../src/lib/eleicaoRelatorios.js';

test('votos por urna: uma linha por urna, candidatos nas colunas, zero onde não teve voto', () => {
  const ids = ['Prefeito|15|MARIA', 'Prefeito|12|JOÃO', 'Prefeito|99|NINGUÉM'];
  const t = votosPorUrna(dados, { cidade: 'X', ano: 2024, cargo: 'Prefeito', ids });
  assert.deepEqual(t.candidatos.map((c) => c.nome), ['MARIA', 'JOÃO'], 'id que não existe no cargo/ano fica de fora');
  assert.deepEqual(t.linhas.map((l) => l.secao), ['1', '2'], 'a seção 3 é agregada (votou em outra urna)');
  const [s1, s2] = t.linhas;
  assert.deepEqual(s1.cand.map((x) => [x.votos, x.posicao, x.venceu]), [[50, 1, true], [20, 2, false]]);
  assert.deepEqual(s2.cand.map((x) => [x.votos, x.posicao, x.venceu]), [[20, 2, false], [40, 1, true]]);
  assert.equal(Math.round(s1.cand[0].pct * 1000), 714, '50 de 70 válidos');
  assert.deepEqual([s1.brancos, s1.nulos, s1.maisVotado], [4, 6, 'MARIA']);
  const maria = t.candidatos[0];
  assert.deepEqual([maria.votos, maria.urnasComVoto, maria.urnasVencidas, maria.metadeDosVotosEm], [70, 2, 1, 1]);
  assert.equal(maria.melhor.secao, '1');
  assert.deepEqual([t.totais.urnas, t.totais.validos], [2, 130]);
  const v = votosPorUrna(dados, { cidade: 'X', ano: 2024, cargo: 'Vereador', ids: ['Vereador|15123|ANA'] });
  assert.deepEqual(v.linhas.map((l) => [l.secao, l.cand[0].votos, l.cand[0].posicao, l.validos]), [['1', 30, 1, 40], ['2', 0, null, 40]], 'legenda conta nos válidos');
  const quatro = votosPorUrna(dados, { cidade: 'X', ano: 2024, cargo: 'Prefeito', ids: [...ids, 'Prefeito|15|MARIA'] });
  assert.ok(quatro.candidatos.length <= 3);
});

test('faixas do TSE: idade, escolaridade e correlação', () => {
  assert.deepEqual(faixaEtaria('21 a 24 anos'), { de: 21, ate: 24, meio: 23 });
  assert.deepEqual(faixaEtaria('16 anos'), { de: 16, ate: 16, meio: 16.5 });
  assert.equal(faixaEtaria('100 anos ou mais').de, 100);
  assert.equal(faixaEtaria('Inválida'), null);
  assert.deepEqual(['ANALFABETO', 'LÊ E ESCREVE', 'ENSINO FUNDAMENTAL INCOMPLETO', 'ENSINO MÉDIO COMPLETO', 'SUPERIOR COMPLETO', 'NÃO INFORMADO'].map(anosDeEstudo), [0, 1, 4.5, 12, 16, null]);
  assert.deepEqual(['LÊ E ESCREVE', 'ENSINO FUNDAMENTAL COMPLETO', 'ENSINO MÉDIO INCOMPLETO', 'SUPERIOR INCOMPLETO'].map(nivelEscolar), ['e0', 'e1', 'e2', 'e3']);
  assert.equal(Math.round(correlacao([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]) * 100), 100);
  assert.equal(Math.round(correlacao([1, 2, 3, 4, 5], [10, 8, 6, 4, 2]) * 100), -100);
  assert.equal(correlacao([1, 2, 3], [1, 2, 3]), null, 'poucos pares');
});

/** Cidade de 12 urnas: na metade "velha" o eleitorado tem mais idosos e o candidato A vai melhor */
function cidadeSintetica() {
  const d = { cities: ['Y'], turnout: [], votes: [], profile: [] };
  for (let s = 1; s <= 12; s++) {
    const velha = s <= 6;
    const base = { city: 'Y', year: 2024, zone: '9', section: String(s), localCode: velha ? 'L1' : 'L2', localName: velha ? 'ESCOLA VELHA' : 'ESCOLA NOVA' };
    d.turnout.push({ ...base, aptos: 300, turnout: 240, abstentions: 60 });
    const a = velha ? 120 + s * 5 : 40 + s;
    const b = 200 - a;
    d.votes.push({ ...base, cargo: 'Prefeito', candidateNumber: '10', candidateName: 'ANTÔNIA', party: 'P1', votes: a });
    d.votes.push({ ...base, cargo: 'Prefeito', candidateNumber: '20', candidateName: 'BRUNO', party: 'P2', votes: b });
    const idosos = velha ? 120 + s : 40 + s;
    const prof = (dimension, category, count) => d.profile.push({ ...base, dimension, category, count });
    prof('Faixa etária', '25 a 29 anos', 300 - idosos);
    prof('Faixa etária', '65 a 69 anos', idosos);
    prof('Escolaridade', 'ENSINO MÉDIO COMPLETO', 200);
    prof('Escolaridade', 'SUPERIOR COMPLETO', 100);
    prof('Gênero', 'FEMININO', 150);
    prof('Gênero', 'MASCULINO', 150);
  }
  return d;
}

test('traçar perfil: onde ganhou, urnas mais fortes, relação com a idade e texto', () => {
  const d = cidadeSintetica();
  const p = perfilDoCandidato(d, { cidade: 'Y', ano: 2024, cargo: 'Prefeito', id: 'Prefeito|10|ANTÔNIA' });
  assert.equal(p.totalUrnas, 12);
  assert.equal(p.quartil, 3);
  assert.equal(p.grupos.venceu.urnas, 6, 'venceu nas 6 urnas da escola velha');
  assert.deepEqual(p.grupos.fortes.urnas, 3);
  assert.ok(p.grupos.fortes.ind.i60 > p.grupos.todas.ind.i60 + 0.1, 'mais idosos onde é forte');
  assert.ok(p.grupos.fortes.ind.idadeMedia > p.grupos.fracas.ind.idadeMedia);
  assert.equal(p.leituras.fortes.idade, 'bem mais velho');
  assert.equal(p.leituras.fortes.escolaridade, null, 'escolaridade igual em todas as urnas');
  const idade = p.relacoes.find((r) => r.id === 'idadeMedia');
  assert.ok(idade.r > 0.9 && idade.forca === 'relação forte');
  assert.match(p.manchete, /^Onde ANTÔNIA foi mais forte, o eleitorado é bem mais velho que a média de Y\.$/);
  assert.ok(p.frases.some((f) => f.startsWith('Ficou em 1º lugar em 6 urnas.')));
  assert.ok(p.frases.some((f) => /quanto mais velho o eleitorado, maior a votação/.test(f)));
  assert.ok(!p.frases.join(' ').match(/\b(ele|ela|dele|dela)\b/), 'texto neutro');
  assert.deepEqual(p.locais.map((l) => [l.local, l.urnas, l.total]), [['Escola Velha', 3, 6]]);
  assert.equal(p.melhores[0].secao, '6', 'maior fatia dos válidos');
  assert.deepEqual(p.selos.map((x) => x.texto), ['Eleitorado bem mais velho', 'Escolaridade na média']);
  const b = perfilDoCandidato(d, { cidade: 'Y', ano: 2024, cargo: 'Prefeito', id: 'Prefeito|20|BRUNO' });
  assert.equal(b.leituras.fortes.idade, 'bem mais jovem');
  assert.equal(perfilDoCandidato(d, { cidade: 'Y', ano: 2024, cargo: 'Prefeito', id: 'Prefeito|99|X' }), null);
});

test('relatórios por urna: Excel (com perfil) e PDF', () => {
  const d = cidadeSintetica();
  const ids = ['Prefeito|10|ANTÔNIA', 'Prefeito|20|BRUNO'];
  const t = votosPorUrna(d, { cidade: 'Y', ano: 2024, cargo: 'Prefeito', ids, comPerfil: true });
  assert.ok(t.linhas.every((l) => l.ind && l.ind.idadeMedia > 0), 'perfil de cada urna');
  const abas = abasVotosPorUrna(t);
  assert.deepEqual(abas.map((a) => a.nome), ['Votos por urna', 'Resumo']);
  const [urnas] = abas;
  assert.equal(urnas.linhas.length, 13, '12 urnas + total');
  assert.equal(urnas.colunas.length, urnas.linhas[0].length);
  assert.ok(urnas.colunas.some((c) => c.titulo === 'ANTÔNIA (10) - votos'));
  assert.ok(urnas.colunas.some((c) => c.titulo === '% de 60 anos ou mais'));
  const total = urnas.linhas.at(-1);
  assert.equal(total[2], 'Total (12 urnas)');
  const um = votosPorUrna(d, { cidade: 'Y', ano: 2024, cargo: 'Prefeito', ids: [ids[0]], comPerfil: true });
  const p = perfilDoCandidato(d, { cidade: 'Y', ano: 2024, cargo: 'Prefeito', id: ids[0] });
  const comPerfil = abasVotosPorUrna(um, p);
  assert.deepEqual(comPerfil.map((a) => a.nome), ['Votos por urna', 'Resumo', 'Perfil - comparação', 'Perfil - relação com o voto', 'Perfil - locais mais fortes']);
  assert.ok(comPerfil[1].linhas.some((l) => l[1] === p.manchete));
  const blocos = blocosVotosPorUrna(t, { dataText: '8 de novembro de 2026' });
  const tabela = blocos.filter((x) => x.type === 'table').at(-1);
  assert.equal(tabela.rows.length, 13);
  assert.equal(tabela.totalRows, 1);
  assert.equal(tabela.header.length, tabela.widths.length);
  assert.deepEqual(tabela.header.slice(3, 5), ['ANTÔNIA', 'BRUNO']);
  const comP = blocosVotosPorUrna(um, { dataText: 'x', perfil: p });
  assert.ok(comP.some((x) => x.type === 'heading' && x.text === 'Perfil de onde ANTÔNIA foi mais forte'));
  assert.ok(comP.findIndex((x) => x.type === 'pagebreak') > 0);
  for (const x of comP.filter((y) => y.type === 'table')) for (const r of x.rows) assert.equal(r.length, x.widths.length);
});
