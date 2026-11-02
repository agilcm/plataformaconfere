import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAppsScript } from './appsScriptSimulado.mjs';
import { mesclar } from '../src/lib/meusEditais.ts';

const ed = (id) => ({ id, titulo: 'Edital 1/2026', objeto: 'Aquisição de toner', orgao: 'Prefeitura', municipio: 'Ubá', modalidade: 'Pregão', valor: 1000, propostasAte: '2026-11-24T08:59', link: `https://pncp.gov.br/app/editais/${id}` });
const reg = (id, t, o = {}) => ({ id, edital: ed(id), etapa: 'interesse', nota: '', por: 'Ana', salvoEm: t, atualizadoEm: t, ...o });

test('Apps Script: senha, gravar, atualizar só com versão mais nova, remover', () => {
  const s = criarAppsScript('abc');
  assert.deepEqual(s.post({ senha: 'errada', registros: [] }), { ok: false, erro: 'senha' });
  let r = s.post({ senha: 'abc', registros: [reg('A', '2026-11-02T10:00:00.000Z', { nota: 'pedir cotação' })] });
  assert.equal(r.ok, true);
  assert.equal(s.nomeAba(), 'editais');
  assert.equal(r.editais.A.nota, 'pedir cotação');
  assert.equal(r.editais.A.edital.municipio, 'Ubá');
  assert.equal(s.linhas[1][7], 'Ubá'); // colunas legíveis na planilha
  // versão mais velha não sobrescreve
  r = s.post({ senha: 'abc', registros: [reg('A', '2026-11-02T09:00:00.000Z', { nota: 'velha' })] });
  assert.equal(r.editais.A.nota, 'pedir cotação');
  r = s.post({ senha: 'abc', registros: [reg('A', '2026-11-02T11:00:00.000Z', { etapa: 'participar', nota: 'nova' })] });
  assert.equal(r.editais.A.etapa, 'participar');
  r = s.post({ senha: 'abc', registros: [reg('A', '2026-11-02T12:00:00.000Z', { removido: true })] });
  assert.equal(r.editais.A.removido, true);
  assert.equal(s.linhas.length, 2); // a mesma linha, não uma nova
  assert.equal(s.get({ senha: 'abc' }).editais.A.removido, true);
});

test('Apps Script não abre com a senha padrão', () => {
  const s = criarAppsScript('TROQUE-ESTA-SENHA');
  assert.equal(s.post({ senha: 'TROQUE-ESTA-SENHA', registros: [] }).ok, false);
});

test('mesclar: vale a mudança mais recente, remoções viajam e o que falta é enviado', () => {
  const locais = { A: reg('A', '2026-11-02T10:00:00Z'), B: reg('B', '2026-11-02T12:00:00Z', { nota: 'minha' }) };
  const removidos = { C: reg('C', '2026-11-02T13:00:00Z') };
  const servidor = {
    A: { ...reg('A', '2026-11-02T11:00:00Z', { etapa: 'enviada' }) }, // da equipe, mais novo
    B: { ...reg('B', '2026-11-02T09:00:00Z') }, // o meu é mais novo
    C: { ...reg('C', '2026-11-02T08:00:00Z') }, // removi depois
    D: { ...reg('D', '2026-11-02T08:00:00Z') }, // novo da equipe
    E: { ...reg('E', '2026-11-02T08:00:00Z'), removido: true }, // removido pela equipe
  };
  const m = mesclar({ ...locais, E: reg('E', '2026-11-01T08:00:00Z') }, removidos, servidor);
  assert.equal(m.locais.A.etapa, 'enviada');
  assert.equal(m.locais.B.nota, 'minha');
  assert.ok(!m.locais.C && m.removidos.C);
  assert.ok(m.locais.D);
  assert.ok(!m.locais.E && m.removidos.E);
  assert.deepEqual(m.enviar.map((r) => [r.id, !!r.removido]).sort(), [['B', false], ['C', true]]);
});
