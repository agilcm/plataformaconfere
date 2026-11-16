import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { classificarItem, descricaoCurta, ehAtaPcp, lancesSobem, lerAtaPcp } from '../src/lib/ataPcp.js';
import {
  diferenca,
  filtrarCampeoes,
  filtrarClientes,
  linhasPlanilha,
  linhasPlanilhaCampeoes,
  montarCampeoes,
  montarClientes,
  nomeSemCpf,
  textoColocacao,
} from '../src/lib/possiveisClientes.js';
import { pdfDoZip } from '../scripts/possiveis-clientes.mjs';

// Ata de mentira, no formato das linhas que saem do PDF do Portal de Compras Públicas (colunas separadas por 3 espaços)
const ATA = `ATA FINAL
Prefeitura Municipal de Exemplo
Prefeitura Municipal de Exemplo
Registro de Preços Eletrônico - PROCESSO ADMINISTRATIVO Nº 026/2026
Itens Licitados
Código   Produto   V. Referência   Qtde   Unidade   Situação
0001   AÇÚCAR CRISTAL emb. 5Kg   R$ 20,00   100   PCT   Homologado
Vencedores
Código   Produto   Fornecedor   Modelo   Marca/ Fabricante   Valor   Quantidade   Valor Total
Ofertado
0001   AÇÚCAR CRISTAL: De 1ª,   ALFA   5KG   DOCE   14,00   100   1.400,00
contendo no mínimo   DISTRIBUIDORA
0002   CANETA AZUL   GAMA PAPEIS   BIC   BIC   1,10   50   55,00
Propostas Enviadas
0001 - AÇÚCAR CRISTAL
Lances Enviados
0001 - AÇÚCAR CRISTAL: De 1ª, contendo no mínimo 99,3% de carboidrato por porção,
2026 - lote de fabricação recente - emb. 5Kg.
Data   Valor   CNPJ   Situação
16/04/2026 - 13:54:25   19,81 (proposta)   11.111.111/0001-11 - BETA GENEROS   Válido
ALIMENTICIOS LTDA
17/04/2026 - 14:35:13   18,95 (proposta)   22.222.222/0001-22 - ALFA   Válido
DISTRIBUIDORA DE ALIMENTOS LTDA
17/04/2026 - 16:08:30   10.000,00 (proposta)   33.333.333/0001-33 - DELTA MEDICOS LTDA   Válido
21/04/2026 - 19:17:04   19,81 (proposta)   44.444.444/0001-44 - FULANA DE TAL   Válido
05604031607
21/04/2026 - 19:20:00   19,00 (proposta)   123.456.789-09 - PESSOA FISICA   Válido
Página 44 de 132
A autenticidade do documento pode ser verificada no site https://validaarquivo.portaldecompraspublicas.com.br
22/04/2026 - 09:11:38   15,90   11.111.111/0001-11 - BETA GENEROS   Válido
ALIMENTICIOS LTDA
22/04/2026 - 09:12:12   14,00   22.222.222/0001-22 - ALFA   Válido
DISTRIBUIDORA DE ALIMENTOS LTDA
22/04/2026 - 09:14:09   14,50   44.444.444/0001-44 - FULANA DE TAL   Válido
05604031607
22/04/2026 - 09:15:00   13,00   11.111.111/0001-11 - BETA GENEROS   Cancelado
ALIMENTICIOS LTDA
0002 - CANETA AZUL
Data   Valor   CNPJ   Situação
16/04/2026 - 10:00:00   1,00 (proposta)   11.111.111/0001-11 - BETA GENEROS   Válido
ALIMENTICIOS LTDA
16/04/2026 - 11:00:00   1,10 (proposta)   55.555.555/0001-55 - GAMA PAPEIS LTDA   Válido
16/04/2026 - 12:00:00   1,30 (proposta)   22.222.222/0001-22 - ALFA   Válido
DISTRIBUIDORA DE ALIMENTOS LTDA
Documentos dos Fornecedores
Fornecedor   Documento
Chat
22/04/2026 - 09:01:00   Pregoeiro   0001 - bom dia a todos`.split('\n');

