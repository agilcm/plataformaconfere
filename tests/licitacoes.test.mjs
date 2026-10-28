import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contarFontes, fetchAllMG, fetchJson, filterEditais, fixText, fonteDe, mapItem, parseCompraRef, precoStats, sortByUpdate,
} from '../src/lib/pncp.js';
import { parseAlterdataCsv } from '../src/lib/sugestoes.js';

const resposta = (status, body = '') => ({ status, ok: status >= 200 && status < 300, text: async () => body });

test('fixText corrige acentuação quebrada e mantém texto correto', () => {
  assert.equal(fixText('aquisiÃ§Ã£o de material'), 'aquisição de material');
  assert.equal(fixText('  aquisição   de   material '), 'aquisição de material');
  assert.equal(fixText(null), '');
});

test('parseCompraRef aceita URL do PNCP e número de controle', () => {
  const esperado = { cnpj: '18338178000102', ano: '2026', seq: '15' };
  assert.deepEqual(parseCompraRef('/compras/18338178000102/2026/000015'), esperado);
  assert.deepEqual(parseCompraRef('18338178000102-1-000015/2026'), esperado);
  assert.equal(parseCompraRef('qualquer coisa'), null);
});

test('fonteDe usa nome conhecido da plataforma, colchetes do objeto ou "Não informada"', () => {
  assert.equal(fonteDe({ usuario_nome: 'ECUSTOMIZE CONSULTORIA EM SOFTWARE S.A' }), 'Portal de Compras Públicas');
  assert.equal(fonteDe({ usuario_nome: 'IPM SISTEMAS LTDA' }), 'IPM Sistemas');
  assert.equal(fonteDe({ description: '[Licitanet] Aquisição de pneus' }), 'Licitanet');
  assert.equal(fonteDe({}), 'Não informada');
});

test('mapItem monta link, microrregião e ignora valor zerado', () => {
  const e = mapItem({
    item_url: '/compras/18338178000102/2026/15', title: 'Pregão 1', description: 'Limpeza',
    municipio_nome: 'Juiz de Fora', valor_total_estimado: 0, data_publicacao_pncp: '2026-10-01',
  });
  assert.equal(e.link, 'https://pncp.gov.br/app/editais/18338178000102/2026/15');
  assert.equal(e.microrregiao, 'Juiz de Fora');
  assert.equal(e.valor, null);
  assert.equal(e.atualizadoEm, '2026-10-01');
});

test('filterEditais combina região, microrregião, fonte e busca sem acento', () => {
  const lista = [
    { id: 1, objeto: 'Aquisição de café', orgao: 'Prefeitura', municipio: 'Juiz de Fora', titulo: '', microrregiao: 'Juiz de Fora', fonte: 'BNC' },
    { id: 2, objeto: 'Serviço de limpeza', orgao: 'Prefeitura', municipio: 'Uberlândia', titulo: '', microrregiao: null, fonte: 'BLL Compras' },
    { id: 3, objeto: 'Limpeza urbana', orgao: 'Câmara', municipio: 'Muriaé', titulo: '', microrregiao: 'Muriaé', fonte: '' },
  ];
  const ids = (opts) => filterEditais(lista, opts).map((e) => e.id);
  assert.deepEqual(ids({}), [1, 2, 3]);
  assert.deepEqual(ids({ regiao: 'zona-da-mata' }), [1, 3]);
  assert.deepEqual(ids({ micro: 'Muriaé' }), [3]);
  assert.deepEqual(ids({ q: 'LIMPEZA' }), [2, 3]);
  assert.deepEqual(ids({ q: 'aquisicao cafe' }), [1]);
  assert.deepEqual(ids({ fontes: 'BNC|Não informada' }), [1, 3]);
});

test('contarFontes e sortByUpdate ordenam do maior para o menor', () => {
  assert.deepEqual(contarFontes([{ fonte: 'B' }, { fonte: 'A' }, { fonte: 'B' }, {}]), [
    { nome: 'B', total: 2 }, { nome: 'A', total: 1 }, { nome: 'Não informada', total: 1 },
  ]);
  assert.deepEqual(sortByUpdate([{ atualizadoEm: '2026-01-01' }, { atualizadoEm: '2026-03-01' }, {}]).map((e) => e.atualizadoEm), [
    '2026-03-01', '2026-01-01', undefined,
  ]);
});

test('precoStats prefere preço homologado e usa estimado como reserva', () => {
  const rows = [
    { item: { resultados: [{ valorUnitario: 10 }], valorUnitarioEstimado: 99 } },
    { item: { resultados: [], valorUnitarioEstimado: 20 } },
    { item: {} },
  ];
  assert.deepEqual(precoStats(rows), { menor: 10, medio: 15, maior: 20, n: 2 });
  assert.equal(precoStats([]), null);
});

