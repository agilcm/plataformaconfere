import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerCsv, lerXlsx } from '../src/lib/planilhaLeitura.js';
import { criarXlsx } from '../src/lib/xlsx.js';
import { detectarColunas, escolherMelhor, itensDoTermo, marcaDe, palavrasChave, tokens } from '../src/lib/termoReferencia.js';

test('tokens normaliza medidas, tipo e plurais', () => {
  assert.deepEqual(tokens('ARROZ POLIDO TIPO I, PACOTE 5 KG'), ['arroz', 'polido', 'tipo1', '5kg']);
  assert.ok(tokens('Açúcar 05 Kg').includes('5kg'));
  assert.ok(tokens('Óleo 900 ML').includes('900ml'));
  assert.ok(tokens('Feijões').includes('feijao'));
});

test('lê CSV do Excel brasileiro e acha as colunas', () => {
  const csv = 'Prefeitura;;\nItem;Produto;Especificação;Unid.;Qtd;Valor unitário\n1;Arroz;Arroz tipo 1 5 kg;Pct;100;R$ 24,90\n2;Feijão;Feijão carioca 1 kg;Pct;1.200;8,50\n';
  const linhas = lerCsv(new TextEncoder().encode(csv));
  const m = detectarColunas(linhas);
  assert.equal(m.linha, 1);
  const itens = itensDoTermo(linhas, m);
  assert.equal(itens.length, 2);
  assert.equal(itens[0].valorTermo, 24.9);
  assert.equal(itens[1].quantidade, 1200);
  assert.deepEqual(palavrasChave(itens[0]), ['arroz']);
});

test('lê o .xlsx gerado pelo próprio site', async () => {
  const bytes = criarXlsx([
    {
      nome: 'TR',
      colunas: [{ titulo: 'Item' }, { titulo: 'Descrição' }, { titulo: 'Valor unitário', tipo: 'moeda' }],
      linhas: [
        [1, 'Café torrado e moído 500 g', 15.5],
        [2, 'Leite em pó integral 400 g', 18],
      ],
    },
  ]);
  const linhas = await lerXlsx(bytes);
  const itens = itensDoTermo(linhas);
  assert.equal(itens.length, 2);
  assert.equal(itens[0].descricao, 'Café torrado e moído 500 g');
  assert.equal(itens[1].valorTermo, 18);
});

test('marca escrita na descrição', () => {
  assert.equal(marcaDe('ARROZ TIPO 1 5KG MARCA: TIO JOÃO, OU SIMILAR'), 'TIO JOÃO');
  assert.equal(marcaDe('Arroz tipo 1 5kg'), '');
});

test('melhor preço: mesma medida, aderência e fora da curva', () => {
  const item = { descricao: 'Arroz polido longo fino tipo 1 pacote 5 kg' };
  const c = (valorUnitario, descricao, aderencia, suspeito = false) => ({ valorUnitario, descricao, aderencia, suspeito });
  const m = escolherMelhor(item, [
    c(4.79, 'Arroz tipo 1 longo fino polido 1 kg', 0.83),
    c(1.5, 'Arroz polido longo fino tipo 1 5 kg', 1, true),
    c(18.2, 'Arroz polido longo tipo 1 pacote de 5 kg', 0.83),
    c(19.9, 'Arroz polido longo fino tipo 1 5kg', 1),
    c(16, 'Arroz 5 kg', 0.33),
  ]);
  assert.equal(m.valorUnitario, 18.2);
  // pouca especificação: o mais barato
  assert.equal(escolherMelhor({ descricao: 'Sabonete' }, [c(3, 'Sabonete 90 g', 1), c(2, 'Sabonete 85 g', 1)]).valorUnitario, 2);
});