test('ata do Portal de Compras Públicas: itens, lances com CNPJ e vencedora de cada item', () => {
  assert.equal(ehAtaPcp(ATA), true);
  assert.equal(ehAtaPcp(['ATA DE SESSÃO', 'outro portal']), false);
  const a = lerAtaPcp(ATA);
  assert.equal(a.orgao, 'Prefeitura Municipal de Exemplo');
  assert.deepEqual(
    a.itens.map((i) => [i.codigo, i.lances.length, i.vencedorNome, i.vencedorValor]),
    [
      ['0001', 8, 'ALFA', 14],
      ['0002', 3, 'GAMA PAPEIS', 1.1],
    ],
  );
  assert.deepEqual(
    a.itens.map((i) => i.vencedorTotal),
    [1400, 55],
    'o valor total ganho vem da última coluna da tabela Vencedores',
  );
  assert.match(
    a.itens[0].descricao,
    /^AÇÚCAR CRISTAL.*2026 - lote de fabricação recente - emb\. 5Kg\.$/,
    'linha da descrição que parece cabeçalho não abre outro item',
  );
  const l = a.itens[0].lances[0];
  assert.deepEqual(l, {
    quando: '2026-04-16T13:54:25',
    valor: 19.81,
    proposta: true,
    cnpj: '11111111000111',
    nome: 'BETA GENEROS ALIMENTICIOS LTDA',
    situacao: 'Válido',
  });
  assert.equal(a.itens[0].lances.find((x) => x.valor === 10000).cnpj, '33333333000133');
  assert.ok(!a.itens[0].lances.some((x) => /PESSOA FISICA/.test(x.nome)), 'CPF (pessoa física) fica de fora');
});

test('classificação: vencedora em 1º, quem veio depois em 2º, 3º, 4º; lance cancelado não conta', () => {
  const [acucar, caneta] = lerAtaPcp(ATA).itens;
  assert.deepEqual(
    classificarItem(acucar).map((c) => [c.cnpj, c.colocacao, c.melhor, c.venceu]),
    [
      ['22222222000122', 1, 14, true],
      ['44444444000144', 2, 14.5, false],
      ['11111111000111', 3, 15.9, false], // o lance de 13,00 foi cancelado
      ['33333333000133', 4, 10000, false],
    ],
  );
  // a caneta foi para a GAMA (1,10): a BETA ofertou 1,00 e não levou → colocação 0
  assert.deepEqual(
    classificarItem(caneta).map((c) => [c.nome, c.colocacao]),
    [
      ['BETA GENEROS ALIMENTICIOS LTDA', 0],
      ['GAMA PAPEIS LTDA', 1],
      ['ALFA DISTRIBUIDORA DE ALIMENTOS LTDA', 2],
    ],
  );
  // sem vencedora na tabela, vale a ordem dos lances
  assert.deepEqual(
    classificarItem({ ...caneta, vencedorNome: '' }).map((c) => c.colocacao),
    [1, 2, 3],
  );
  assert.deepEqual(classificarItem({ lances: [], vencedorNome: '', vencedorValor: null }), []);
});

