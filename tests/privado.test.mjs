import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarLinhas } from '../src/lib/privado/linhas.js';
import { classificar, lerAta, lerTermo } from '../src/lib/privado/termo.js';
import { PASTA, planejar } from '../src/lib/privado/plano.js';
import { consolidarProdutos, csvItens, resumo } from '../src/lib/privado/relatorios.js';

// linha no formato de linhas.js: [texto, x] por coluna
let yy = 0;
const L = (pagina, ...partes) => {
  yy += 14;
  const ps = partes.map(([t, x]) => ({ t, x, xf: x + t.length * 5 }));
  return { texto: ps.map((p) => p.t).join('   '), x: ps[0].x, xf: ps[ps.length - 1].xf, y: yy, pagina, partes: ps };
};

function termo({ tipo = 'HOMOLOGAÇÃO', verbo = 'HOMOLOGAR', orgao = 'Prefeitura Municipal de Ubá', processo = '10/2025' } = {}) {
  yy = 0;
  const rod = (p) => L(p, [`AMM Licita :: ${orgao} - Unidade Única`, 45], [`Página ${p + 1} de 2`, 500]);
  return [
    L(0, [`TERMO DE ${tipo}`, 200]),
    L(0, ['No uso de suas atribuições legais e em conformidade com a legislação vigente constante no preâmbulo', 43]),
    L(0, [`do Edital de Dispensa sem fase recursal nº 4/2025, Processo Administrativo nº ${processo}, após análise,`, 43]),
    L(0, [`conferência e deliberação, resolve ${verbo} o procedimento em epígrafe, nos seguintes termos:`, 43]),
    L(0, ['Objeto: Aquisição de gêneros alimentícios.', 43]),
    L(0, ['Resumo', 270]),
    L(0, ['Fornecedor', 47], ['Estimado', 341], ['Homologado', 410], ['Diferença', 508]),
    L(0, ['Agil Cm Produtos Alimenticios LTDA - 51.328.978/0001-18', 47], ['690,30', 527]),
    L(0, ['3.529,50', 354], ['2.839,20', 431]),
    L(0, ['agilcmprodutosalimenticios@gmail.com - (32) 98408-1090', 47], ['Proveito ( 19,56% )', 488]),
    L(0, ['Totais', 47], ['21.652,84', 339], ['17.832,86', 420]),
    L(0, ['Detalhes', 268]),
    L(0, ['Fornecedor: JC Teixeira & Cia Ltda - CPF/CNPJ: 41.737.131/0001-33', 47]),
    L(0, ['Lote 1', 47], ['Data/Hora da Homologação - 06/03/2025 07:59:40', 364]),
    L(0, ['Descrição Item', 47], ['Quantidade', 347], ['Medida', 415], ['Unitário', 462], ['Sub Total', 508]),
    L(0, ['LEITE INTEGRAL', 47], ['2.064,00', 370], ['UN', 420], ['4,43', 480], ['9.143,52', 515]),
    rod(0),
    L(1, ['Fornecedor: Agil Cm Produtos Alimenticios LTDA - CPF/CNPJ: 51.328.978/0001-18', 47]),
    L(1, ['Lote 2', 47], ['Data/Hora da Homologação - 06/03/2025 07:59:40', 364]),
    L(1, ['OLEO DE SOJA', 47]),
    L(1, ['Descrição Item', 47], ['Quantidade', 347], ['Medida', 415], ['Unitário', 462], ['Sub Total', 508]),
    L(1, ['OLEO DE SOJA TIPO 1,', 47]),
    L(1, ['390,00', 379], ['UN', 420], ['7,28', 480], ['2.839,20', 515]),
    L(1, ['GARRAFA PET 900 ML', 47]),
    L(1, ['Marca: Soya', 47], ['Fabricante: Bunge', 220], ['Modelo: 900ml', 388]),
    L(1, ['Ubá, 06 de Março de 2025.', 43]),
    rod(1),
  ];
}

test('montarLinhas junta trechos da mesma altura e separa colunas distantes', () => {
  const ls = montarLinhas([[
    { str: 'Lote 2', x: 47, y: 100, w: 30, h: 8 },
    { str: 'Data/Hora da Homologação', x: 364, y: 100.5, w: 100, h: 8 },
    { str: 'OLEO', x: 47, y: 120, w: 22, h: 8 },
    { str: 'DE SOJA', x: 71, y: 120, w: 35, h: 8 },
  ]]);
  assert.equal(ls.length, 2);
  assert.deepEqual(ls[0].partes.map((p) => p.t), ['Lote 2', 'Data/Hora da Homologação']);
  assert.equal(ls[1].texto, 'OLEO DE SOJA');
});

