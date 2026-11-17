import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensagemOportunidades, oportunidades } from '../src/lib/oportunidades.js';
import { distancia } from '../src/lib/diagnostico.js';

const CIDADES = [
  { nome: 'Cataguases', uf: 'MG' },
  { nome: 'Leopoldina', uf: 'MG' },
];
const cache = {
  compras: {
    '1/2026/10': {
      orgao: 'Prefeitura de Ubá',
      municipio: 'Ubá',
      uf: 'MG',
      data: '2026-11-01',
      itens: [
        // BETA (Cataguases) em 2º por 1%: oportunidade; GAMA (BH) não é das cidades
        {
          n: '0001',
          d: 'Arroz',
          v: 10,
          c: [
            ['33333333000133', 1, 10, 1, 'X'],
            ['11111111000111', 2, 10.1, 2, 'BETA'],
            ['44444444000144', 3, 10.2, 1, 'GAMA'],
          ],
        },
        // BETA em 3º por 30%: longe, não avisa
        {
          n: '0002',
          d: 'Feijão',
          v: 10,
          c: [
            ['33333333000133', 1, 10, 1, 'X'],
            ['55555555000155', 2, 12, 1, 'Y'],
            ['11111111000111', 3, 13, 1, 'BETA'],
          ],
        },
        // DELTA (Leopoldina): melhor preço e não levou; e empate em outro item
        {
          n: '0003',
          d: 'Café',
          v: 20,
          c: [
            ['22222222000122', 0, 18, 1, 'DELTA'],
            ['33333333000133', 1, 20, 1, 'X'],
          ],
        },
        {
          n: '0004',
          d: 'Açúcar',
          v: 5,
          c: [
            ['33333333000133', 1, 5, 1, 'X'],
            ['22222222000122', 2, 5, 1, 'DELTA'],
          ],
        },
      ],
    },
    // licitação antiga (mais de 60 dias): não vira aviso, mesmo com oportunidade
    '1/2026/2': {
      orgao: 'Prefeitura de Ubá',
      municipio: 'Ubá',
      uf: 'MG',
      data: '2026-03-01',
      itens: [
        {
          n: '0001',
          d: 'Arroz',
          v: 10,
          c: [
            ['33333333000133', 1, 10, 1, 'X'],
            ['11111111000111', 2, 10.1, 1, 'BETA'],
          ],
        },
      ],
    },
  },
  cnpj: {
    11111111000111: { r: 'BETA LTDA', m: 'CATAGUASES', u: 'MG' },
    22222222000122: { r: 'DELTA LTDA', m: 'LEOPOLDINA', u: 'MG' },
    33333333000133: { r: 'X LTDA', m: 'UBA', u: 'MG' },
    44444444000144: { r: 'GAMA LTDA', m: 'BELO HORIZONTE', u: 'MG' },
    55555555000155: { r: 'Y LTDA', m: 'UBA', u: 'MG' },
  },
};

test('oportunidades: só das cidades escolhidas, perto ou com o melhor preço, recentes e uma vez só', () => {
  const l = oportunidades(cache, CIDADES, { hoje: '2026-11-17' });
  assert.deepEqual(
    l.map((g) => [g.razao, g.itens.map((i) => i.item).join(' ')]),
    [
      ['DELTA LTDA', '0003 0004'],
      ['BETA LTDA', '0001'],
    ],
    'DELTA primeiro (melhor preço sem levar); o 3º de BETA longe da vencedora e a licitação antiga ficam de fora',
  );
  assert.equal(oportunidades(cache, CIDADES, { hoje: '2026-11-17', avisados: { '1/2026/10|22222222000122': '2026-11-16' } }).length, 1, 'já avisada não volta');
});

test('mensagem: empresa, cidade, órgão, item, colocação, empate e link', () => {
  const t = mensagemOportunidades(oportunidades(cache, CIDADES, { hoje: '2026-11-17' }));
  assert.match(t, /2 oportunidades novas/);
  assert.match(t, /<b>DELTA LTDA<\/b> \(Leopoldina\) · Prefeitura de Ubá, 01\/11\/2026/);
  assert.match(t, /melhor preço e não levou no item 3 \(Café\)/);
  assert.match(t, /2º lugar no item 4 \(Açúcar\), mesmo preço da vencedora \(perdeu no desempate\)/);
  assert.match(t, /2º lugar no item 1 \(Arroz\), \+1% da vencedora/);
  assert.match(t, /href="https:\/\/pncp\.gov\.br\/app\/editais\/1\/2026\/10"/);
  assert.equal(mensagemOportunidades([]), '');
});

test('distância: empate de preço e de desconto', () => {
  assert.deepEqual(distancia({ col: 2, melhor: 5, venc: 5 }), { valor: 0, texto: 'mesmo preço', empate: true });
  assert.equal(distancia({ col: 2, melhor: 20, venc: 20, desconto: true }).texto, 'mesmo desconto');
  assert.equal(distancia({ col: 2, melhor: 10.1, venc: 10 }).empate, undefined);
});