test('julgamento por lote: a vencedora vem pelo CNPJ do cabeçalho e o valor pelo total do lote', () => {
  const ata = `ATA FINAL
Prefeitura Municipal de Exemplo
Vencedores
EXTINTORES SUL LTDA - Tipo: DEMAIS - LC123:
Sim - Documento 37.278.673/0001-18 - Endereço: Rua Um - CEP: 99709369 - UF: RS -
Município: - Telefone: (54) 0000-0000
Lote   Item   Produto   Modelo   Marca/ Fabricante   Quantidade   Melhor Lance   Valor Total
0002   Aquisição de extintores de
incêndio
0001   EXTINTOR ABC 1KG   X   X   3 UND   R$ 78,44   R$ 235,32
0002   EXTINTOR ABC 2KG   X   X   3 UN   R$ 115,44   R$ 346,32
TOTAL DO LOTE   R$ 2.912,64
TOTAL DO VENCEDOR   R$ 2.912,64
FULANA RECARGAS - Tipo: ME - LC123: Sim - Documento 26.770.038/0001-37 - Endereço: R Dois -
CEP: 36893000 - UF: MG - Município: - Telefone: (32) 00000-0000
Lote   Item   Produto   Modelo   Marca/ Fabricante   Quantidade   Melhor Lance   Valor Total
0001   Prestação de serviços de recarga
de extintores
0001   RECARGA DE EXTINTOR BC   BC 6KG   CAEX   12 SVÇ   R$ 60,00   R$ 720,00
TOTAL DO LOTE   R$ 2.990,00
TOTAL DO VENCEDOR   R$ 2.990,00
Declarações Obrigatórias
Lances Enviados
0001 - Prestação de serviços de recarga de extintores
Data   Valor   CNPJ   Situação
11/08/2026 - 08:27:55   3.740,00 (proposta)   12.151.305/0001-83 - MINAS MATERIAIS LTDA   Válido
11/08/2026 - 13:10:06   4.491,00 (proposta)   26.770.038/0001-37 - FULANA   Válido
RECARGAS
12/08/2026 - 09:00:00   2.990,00   26.770.038/0001-37 - FULANA   Válido
RECARGAS
12/08/2026 - 09:01:00   2.900,00   12.151.305/0001-83 - MINAS MATERIAIS LTDA   Válido
0002 - Aquisição de extintores de incêndio
Data   Valor   CNPJ   Situação
11/08/2026 - 08:00:00   3.200,00 (proposta)   12.151.305/0001-83 - MINAS MATERIAIS LTDA   Válido
11/08/2026 - 08:30:00   2.912,64 (proposta)   37.278.673/0001-18 - EXTINTORES SUL LTDA   Válido
Chat`.split('\n');
  const a = lerAtaPcp(ata);
  assert.deepEqual(
    a.itens.map((i) => [i.codigo, i.lote, i.vencedorCnpj, i.vencedorValor]),
    [
      ['0001', true, '26770038000137', 2990],
      ['0002', true, '37278673000118', 2912.64],
    ],
  );
  assert.deepEqual(
    a.itens.map((i) => i.vencedorTotal),
    [2990, 2912.64],
  );
  // no lote 1 a MINAS ofertou 2.900 (menos que a vencedora, 2.990) e não levou
  assert.deepEqual(
    classificarItem(a.itens[0]).map((c) => [c.cnpj, c.colocacao, c.venceu]),
    [
      ['12151305000183', 0, false],
      ['26770038000137', 1, true],
    ],
  );
  assert.deepEqual(
    classificarItem(a.itens[1]).map((c) => [c.cnpj, c.colocacao]),
    [
      ['37278673000118', 1],
      ['12151305000183', 2],
    ],
  );
});

test('maior desconto: quando os lances sobem, o maior valor é o melhor', () => {
  const lances = [
    { quando: '2026-01-01T10:00:00', valor: 5, proposta: true, cnpj: 'a', nome: 'A', situacao: 'Válido' },
    { quando: '2026-01-01T10:01:00', valor: 6, proposta: true, cnpj: 'b', nome: 'B', situacao: 'Válido' },
    { quando: '2026-01-01T11:00:00', valor: 8, proposta: false, cnpj: 'a', nome: 'A', situacao: 'Válido' },
    { quando: '2026-01-01T11:01:00', valor: 9, proposta: false, cnpj: 'b', nome: 'B', situacao: 'Válido' },
  ];
  assert.equal(lancesSobem(lances), true);
  assert.deepEqual(
    classificarItem({ lances, vencedorNome: 'B', vencedorValor: 9 }).map((c) => [c.cnpj, c.colocacao, c.melhor]),
    [
      ['b', 1, 9],
      ['a', 2, 8],
    ],
  );
});