test('lerTermo extrai órgão, processo, datas, total e itens da AGIL', () => {
  const t = lerTermo(termo());
  assert.equal(t.tipo, 'homologacao');
  assert.equal(t.orgao, 'Prefeitura Municipal de Ubá');
  assert.deepEqual(t.processo, { numero: '10', ano: '2025' });
  assert.deepEqual(t.edital, { numero: '4', ano: '2025' });
  assert.equal(t.modalidade, 'Dispensa');
  assert.equal(t.dataDocumento, '2025-03-06');
  assert.equal(t.dataTermo, '2025-03-06T07:59:40');
  assert.equal(t.valorAgil, 2839.2);
  assert.equal(t.estimadoAgil, 3529.5);
  assert.equal(t.itens.length, 1, 'o leite é de outro fornecedor');
  const [it] = t.itens;
  assert.equal(it.descricao, 'OLEO DE SOJA TIPO 1, GARRAFA PET 900 ML');
  assert.deepEqual([it.lote, it.quantidade, it.medida, it.unitario, it.subtotal], ['2', 390, 'UN', 7.28, 2839.2]);
  assert.deepEqual([it.marca, it.fabricante, it.modelo], ['Soya', 'Bunge', '900ml']);
  assert.equal(t.conferido, true);
});

test('classificar separa homologação, adjudicação, ata e outros documentos', () => {
  assert.equal(classificar(termo({ tipo: 'ADJUDICAÇÃO', verbo: 'ADJUDICAR' })), 'adjudicacao');
  yy = 0;
  const ata = [L(0, ['ATA PREGÃO', 250]), L(0, ['PREGÃO Nº. 05/2024 PROCESSO LICITATÓRIO Nº. 31/2024', 60]), L(0, ['Às 09:00 do dia 29/07/2024, reuniu-se o(a) Pregoeiro(a)', 43])];
  assert.equal(classificar(ata), 'ata');
  assert.deepEqual(lerAta(ata), { processo: { numero: '31', ano: '2024' }, dataPregao: '2024-07-29T09:00' });
  assert.equal(classificar([L(0, ['EDITAL DE PREGÃO ELETRÔNICO', 200]), L(0, ['O termo de homologação será publicado', 43])]), 'outro');
});

// ---------------------------------------------------------------- planejamento da organização
const pasta = (id, name, filhos = [], appProperties) => ({ id, name, mimeType: PASTA, filhos, appProperties, webViewLink: `L/${id}` });
const pdf = (id, name, md5 = id) => ({ id, name, mimeType: 'application/pdf', md5Checksum: md5, webViewLink: `L/${id}` });

function aplicar(raiz, ops) {
  const idx = new Map();
  const pai = new Map();
  (function ix(n) {
    idx.set(n.id, n);
    for (const f of n.filhos || []) {
      pai.set(f.id, n.id);
      ix(f);
    }
  })(raiz);
  const refs = new Map();
  const r = (x) => refs.get(x) || x;
  for (const o of ops) {
    if (o.op === 'criar') {
      const n = pasta(`c${refs.size}`, o.nome, [], o.props);
      refs.set(o.ref, n.id);
      idx.get(r(o.pai)).filhos.push(n);
      idx.set(n.id, n);
      pai.set(n.id, r(o.pai));
      continue;
    }
    const n = idx.get(o.id);
    assert.equal(pai.get(o.id), r(o.de), `pai atual de ${n.name}`);
    const de = idx.get(r(o.de));
    de.filhos = de.filhos.filter((f) => f.id !== o.id);
    idx.get(r(o.para)).filhos.push(n);
    pai.set(o.id, r(o.para));
    if (o.nome) n.name = o.nome;
    if (o.props) n.appProperties = { ...(n.appProperties || {}), ...o.props };
  }
}