test('fetchJson tenta de novo em erro 5xx e não repete erro 4xx', async () => {
  let chamadas = 0;
  const instavel = async () => (++chamadas === 1 ? resposta(503) : resposta(200, '{"ok":true}'));
  assert.deepEqual(await fetchJson('x', { fetchImpl: instavel, retries: 1 }), { ok: true });
  assert.equal(chamadas, 2);

  chamadas = 0;
  const naoEncontrado = async () => (chamadas++, resposta(404));
  await assert.rejects(fetchJson('x', { fetchImpl: naoEncontrado, retries: 3 }), { status: 404 });
  assert.equal(chamadas, 1);
});

test('fetchAllMG junta páginas e remove editais repetidos', async () => {
  const pagina = (n) => ({ total: 3, items: [{ item_url: `/compras/18338178000102/2026/${n}`, numero_controle_pncp: n === 2 ? 'dup' : `id${n}` }, { item_url: '/compras/18338178000102/2026/9', numero_controle_pncp: 'dup' }] });
  const fake = async (url) => resposta(200, JSON.stringify(pagina(Number(new URL(url).searchParams.get('pagina')))));
  const r = await fetchAllMG({ tamanho: 2 }, fake);
  assert.equal(r.total, 3);
  assert.equal(r.paginasComErro, 0);
  assert.deepEqual(r.items.map((e) => e.id).sort(), ['dup', 'id1']);
});

test('parseAlterdataCsv mantém só matrizes ativas com CNPJ, sem duplicar', () => {
  const csv = [
    'Razão Social;CNPJ;Status;Matriz/Filial;Código CNAE',
    'Alfa Ltda;11.222.333/0001-81;ATIVO;MATRIZ;8121-4/00',
    'Alfa Ltda;11.222.333/0001-81;ATIVO;MATRIZ;8121-4/00',
    'Beta Ltda;11.222.333/0002-62;ATIVO;FILIAL;8121-4/00',
    'Gama Ltda;44.555.666/0001-99;INATIVO;MATRIZ;8121-4/00',
    'Sem CNPJ;;ATIVO;MATRIZ;8121-4/00',
  ].join('\n');
  const { empresas, totalLinhas } = parseAlterdataCsv(csv);
  assert.equal(totalLinhas, 5);
  assert.deepEqual(empresas.map((e) => [e.razao, e.cnpj, e.cnae]), [['Alfa Ltda', '11222333000181', '8121400']]);
  assert.throws(() => parseAlterdataCsv('Nome;Outro\nx;y'), /Razão Social/);
});

test('filtrarPorCnaes mostra só editais ligados aos CNAEs da Ágil CM e diz quais casaram', async () => {
  const { filtrarPorCnaes } = await import('../src/lib/agilCnae.js');
  const { AGIL_CNAES } = await import('../src/data/agilCnaes.js');
  assert.equal(AGIL_CNAES.length, 19);
  assert.equal(AGIL_CNAES.filter((c) => c.principal).map((c) => c.codigo).join(), '81.21-4-00');
  const ed = (id, objeto, modalidade = 'Pregão - Eletrônico') => ({ id, titulo: 'Edital', objeto, modalidade });
  const lista = [
    ed(1, 'Contratação de empresa para prestação de serviços de limpeza e conservação predial'),
    ed(2, 'Registro de preços para aquisição de toner e cartuchos para impressoras'),
    ed(3, 'Execução de obra de pavimentação asfáltica'),
    ed(4, 'Aquisição de MATERIAL DE LIMPEZA e copa e cozinha'),
    ed(5, 'Leilão de veículos inservíveis e material de informática', 'Leilão - Eletrônico'),
    ed(6, 'Aquisição de gêneros alimentícios da agricultura familiar'),
    ed(7, 'Serviços de roçada, capina e poda de árvores'),
  ];
  const r = filtrarPorCnaes(lista);
  assert.deepEqual(r.map((e) => e.id), [1, 2, 4, 7]);
  assert.deepEqual(r[0].cnaes, ['81.21-4-00']);
  assert.ok(r[0].termos.includes('limpeza e conservacao'));
  assert.deepEqual(r[1].cnaes, ['47.51-2-01']);
  assert.deepEqual(r[2].cnaes, ['47.89-0-05', '47.89-0-99']);
  assert.deepEqual(r[3].cnaes, ['81.30-3-00']);
  assert.deepEqual(filtrarPorCnaes(lista, { cnaes: '81.30-3-00|43.21-5-00' }).map((e) => e.id), [7]);
});