const CACHE = {
  compras: {
    '18000000000100/2026/7': {
      orgao: 'Prefeitura Municipal de Ubá',
      municipio: 'Ubá',
      uf: 'MG',
      titulo: 'Edital nº 7/2026',
      objeto: 'Gêneros alimentícios',
      modalidade: 'Pregão - Eletrônico',
      data: '2026-04-08',
      itens: [
        {
          n: '0001',
          d: 'AÇÚCAR CRISTAL',
          v: 14,
          t: 1400,
          c: [
            ['22222222000122', 1, 14, 2, 'ALFA'],
            ['44444444000144', 2, 14.5, 2, 'FULANA DE TAL 05604031607'],
            ['11111111000111', 3, 15.9, 2, 'BETA'],
            ['33333333000133', 4, 10000, 1, 'DELTA'],
            ['66666666000166', 5, 16, 1, 'EPSILON'],
            ['77777777000177', 6, 17, 1, 'ZETA'],
          ],
        },
        {
          n: '0002',
          d: 'CANETA AZUL',
          v: 1.1,
          t: 55,
          c: [
            ['11111111000111', 0, 1, 1, 'BETA'],
            ['55555555000155', 1, 1.1, 1, 'GAMA'],
            ['22222222000122', 2, 1.3, 1, 'ALFA'],
          ],
        },
        {
          n: '0003',
          d: 'SEM VENCEDORA',
          v: null,
          c: [
            ['11111111000111', 1, 5, 1, 'BETA'],
            ['22222222000122', 2, 6, 1, 'ALFA'],
          ],
        },
        { n: '0004', d: 'GRAMPEADOR', v: 9, t: 90, c: [['55555555000155', 1, 9, 1, 'GAMA']] },
      ],
    },
    '18000000000100/2026/9': {
      orgao: 'Câmara',
      municipio: 'Ubá',
      uf: 'MG',
      titulo: 'Edital 9',
      objeto: '',
      modalidade: 'Dispensa',
      data: '2026-05-01',
      semAta: true,
    },
  },
  cnpj: {
    11111111000111: { r: 'BETA GENEROS ALIMENTICIOS LTDA', f: '', m: 'CATAGUASES', u: 'MG', p: 'MICRO EMPRESA', a: 'Comércio varejista', s: 'ATIVA' },
    22222222000122: { r: 'ALFA DISTRIBUIDORA DE ALIMENTOS LTDA', f: 'ALFA', m: 'MIRAI', u: 'MG', p: 'EMPRESA DE PEQUENO PORTE', a: 'Atacado', s: 'ATIVA' },
    33333333000133: { r: 'DELTA MEDICOS LTDA', f: '', m: 'BELO HORIZONTE', u: 'MG', p: '', a: '', s: 'ATIVA' },
    44444444000144: { r: 'FULANA DE TAL 05604031607', f: '', m: 'DONA EUZEBIA', u: 'MG', p: 'MICRO EMPRESA', a: '', s: 'ATIVA' },
    55555555000155: { r: 'GAMA PAPEIS LTDA', f: '', m: 'CATAGUASES', u: 'RJ', p: '', a: '', s: 'ATIVA' },
    66666666000166: { r: 'EPSILON COMERCIO LTDA', f: '', m: 'CATAGUASES', u: 'MG', p: 'MICRO EMPRESA', a: '', s: 'ATIVA' },
    77777777000177: { r: 'ZETA COMERCIO LTDA', f: '', m: 'CATAGUASES', u: 'MG', p: 'MICRO EMPRESA', a: '', s: 'ATIVA' },
  },
};
const CIDADES = [
  { nome: 'Cataguases', uf: 'MG' },
  { nome: 'Miraí', uf: 'MG' },
  { nome: 'Dona Euzébia', uf: 'MG' },
];

