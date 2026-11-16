import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alertasDocPref, mensagemAlerta, unirEmpresas } from '../src/lib/docprefAlerta.js';

// pasta do Drive: Pilar sem nada de outubro; Alfa com um arquivo solto em outubro
const leitura = {
  empresas: [
    { id: 'pilar', nome: 'Pilar', cnpj: '01.576.440/0001-54', meses: [{ comp: '2026-10', arquivos: [] }] },
    { id: 'alfa', nome: 'Alfa', cnpj: '', meses: [{ comp: '2026-10', arquivos: [{ rotulo: 'x.pdf', categoria: 'folha', tipo: 'folha', comp: '2026-10' }] }] },
  ],
};
const vazio = { prestadoras: [], conferencias: {}, ajustes: {}, config: {} };
const emOutubro = (lista) => lista.filter((a) => a.comp === '2026-10');
const hojeDe = (dados, hoje) => alertasDocPref({ empresas: unirEmpresas(leitura, dados.prestadoras), dados, hoje });

test('unir: a contratada do cadastro casa com a pasta do Drive pelo CNPJ ou pelo nome', () => {
  const cad = [
    { id: 'p1', razao: 'PILAR SERVICOS LTDA', cnpj: '01576440000154', dia: 20 },
    { id: 'p2', razao: 'Beta Limpeza', cnpj: '', dia: 0 },
  ];
  const u = unirEmpresas(leitura, cad);
  assert.deepEqual(
    u.map((e) => e.chave),
    ['p1', 'drive:alfa', 'p2'],
  );
  assert.equal(u[0].nome, 'PILAR SERVICOS LTDA');
  assert.equal(u[2].drive, undefined);
});

test('aviso: 5 dias antes, 2 dias antes e no dia do prazo; fora desses dias, nada', () => {
  // prazo padrão de outubro: 30/11
  for (const [hoje, dias] of [
    ['2026-11-25', 5],
    ['2026-11-28', 2],
    ['2026-11-30', 0],
  ]) {
    const a = hojeDe(vazio, hoje);
    assert.deepEqual(
      emOutubro(a.aVencer).map((x) => [x.nome, x.dias]),
      [
        ['Alfa', dias],
        ['Pilar', dias],
      ],
      hoje,
    );
    assert.equal(emOutubro(a.condicionados).length, 0);
  }
  for (const hoje of ['2026-11-15', '2026-11-26', '2026-11-29']) assert.equal(emOutubro(hojeDe(vazio, hoje).aVencer).length, 0, hoje);
});

test('aviso: no dia seguinte ao prazo o mês entra como pagamento condicionado, uma vez só', () => {
  const a = hojeDe(vazio, '2026-12-01');
  assert.deepEqual(
    emOutubro(a.condicionados).map((x) => x.nome),
    ['Alfa', 'Pilar'],
  );
  assert.equal(emOutubro(a.aVencer).length, 0);
  assert.equal(emOutubro(hojeDe(vazio, '2026-12-02').condicionados).length, 0, 'não repete no segundo dia');
});

test('aviso: o dia do prazo do cadastro (planilha do órgão) muda a data do aviso', () => {
  const dados = { ...vazio, prestadoras: [{ id: 'p1', razao: 'PILAR LTDA', cnpj: '01576440000154', dia: 20 }] };
  const a = hojeDe(dados, '2026-11-15'); // prazo de outubro passa a ser 20/11
  assert.deepEqual(
    emOutubro(a.aVencer).map((x) => [x.nome, x.prazo, x.dias]),
    [['PILAR LTDA', '2026-11-20', 5]],
  );
  assert.equal(emOutubro(hojeDe(dados, '2026-11-21').condicionados)[0].nome, 'PILAR LTDA');
});

test('mensagem: diz quem, o mês, o prazo e o que falta, com link para o DocPref; sem nada, fica vazia', () => {
  assert.equal(mensagemAlerta({ aVencer: [], condicionados: [] }), '');
  const a = hojeDe(vazio, '2026-11-28');
  const t = mensagemAlerta({ ...a, aVencer: emOutubro(a.aVencer) }, { orgao: 'Prefeitura <de> Exemplo' });
  assert.match(t, /DocPref · Prefeitura &lt;de&gt; Exemplo/);
  assert.match(t, /<b>Pilar<\/b> · 10\/2026 · prazo 30\/11\/2026, vence em 2 dias/);
  assert.match(t, /nada enviado ainda/);
  assert.match(t, /<b>Alfa<\/b>[^\n]*\n {2}\d+ pendências: /);
  assert.match(t, /href="https:\/\/www\.agilcm\.com\.br\/docpref\/#empresa=drive%3Apilar&mes=2026-10"/);
  const c = hojeDe(vazio, '2026-12-01');
  assert.match(mensagemAlerta({ aVencer: [], condicionados: emOutubro(c.condicionados) }), /Pagamento condicionado[\s\S]*prazo era 30\/11\/2026/);
});
