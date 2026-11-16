import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANTIGO, carimbar, deRegistros, limparRemovidos, mesclarDocPref, paraRegistros, resumoRegistro } from '../src/lib/docprefSinc.js';

const PADRAO = { contratante: '', cnpj: '', unidade: '', gestor: '', cidade: '', prazoRegularizacao: 5 };
const vazio = () => ({ prestadoras: [], conferencias: {}, config: { ...PADRAO }, ajustes: {} });
const pilar = { id: 'p1', razao: 'PILAR LTDA', cnpj: '01.576.440/0001-54', contrato: '501', email: '', pasta: '', dia: 0, fiscal: 'Maria' };
const conf = (status) => ({ situacoes: {}, itens: { crf: { status } }, atualizadoEm: '2026-11-15T10:00:00.000Z' });

/** Planilha de mentira com a mesma regra do docpref.gs: grava só o que é mais novo e devolve tudo */
function planilha() {
  const linhas = {};
  return {
    linhas,
    chamar(regs) {
      for (const r of regs) if (!linhas[r.id] || linhas[r.id].atualizadoEm < r.atualizadoEm) linhas[r.id] = { ...r, dados: r.removido ? null : r.dados };
      return JSON.parse(JSON.stringify(linhas));
    },
  };
}
/** Um navegador: dados + datas; sincronizar() faz o mesmo que o docprefStore (ler, mesclar, enviar, mesclar) */
function navegador(server) {
  const n = { dados: vazio(), carimbos: {}, removidos: {} };
  n.mudar = (fn, quando) => {
    const novo = fn(JSON.parse(JSON.stringify(n.dados)));
    const c = carimbar(n.dados, novo, n.carimbos, n.removidos, quando);
    Object.assign(n, { dados: novo, ...c });
  };
  n.sincronizar = () => {
    let m = mesclarDocPref(n, server.chamar([]), PADRAO);
    if (m.enviar.length) m = mesclarDocPref(m, server.chamar(m.enviar), PADRAO);
    Object.assign(n, { dados: m.dados, carimbos: m.carimbos, removidos: m.removidos });
  };
  return n;
}

test('registros: os dados do DocPref viram linhas da planilha e voltam iguais', () => {
  const d = { ...vazio(), prestadoras: [pilar], conferencias: { 'p1|2026-04': conf('ok') }, ajustes: { p1: { naoAplica: ['vt-guia'] } } };
  d.config.contratante = 'Prefeitura de Exemplo';
  const r = paraRegistros(d);
  assert.deepEqual(Object.keys(r).sort(), ['ajuste:p1', 'conferencia:p1|2026-04', 'contrato:p1', 'orgao']);
  assert.deepEqual(deRegistros(r, PADRAO), d);
});

test('carimbar: só o que mudou ganha data; o que saiu vira removido', () => {
  const a = { ...vazio(), prestadoras: [pilar], conferencias: { 'p1|2026-04': conf('ok') } };
  const b = { ...a, conferencias: { 'p1|2026-04': conf('recusado') }, prestadoras: [] };
  const c = carimbar(a, b, { 'contrato:p1': '2026-11-01T00:00:00.000Z' }, {}, '2026-11-15T12:00:00.000Z');
  assert.deepEqual(c.carimbos, { 'conferencia:p1|2026-04': '2026-11-15T12:00:00.000Z' });
  assert.deepEqual(c.removidos, { 'contrato:p1': '2026-11-15T12:00:00.000Z' });
});