test('lista: só empresas das cidades escolhidas que ficaram do 2º ao 5º lugar, com licitação, item e colocação', () => {
  const d = montarClientes(CACHE, CIDADES, { atualizadoEm: '2026-11-16T00:00:00Z' });
  assert.deepEqual(d.resumo, { empresas: 4, disputas: 6, licitacoes: 1 });
  assert.deepEqual(
    d.empresas.map((e) => [e.razao, e.cidade, e.vitorias, e.disputas.map((x) => `${x.item}:${x.col}`).join(' ')]),
    [
      ['ALFA DISTRIBUIDORA DE ALIMENTOS LTDA', 'Miraí', 1, '0002:2 0003:2'],
      ['BETA GENEROS ALIMENTICIOS LTDA', 'Cataguases', 0, '0001:3 0002:0'],
      ['EPSILON COMERCIO LTDA', 'Cataguases', 0, '0001:5'],
      ['FULANA DE TAL', 'Dona Euzébia', 0, '0001:2'],
    ],
    'BH e Cataguases-RJ ficam de fora; o 6º lugar e o menor lance sem vencedora identificada não entram',
  );
  assert.equal(d.licitacoes[0].id, '18000000000100/2026/7');
  assert.ok(!JSON.stringify(d).includes('05604031607'), 'o CPF do MEI não sai');
  const disputa = d.empresas[1].disputas[0];
  assert.deepEqual(disputa, { lic: 0, item: '0001', desc: 'AÇÚCAR CRISTAL', col: 3, melhor: 15.9, venc: 14, lances: 2, participantes: 6 });
  assert.equal(Math.round(diferenca(disputa) * 10) / 10, 13.6);
  assert.equal(diferenca({ melhor: 5, venc: null }), null);
});

test('filtros e planilha', () => {
  const d = montarClientes(CACHE, CIDADES);
  assert.deepEqual(
    filtrarClientes(d, { colocacoes: [2, 3, 4] }).map((e) => [e.razao.split(' ')[0], e.disputas.length]),
    [
      ['ALFA', 2],
      ['BETA', 1],
      ['FULANA', 1],
    ],
  );
  assert.deepEqual(
    filtrarClientes(d, { colocacoes: [0] }).map((e) => e.razao.split(' ')[0]),
    ['BETA'],
  );
  assert.equal(filtrarClientes(d, { cidade: 'Miraí' }).length, 1);
  assert.equal(filtrarClientes(d, { q: 'acucar' }).length, 3, 'BETA (3º), EPSILON (5º) e FULANA (2º) no açúcar');
  assert.equal(filtrarClientes(d, { q: '11111111000111' }).length, 1);
  assert.equal(filtrarClientes(d, { municipio: 'Juiz de Fora' }).length, 0);
  const linhas = linhasPlanilha(d, filtrarClientes(d, { cidade: 'Cataguases' }));
  assert.equal(linhas.length, 3);
  assert.equal(linhas[2].Colocação, '5º lugar');
  assert.equal(linhas[0].CNPJ, '11.111.111/0001-11');
  assert.equal(linhas[0]['Cidade da licitação'], 'Ubá - MG');
  assert.equal(linhas[0].Colocação, '3º lugar');
  assert.equal(linhas[1].Colocação, 'Melhor preço, não levou');
  assert.equal(linhas[0]['Link no PNCP'], 'https://pncp.gov.br/app/editais/18000000000100/2026/7');
  // julgamento por lote: a disputa aparece como "Lote"
  const comLote = JSON.parse(JSON.stringify(CACHE));
  comLote.compras['18000000000100/2026/7'].itens[0].l = 1;
  const dl = montarClientes(comLote, CIDADES);
  assert.equal(dl.empresas.flatMap((e) => e.disputas).filter((x) => x.lote).length, 3, 'FULANA (2º), BETA (3º) e EPSILON (5º) no lote 1');
  assert.equal(linhasPlanilha(dl, filtrarClientes(dl, { cidade: 'Dona Euzébia' }))[0].Item, 'Lote 1');
  assert.equal(textoColocacao(2), '2º lugar');
});

