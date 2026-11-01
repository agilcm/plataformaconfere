import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buscarNaBase, cabecalhoCustos, extrairCotacoes, indexar } from '../src/lib/privado/baseCustos.js';
import { criarPlanilhaCustos, nomePlanilha } from '../src/lib/privado/planilhaCustos.js';
import { lerXlsxAbas } from '../src/lib/planilhaLeitura.js';

const CAB = ['Número do lote', 'Descrição do Lote', 'Descrição do item', 'Quantidade', 'Unidade de medida', 'Unitário referência', 'LANCE INICIAL', 'Marca', 'Fabricante', 'Modelo/versão/código', 'referencia', 'LANCE MÁXIMO', 'QUANT.', 'VALOR DE COMPRA'];

test('extrai link, marca e valor de compra do molde de custos', () => {
  const linhas = [
    ['ID:101407', 'Data da disputa: 15/06/2026'],
    CAB,
    [1, 'LOTE 1', 'AR CONDICIONADO SPLIT 9.000 BTUS INVERTER', 10, 'UN', 2266.93, '', 'LG', 'LG', '', 'Ar Split LG 9.000', '', 10, 1049],
    [2, 'LOTE 2', 'VENTILADOR DE PAREDE 60 CM', 5, 'UN', 295.6, '', 'WAP', 'WAP', '', 'https://loja.com/ventilador', '', 5, 189.9],
    [3, 'LOTE 3', 'ITEM SEM COMPRA', 5, 'UN', 10],
  ];
  assert.equal(cabecalhoCustos(linhas).colunaCompra, 'VALOR DE COMPRA');
  const c = extrairCotacoes([{ nome: 'Pregão 1', linhas, links: { K3: 'https://mercadolivre.com.br/ar-lg' } }], { arquivo: 'UBÁ.xlsx' });
  assert.equal(c.length, 2);
  assert.deepEqual([c[0].link, c[0].referencia, c[0].marca, c[0].compra], ['https://mercadolivre.com.br/ar-lg', 'Ar Split LG 9.000', 'LG', 1049]);
  assert.equal(c[1].link, 'https://loja.com/ventilador');
  assert.equal(c[1].aba, 'Pregão 1');
});

test('planilha antiga sem valor de compra usa o lance máximo', () => {
  const linhas = [['Número do lote', 'Descrição do Lote', 'Descrição do item', 'Quantidade', 'Unidade de medida', 'Unitário referência', 'Valor proposto', 'LANCE MÁXIMO', 'Marca', 'Fabricante', 'Modelo/versão/código', 'LINK'], [1, 'CARTUCHO HP 954', 'CARTUCHO HP 954', 16, 'UNI', 90, '', 51.8, 'Pro Resolution', '', '', 'https://ml.com/x']];
  const c = extrairCotacoes([{ nome: 'A', linhas, links: {} }], { arquivo: 'GUARANI.xlsx' });
  assert.equal(c[0].compra, 51.8);
  assert.equal(c[0].colunaCompra, 'LANCE MÁXIMO');
});

test('busca na base: mesma medida, e medida diferente não é preenchida', () => {
  const base = indexar([
    { descricao: 'AR CONDICIONADO SPLIT 9000 BTUS INVERTER', marca: 'AGRATTO', compra: 1949.9, link: 'x', arquivo: 'a', aba: 'b', linha: 3 },
    { descricao: 'AR CONDICIONADO SPLIT 18000 BTUS INVERTER', marca: 'EOS', compra: 2861.97, link: 'y', arquivo: 'a', aba: 'b', linha: 4 },
  ]);
  const item = (produto) => ({ produto, especificacao: 'Ar condicionado tipo Split Hi-Wall, ciclo frio, tecnologia inverter, serpentina em cobre, controle remoto, Procel A, garantia 12 meses', descricao: `${produto} - Ar condicionado tipo Split Hi-Wall, ciclo frio, tecnologia inverter, serpentina em cobre, controle remoto, Procel A, garantia 12 meses` });
  const r9 = buscarNaBase(item('AR CONDICIONADO SPLIT INVERTER 9.000 BTUS'), base);
  assert.equal(r9.melhor.marca, 'AGRATTO');
  assert.ok(r9.confiavel);
  const r12 = buscarNaBase(item('AR CONDICIONADO SPLIT INVERTER 12.000 BTUS'), base);
  assert.equal(r12.melhor, null);
  assert.equal(r12.alternativas.length, 2);
});

test('planilha de custos: nome, molde, fórmulas e link', async () => {
  assert.equal(nomePlanilha({ orgao: 'Prefeitura de Ubá', processo: 'PE 61/2025', data: '2026-11-15' }), 'Prefeitura de Ubá - PE 61-2025 - 15-11-2026');
  const bytes = criarPlanilhaCustos({
    orgao: 'Prefeitura de Ubá',
    processo: 'PE 61/2025',
    data: '2026-11-15',
    itens: [{ numero: '1', produto: 'AR', especificacao: 'Split', quantidade: 2, unidade: 'UN', valorTermo: 100, base: { marca: 'LG', referencia: 'Ar LG', link: 'https://ml.com/ar', compra: 50, arquivo: 'UBÁ.xlsx', aba: 'P1' } }],
  });
  const [aba] = await lerXlsxAbas(bytes);
  assert.equal(aba.nome, 'Cotação');
  assert.equal(aba.linhas[1][13], 'VALOR DE COMPRA');
  assert.equal(aba.linhas[1][25], 20);
  assert.deepEqual([aba.linhas[2][7], aba.linhas[2][13]], ['LG', 50]);
  assert.equal(aba.links.K3, 'https://ml.com/ar');
});