test('planejar organiza por órgão e processo, marca pastas sem termo e não repete na segunda vez', () => {
  const hom = lerTermo(termo());
  const camara = lerTermo(termo({ orgao: 'Câmara Municipal de Rodeiro', processo: '22/2025' }));
  const raiz = pasta('raiz', 'Licitacoes - Agil', [
    pasta('p1', '0010-2025 - PM Uba', [pdf('t1', 'mpdf.pdf'), pdf('e1', 'edital.pdf'), pasta('sub', 'Nova pasta', [pdf('t1b', 'mpdf (2).pdf')])]),
    pasta('p2', '0022-2025 - PM Rodeiro', [pdf('t2', 'mpdf (2).pdf')]),
    pasta('p3', 'xxx0018-2024 - CM Uba', [pdf('e3', 'proposta.pdf')]),
    pdf('solto', 'mpdf (7).pdf', 't1'),
    { id: 'txt', name: 'Dados.txt', mimeType: 'text/plain' },
  ]);
  const analises = new Map([
    ['t1', { tipo: 'homologacao', termo: hom }],
    ['t1b', { tipo: 'adjudicacao', termo: { ...hom, tipo: 'adjudicacao' } }],
    ['t2', { tipo: 'homologacao', termo: camara }],
    ['solto', { tipo: 'homologacao', termo: hom }],
    ['e1', { tipo: 'outro' }],
    ['e3', { tipo: 'outro' }],
    ['txt', { tipo: 'nao-pdf' }],
  ]);
  const r1 = planejar(raiz, analises);
  assert.deepEqual(r1.pendencias.map((p) => p.nome), ['xxx0018-2024 - CM Uba']);
  assert.equal(r1.processos.length, 2);
  const uba = r1.processos.find((p) => p.orgao.includes('Ubá'));
  assert.equal(uba.termos.length, 2);
  assert.equal(uba.valorAgil, 2839.2);
  assert.ok(r1.avisos.some((a) => a.nome === 'mpdf (7).pdf'), 'cópia repetida avisada');

  aplicar(raiz, r1.ops);
  const nomes = (n) => (n.filhos || []).map((f) => f.name).sort();
  assert.deepEqual(nomes(raiz), ['Câmara Municipal de Rodeiro', 'Outros', 'Prefeitura Municipal de Ubá', 'xxx0018-2024 - CM Uba']);
  const proc = raiz.filhos.find((f) => f.name === 'Prefeitura Municipal de Ubá').filhos[0];
  assert.equal(proc.name, 'Processo 010-2025 - Dispensa 004-2025');
  assert.deepEqual(nomes(proc), ['Outros', 'Processo 010-2025 - Termo de Adjudicação.pdf', 'Processo 010-2025 - Termo de Homologação.pdf']);
  assert.deepEqual(nomes(proc.filhos.find((f) => f.name === 'Outros')), ['Nova pasta', 'edital.pdf']);
  assert.deepEqual(nomes(raiz.filhos.find((f) => f.name === 'Outros')), ['Dados.txt', 'mpdf (7).pdf']);

  const r2 = planejar(raiz, analises);
  assert.equal(r2.ops.length, 0);
  assert.equal(r2.processos.length, 2);
  assert.ok(r2.processos.every((p) => p.pasta));

  // termo salvo depois na pasta pendente: entra na próxima organização
  raiz.filhos.find((f) => f.id === 'p3').filhos.push(pdf('t3', 'termo.pdf'));
  analises.set('t3', { tipo: 'homologacao', termo: lerTermo(termo({ orgao: 'Câmara Municipal de Ubá', processo: '18/2024' })) });
  const r3 = planejar(raiz, analises);
  assert.equal(r3.pendencias.length, 0);
  assert.equal(r3.processos.length, 3);
});

test('relatórios somam produtos e geram CSV para Excel', () => {
  const t = lerTermo(termo());
  const p = { ...t, termos: [], termoUsado: 'homologacao', pasta: null };
  const outro = { ...p, orgao: 'Câmara Municipal de Ubá', processo: { numero: '25', ano: '2024' }, itens: t.itens.map((i) => ({ ...i, quantidade: 10, subtotal: 72.8 })), valorAgil: 72.8 };
  const prods = consolidarProdutos([p, outro]);
  assert.equal(prods.length, 1);
  assert.deepEqual([prods[0].quantidade, prods[0].valor, prods[0].processos], [400, 2912, 2]);
  assert.equal(resumo([p, outro]).total, 2912);
  const csv = csvItens([p]);
  assert.ok(csv.startsWith('﻿"Órgão";'));
  assert.match(csv, /"OLEO DE SOJA TIPO 1, GARRAFA PET 900 ML";"390";"UN";"7,28";"2\.839,20";"Soya"/);
});