test('campeões: quem ganhou e levou cada item, de qualquer cidade, com o total ganho', () => {
  const nomeCidade = (m) => m.charAt(0) + m.slice(1).toLowerCase();
  const d = montarCampeoes(CACHE, CIDADES, { atualizadoEm: 'x' }, { nomeCidade });
  assert.deepEqual(d.resumo, { empresas: 2, itens: 3, licitacoes: 1 }, 'o item sem vencedora identificada fica de fora');
  assert.deepEqual(
    d.empresas.map((e) => [e.razao, e.cidade, e.uf, e.alvo, e.vitorias.map((v) => v.item).join(' '), e.total]),
    [
      ['GAMA PAPEIS LTDA', 'Cataguases', 'RJ', false, '0002 0004', 145],
      ['ALFA DISTRIBUIDORA DE ALIMENTOS LTDA', 'Miraí', 'MG', true, '0001', 1400],
    ],
    'quem ganhou mais itens vem primeiro; o item com um só participante também conta',
  );
  assert.deepEqual(d.empresas[1].vitorias[0], { lic: 0, item: '0001', desc: 'AÇÚCAR CRISTAL', valor: 14, total: 1400, participantes: 6 });
  assert.deepEqual(
    filtrarCampeoes(d, { cidade: '*' }).map((e) => e.razao.split(' ')[0]),
    ['ALFA'],
    '"*" = só as cidades escolhidas',
  );
  assert.equal(filtrarCampeoes(d, {}).length, 2);
  const caneta = filtrarCampeoes(d, { q: 'caneta' });
  assert.deepEqual(
    caneta.map((e) => [e.razao.split(' ')[0], e.vitorias.length, e.total]),
    [['GAMA', 1, 55]],
    'a busca filtra os itens e refaz o total',
  );
  const linhas = linhasPlanilhaCampeoes(d, caneta);
  assert.equal(linhas[0]['Valor total ganho'], 55);
  assert.equal(linhas[0]['Cidade da empresa'], 'Cataguases - RJ');
  assert.equal(linhas[0]['Link no PNCP'], 'https://pncp.gov.br/app/editais/18000000000100/2026/7');
});

test('utilidades: nome sem CPF, descrição curta e PDF dentro do zip', () => {
  assert.equal(nomeSemCpf('JULIANA DE TAL 05604031607'), 'JULIANA DE TAL');
  assert.equal(nomeSemCpf('63.803.161 VANDER DE TAL'), 'VANDER DE TAL');
  assert.equal(nomeSemCpf('MERCADO 2000 LTDA'), 'MERCADO 2000 LTDA');
  assert.equal(descricaoCurta('a '.repeat(100), 20).endsWith('…'), true);
  // zip mínimo com um arquivo "Ata Final.pdf" comprimido
  const conteudo = Buffer.from('%PDF-1.4 conteudo da ata '.repeat(20));
  const comp = zlib.deflateRawSync(conteudo);
  const nome = Buffer.from('Ata Final.pdf');
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(comp.length, 18);
  local.writeUInt32LE(conteudo.length, 22);
  local.writeUInt16LE(nome.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(comp.length, 20);
  central.writeUInt32LE(conteudo.length, 24);
  central.writeUInt16LE(nome.length, 28);
  central.writeUInt32LE(0, 42);
  const inicioCentral = local.length + nome.length + comp.length;
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(1, 8);
  fim.writeUInt16LE(1, 10);
  fim.writeUInt32LE(central.length + nome.length, 12);
  fim.writeUInt32LE(inicioCentral, 16);
  const zip = Buffer.concat([local, nome, comp, central, nome, fim]);
  assert.deepEqual(pdfDoZip(zip), conteudo);
  assert.equal(pdfDoZip(Buffer.from('nada')), null);
});
