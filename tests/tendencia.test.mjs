import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analisarTendencia, buscarTendencia, rotuloMes } from '../src/lib/tendencia.js';
import { refDoTexto } from '../src/lib/pncp.js';

const agora = new Date('2026-11-15T12:00:00-03:00');
const it = (pub, o = {}) => ({
  id: `${pub}-${Math.random()}`,
  pub: `${pub}T10:00:00`,
  atu: `${pub}T10:00:00`,
  fim: o.fim || null,
  valor: o.valor || 0,
  municipio: o.cidade || 'Ubá',
  uf: 'MG',
  orgao: o.orgao || 'Prefeitura',
  modalidade: 'Pregão - Eletrônico',
  objeto: 'toner',
  link: '',
  cancelado: !!o.cancelado,
});

test('analisarTendencia conta por mês, mede alta/baixa e acha os meses fortes', () => {
  const itens = [];
  // 24 meses completos (nov/24 a out/26) + o mês atual; março sempre forte; últimos 3 meses em alta
  for (let k = 0; k < 24; k++) {
    const d = new Date(Date.UTC(2024, 10 + k, 10));
    const mes = d.toISOString().slice(0, 10);
    const n = d.getUTCMonth() === 2 ? 9 : k >= 21 ? 6 : 3;
    for (let i = 0; i < n; i++) itens.push(it(mes, { valor: 1000, cidade: i % 2 ? 'Ubá' : 'Cataguases' }));
  }
  itens.push(it('2026-11-03', { fim: '2026-11-20T09:00', valor: 500 }));
  itens.push(it('2026-11-04', { cancelado: true }));
  const a = analisarTendencia({ itens, inicio: '2024-11-01', desde: '2024-11-01' }, agora);
  assert.equal(a.meses.length, 25);
  assert.equal(a.meses.at(-1).emAndamento, true);
  assert.equal(a.meses.at(-1).n, 1); // o cancelado não conta
  assert.equal(a.abertos, 1);
  assert.equal(a.status, 'alta'); // ago-out/26 = 18 contra mai-jul/26 = 9
  assert.ok(Math.abs(a.variacao - 1) < 1e-9);
  assert.equal(a.fortes[0], 'março');
  assert.equal(a.cidades.length, 2);
  assert.equal(rotuloMes('2026-03'), 'mar/26');
});

test('sem 6 meses completos não diz se está em alta', () => {
  const a = analisarTendencia({ itens: [it('2026-10-02'), it('2026-09-02')], inicio: '2026-09-01', desde: '2026-09-01' }, agora);
  assert.equal(a.status, 'sem-base');
  assert.equal(a.total, 2);
});

test('buscarTendencia para de ler quando passa do início do período', async () => {
  const paginas = [
    Array.from({ length: 3 }, (_, i) => ({
      numero_controle_pncp: `a${i}`,
      data_publicacao_pncp: '2026-10-05T10:00:00',
      data_atualizacao_pncp: '2026-10-05T10:00:00',
    })),
    Array.from({ length: 3 }, (_, i) => ({
      numero_controle_pncp: `b${i}`,
      data_publicacao_pncp: '2024-01-05T10:00:00',
      data_atualizacao_pncp: '2024-01-05T10:00:00',
    })),
    Array.from({ length: 3 }, (_, i) => ({
      numero_controle_pncp: `c${i}`,
      data_publicacao_pncp: '2023-01-05T10:00:00',
      data_atualizacao_pncp: '2023-01-05T10:00:00',
    })),
  ];
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    const p = Number(new URL(url).searchParams.get('pagina'));
    return new Response(JSON.stringify({ total: 9, items: paginas[p - 1] }), { status: 200 });
  };
  const r = await buscarTendencia({ q: 'toner', regiao: 'mg', meses: 12, agora, tamanho: 3, fetchImpl });
  assert.equal(urls.length, 2);
  assert.ok(urls[0].includes('status=todos') && urls[0].includes('q=toner') && urls[0].includes('ufs=MG'));
  assert.equal(r.completo, true);
  assert.equal(r.desde, '2025-11-01');
});

test('refDoTexto entende link e número de controle do PNCP', () => {
  assert.deepEqual(refDoTexto('https://pncp.gov.br/app/editais/17710096000184/2026/128'), { cnpj: '17710096000184', ano: '2026', seq: '128' });
  assert.deepEqual(refDoTexto('17.710.096/0001-84-1-000128/2026'), { cnpj: '17710096000184', ano: '2026', seq: '128' });
  assert.equal(refDoTexto('edital de toner'), null);
});
