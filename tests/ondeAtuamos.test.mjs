import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { categoriaDoItem, categoriasDoObjeto, categoriasDoProcesso, objetoLegivel, orgaoEMunicipio, resumoAtuacao } from '../src/lib/ondeAtuamos.js';

test('órgão e município saem do nome que vem no termo', () => {
  assert.deepEqual(orgaoEMunicipio('Prefeitura Municipal de Guarani - MUNICÍPIO DE GUARANI'), {
    orgao: 'Prefeitura Municipal de Guarani',
    municipio: 'Guarani',
    uf: 'MG',
    tipo: 'Prefeitura',
  });
  assert.equal(orgaoEMunicipio('Prefeitura Municípal de Pedra Bonita').orgao, 'Prefeitura Municipal de Pedra Bonita');
  assert.equal(orgaoEMunicipio('Câmara Municipal de São Pedro dos Ferros').municipio, 'São Pedro dos Ferros');
  assert.deepEqual(orgaoEMunicipio('SAAE de Abre Campo'), { orgao: 'SAAE de Abre Campo', municipio: 'Abre Campo', uf: 'MG', tipo: 'Serviço de água e esgoto' });
  assert.equal(orgaoEMunicipio('Prefeitura Municipal de Sete Lagoas - Núcleo de Licitações e Compras').municipio, 'Sete Lagoas');
  assert.equal(orgaoEMunicipio('Prefeitura Municipal de Presidente Prudente').uf, 'SP');
});

test('tipo de material: o nome do produto no começo da descrição decide', () => {
  assert.equal(categoriaDoItem('CANETA ESFEROGRÁFICA BPS AZULCAIXA COM 12 UNIDADES'), 'papelaria');
  assert.equal(categoriaDoItem('Cabo de Rede 4 ParesCabo de rede UTP 4 Pares, 23 AWG, Cat6'), 'informatica');
  assert.equal(categoriaDoItem('TV 43 POLEGADAS LED FULL HD'), 'eletro');
  assert.equal(categoriaDoItem('ARROZArroz beneficiado, polido, longo fino, tipo 1.'), 'alimentos');
  assert.equal(categoriaDoItem('PRATO FUNDO, DE VIDRO LISO TRANSPARENTE COM 22CM'), 'cozinha');
  assert.equal(categoriaDoItem('BOLA DE FUTEBOL BOLA DE FUTEBOL Tamanho: 5'), 'esporte');
  assert.equal(categoriaDoItem('Bola leitosa irisada passante 10mm'), 'artesanato', 'miçanga não é bola de esporte');
  assert.equal(categoriaDoItem('Adaptador Emenda dupla RJ11 Emenda dupla; Conectores'), null, '"conectores" não é cone');
  assert.equal(categoriaDoItem('TABULEIRO OU ASSADEIRA 30 CM'), 'cozinha');
  assert.equal(categoriaDoItem(''), null);
});

test('tipos do processo: os dos itens vencidos; sem itens reconhecidos, os do objeto', () => {
  const p = {
    objeto: 'Aquisição de material de limpeza, higiene pessoal e eletrodomésticos',
    itens: [{ descricao: 'LIQUIDIFICADOR DOMÉSTICO 3L.' }, { descricao: 'VENTILADOR DE COLUNA 40CM.' }],
  };
  assert.deepEqual(categoriasDoProcesso(p), ['eletro'], 'a Ágil venceu só os eletrodomésticos');
  assert.deepEqual(categoriasDoProcesso({ ...p, itens: [] }), categoriasDoObjeto(p.objeto));
  assert.ok(categoriasDoObjeto(p.objeto).includes('limpeza'));
  // um item solto entre muitos não vira tipo fornecido
  const muitos = { objeto: '', itens: [...Array(9).fill({ descricao: 'CANETA AZUL' }), { descricao: 'TV 43 POLEGADAS' }] };
  assert.deepEqual(categoriasDoProcesso(muitos), ['papelaria']);
});

