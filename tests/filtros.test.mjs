import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COORDS } from '../src/data/coordenadasMunicipios.js';
import {
  diasPara,
  distanciaKm,
  filtrarAvancado,
  grupoModalidade,
  ordenarEditais,
  raioXItens,
  resumoEditais,
  termosExcluir,
} from '../src/lib/filtrosEditais.js';

const agora = new Date('2026-11-02T12:00:00-03:00');
const ed = (o) => ({
  id: o.id,
  objeto: o.objeto || 'Aquisição de material',
  titulo: 'Edital',
  modalidade: o.modalidade || 'Pregão - Eletrônico',
  valor: o.valor ?? null,
  propostasAte: o.ate ?? null,
  srp: !!o.srp,
  esfera: o.esfera || 'M',
  ibge: o.ibge || '',
  municipio: o.municipio || '',
});

const lista = [
  ed({ id: 'a', valor: 30_000, ate: '2026-11-02T09:00', srp: true, ibge: '3169901' }), // Ubá, hoje
  ed({ id: 'b', valor: 150_000, ate: '2026-11-05T09:00', modalidade: 'Dispensa', ibge: '3136702' }), // Juiz de Fora
  ed({ id: 'c', valor: 2_000_000, ate: '2026-11-20T09:00', objeto: 'Contratação de obra de pavimentação', ibge: '3106200', esfera: 'E' }), // BH
  ed({ id: 'd', valor: null, ate: null, modalidade: 'Concorrência - Eletrônica', ibge: '3104601' }), // Astolfo Dutra
];

test('grupoModalidade junta os nomes do PNCP', () => {
  assert.equal(grupoModalidade('Pregão - Eletrônico'), 'Pregão eletrônico');
  assert.equal(grupoModalidade('Pregão - Presencial'), 'Pregão presencial');
  assert.equal(grupoModalidade('Dispensa de Licitação'), 'Dispensa');
  assert.equal(grupoModalidade('Concorrência - Eletrônica'), 'Concorrência');
  assert.equal(grupoModalidade('Diálogo Competitivo'), 'Outras');
});

test('diasPara conta dias corridos no horário de Brasília', () => {
  assert.equal(diasPara('2026-11-02T23:00', agora), 0);
  assert.equal(diasPara('2026-11-03T08:00', agora), 1);
  assert.equal(diasPara('2026-11-01T08:00', agora), -1);
  assert.equal(diasPara(null, agora), null);
});

test('filtros de modalidade, valor, prazo, registro de preços, esfera e palavras', () => {
  const ids = (f) => filtrarAvancado(lista, f, { agora }).map((e) => e.id);
  assert.deepEqual(ids({ modalidades: ['Dispensa'] }), ['b']);
  assert.deepEqual(ids({ valor: '50a200' }), ['b']);
  assert.deepEqual(ids({ valor: 'sem' }), ['d']);
  assert.deepEqual(ids({ prazo: 'hoje' }), ['a']);
  assert.deepEqual(ids({ prazo: '3' }), ['a', 'b']);
  assert.deepEqual(ids({ prazo: 'mais7' }), ['c']);
  assert.deepEqual(ids({ srp: 'sim' }), ['a']);
  assert.deepEqual(ids({ esfera: 'E' }), ['c']);
  assert.deepEqual(ids({ excluir: 'obra, engenharia' }), ['a', 'b', 'd']);
  assert.deepEqual(termosExcluir('obra; x, Locação  '), ['obra', 'locacao']);
});

test('distância a partir de Astolfo Dutra', () => {
  const km = distanciaKm(COORDS['3104601'], COORDS['3169901']);
  assert.ok(km > 15 && km < 40, `Astolfo Dutra–Ubá ${km}`);
  const perto = filtrarAvancado(lista, { raio: 100, base: '3104601' }, { coords: COORDS, agora }).map((e) => e.id);
  assert.deepEqual(perto, ['a', 'b', 'd']);
  const ordem = ordenarEditais(lista, 'distancia', { coords: COORDS, base: '3104601' }).map((e) => e.id);
  assert.deepEqual(ordem, ['d', 'a', 'b', 'c']);
});

test('ordenação por prazo e valor', () => {
  assert.deepEqual(
    ordenarEditais(lista, 'prazo').map((e) => e.id),
    ['a', 'b', 'c', 'd'],
  );
  assert.deepEqual(
    ordenarEditais(lista, 'valor-desc').map((e) => e.id),
    ['c', 'b', 'a', 'd'],
  );
  assert.deepEqual(
    ordenarEditais(lista, 'valor-asc').map((e) => e.id),
    ['a', 'b', 'c', 'd'],
  );
});

test('resumo e Raio-X', () => {
  const r = resumoEditais(lista, agora);
  assert.equal(r.total, 4);
  assert.equal(r.valor, 2_180_000);
  assert.equal(r.semValor, 1);
  assert.equal(r.encerra3, 2);
  assert.equal(r.srp, 1);
  assert.equal(r.porModalidade[0].nome, 'Pregão eletrônico');
  const x = raioXItens([
    { beneficio: 'Participação exclusiva para ME/EPP', tipo: 'Material', criterio: 'Menor preço', valorTotalEstimado: 100 },
    { beneficio: 'Cota reservada para ME/EPP', tipo: 'Material', criterio: 'Menor preço', valorUnitarioEstimado: 10, quantidade: 3 },
    { beneficio: 'Sem benefício', tipo: 'Serviço', sigiloso: true },
  ]);
  assert.deepEqual([x.total, x.exclusivos, x.cota, x.materiais, x.servicos, x.sigilosos, x.valor], [3, 1, 1, 2, 1, 1, 130]);
  assert.deepEqual(x.criterios, ['Menor preço']);
});