test('mesclar: vale a mudança mais recente; o órgão vazio não apaga o da planilha; dados antigos perdem', () => {
  const servidor = {
    orgao: { tipo: 'orgao', dados: { ...PADRAO, contratante: 'Prefeitura de Exemplo' }, atualizadoEm: '2026-11-10T00:00:00.000Z' },
    'conferencia:p1|2026-04': { tipo: 'conferencia', dados: conf('ok'), atualizadoEm: '2026-11-10T00:00:00.000Z' },
  };
  // navegador novo, sem nada: recebe tudo e não envia nada
  let m = mesclarDocPref({ dados: vazio(), carimbos: {}, removidos: {} }, servidor, PADRAO);
  assert.equal(m.dados.config.contratante, 'Prefeitura de Exemplo');
  assert.equal(m.dados.conferencias['p1|2026-04'].itens.crf.status, 'ok');
  assert.equal(m.enviar.length, 0);
  // navegador com dados de antes da planilha (data ANTIGO): perde para a planilha, mas o que só ele tem é enviado
  const antigo = { ...vazio(), prestadoras: [pilar], conferencias: { 'p1|2026-04': conf('recusado') } };
  m = mesclarDocPref({ dados: antigo, carimbos: { 'contrato:p1': ANTIGO, 'conferencia:p1|2026-04': ANTIGO }, removidos: {} }, servidor, PADRAO);
  assert.equal(m.dados.conferencias['p1|2026-04'].itens.crf.status, 'ok', 'a planilha é mais nova');
  assert.deepEqual(
    m.enviar.map((r) => r.id),
    ['contrato:p1'],
  );
  // mudança local mais nova vai para a planilha
  m = mesclarDocPref(
    {
      dados: { ...vazio(), conferencias: { 'p1|2026-04': conf('recusado') } },
      carimbos: { 'conferencia:p1|2026-04': '2026-11-15T00:00:00.000Z' },
      removidos: {},
    },
    servidor,
    PADRAO,
  );
  assert.deepEqual(
    m.enviar.map((r) => [r.id, r.dados.itens.crf.status]),
    [['conferencia:p1|2026-04', 'recusado']],
  );
});

test('dois fiscais na mesma planilha: marcações, cadastro e remoções chegam aos dois', () => {
  const server = planilha();
  const a = navegador(server);
  const b = navegador(server);
  // A cadastra o órgão e a contratada e confere abril
  a.mudar((d) => ({ ...d, config: { ...d.config, contratante: 'Prefeitura de Exemplo' }, prestadoras: [pilar] }), '2026-11-15T10:00:00.000Z');
  a.mudar((d) => ({ ...d, conferencias: { 'p1|2026-04': conf('ok') } }), '2026-11-15T10:01:00.000Z');
  a.sincronizar();
  b.sincronizar();
  assert.equal(b.dados.config.contratante, 'Prefeitura de Exemplo');
  assert.equal(b.dados.prestadoras[0].fiscal, 'Maria');
  assert.equal(b.dados.conferencias['p1|2026-04'].itens.crf.status, 'ok');
  // B recusa o mesmo item depois; A vê a recusa
  b.mudar((d) => ({ ...d, conferencias: { 'p1|2026-04': conf('recusado') } }), '2026-11-15T11:00:00.000Z');
  b.sincronizar();
  a.sincronizar();
  assert.equal(a.dados.conferencias['p1|2026-04'].itens.crf.status, 'recusado');
  // A remove a contratada; a remoção chega a B e não volta
  a.mudar((d) => ({ ...d, prestadoras: [] }), '2026-11-15T12:00:00.000Z');
  a.sincronizar();
  b.sincronizar();
  assert.equal(b.dados.prestadoras.length, 0);
  assert.equal(server.linhas['contrato:p1'].removido, true);
  b.sincronizar();
  a.sincronizar();
  assert.equal(a.dados.prestadoras.length, 0, 'a remoção não é desfeita na volta');
});

test('resumo legível na planilha e limpeza de remoções antigas', () => {
  assert.equal(resumoRegistro('orgao', { contratante: 'Prefeitura de Exemplo', cidade: 'Cataguases - MG' }), 'Prefeitura de Exemplo · Cataguases - MG');
  assert.equal(resumoRegistro('contrato:p1', pilar), 'PILAR LTDA · CNPJ 01.576.440/0001-54 · contrato 501 · fiscal: Maria');
  const c = { situacoes: {}, itens: { a: { status: 'ok' }, b: { status: 'ok' }, c: { status: 'recusado' }, d: { status: 'pendente' } } };
  assert.equal(resumoRegistro('conferencia:p1|2026-04', c, { p1: 'PILAR LTDA' }), 'PILAR LTDA · 04/2026 · 2 recebido(s), 1 recusado(s)');
  assert.equal(resumoRegistro('ajuste:drive:pilar', { naoAplica: ['vt'] }, { 'drive:pilar': 'pasta pilar' }), 'pasta pilar · 1 exigência não se aplica');
  assert.equal(resumoRegistro('contrato:p1', null), 'removido');
  const r = limparRemovidos({ velho: '2026-01-01T00:00:00.000Z', novo: '2026-11-01T00:00:00.000Z' }, new Date('2026-11-15T00:00:00Z'));
  assert.deepEqual(Object.keys(r), ['novo']);
});