test('objeto legível: sem caixa alta, sem a cauda jurídica e com tamanho limitado', () => {
  assert.equal(
    objetoLegivel('AQUISIÇÃO DE MATERIAL ESCOLAR PARA ATENDER A DEMANDA DA SECRETARIA DE EDUCAÇÃO, CONFORME TERMO DE REFERÊNCIA.'),
    'Aquisição de material escolar para atender a demanda da secretaria de educação',
  );
  assert.equal(
    objetoLegivel('Constitui objeto do presente processo a escolha da proposta mais vantajosa para a contratação de empresa para fornecer toner.'),
    'Contratação de empresa para fornecer toner',
  );
  const longo = objetoLegivel(`Registro de preços para ${'aquisição de materiais diversos '.repeat(12)}`);
  assert.ok(longo.length <= 171 && longo.endsWith('…'));
});

test('resumo público: agrupa por município e órgão, só o que a Ágil venceu, e nunca leva valor', () => {
  const processos = [
    {
      orgao: 'Prefeitura Municipal de Rodeiro',
      agilVenceu: true,
      modalidade: 'Pregão',
      dataDocumento: '2025-07-04',
      objeto: 'Registro de preços para materiais escolares',
      valorAgil: 12345.67,
      itens: [{ descricao: 'CADERNO BROCHURAO', unitario: 9.9, subtotal: 990, marca: 'x' }],
      termos: [{ link: 'https://drive.google.com/file/d/abc/view' }],
    },
    { orgao: 'Câmara Municipal de Rodeiro', agilVenceu: true, modalidade: 'Pregão', dataDocumento: '2024-07-15', objeto: 'Materiais de limpeza', itens: [] },
    { orgao: 'Prefeitura Municipal de Rodeiro', agilVenceu: true, modalidade: 'Dispensa', dataDocumento: '2026-01-10', objeto: 'Toner', itens: [] },
    { orgao: 'Prefeitura Municipal de Ubá', agilVenceu: false, modalidade: 'Pregão', dataDocumento: '2025-01-01', objeto: 'Não venceu', itens: [] },
  ];
  const r = resumoAtuacao(processos, '2026-11-15T16:40:05.434Z');
  assert.deepEqual(r.totais, { processos: 3, orgaos: 2, municipios: 1, desde: '2024', ate: '2026' });
  assert.equal(r.atualizadoEm, '2026-11-15');
  assert.deepEqual(
    r.municipios[0].orgaos.map((o) => [o.nome, o.processos, o.anos.join('-')]),
    [
      ['Prefeitura Municipal de Rodeiro', 2, '2025-2026'],
      ['Câmara Municipal de Rodeiro', 1, '2024'],
    ],
  );
  const texto = JSON.stringify(r);
  for (const proibido of ['12345', '9.9', '990', 'drive.google', 'unitario', 'valor', 'marca', 'Não venceu']) assert.ok(!texto.includes(proibido), proibido);
});

test('resumo publicado no site: tem órgãos, não tem valores nem links da pasta', () => {
  const texto = fs.readFileSync(new URL('../src/data/ondeAtuamos.json', import.meta.url), 'utf8');
  const r = JSON.parse(texto);
  assert.ok(r.totais.processos > 0 && r.totais.orgaos > 0 && r.municipios.length === r.totais.municipios);
  assert.equal(
    r.municipios.reduce((s, m) => s + m.orgaos.reduce((t, o) => t + o.fornecimentos.length, 0), 0),
    r.totais.processos,
  );
  assert.ok(!/R\$|drive\.google|"valor|"unitario|"subtotal|"quantidade|"cnpj/i.test(texto));
  // só as chaves previstas em cada fornecimento
  for (const m of r.municipios)
    for (const o of m.orgaos) for (const f of o.fornecimentos) assert.deepEqual(Object.keys(f).sort(), ['ano', 'categorias', 'modalidade', 'objeto']);
});
