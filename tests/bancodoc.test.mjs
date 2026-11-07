import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOOK, competenciaAtual, itensDoMes, mensagemPendencias, nomeCompetencia, prazoDe, situacaoDoMes } from '../src/lib/bancodoc.js';

test('prazo é o dia combinado do mês seguinte à competência', () => {
  assert.equal(prazoDe('2026-10'), '2026-11-25');
  assert.equal(prazoDe('2026-12'), '2027-01-25');
  assert.equal(prazoDe('2027-01', 31), '2027-02-28'); // fevereiro não tem 31
  assert.equal(competenciaAtual(new Date(2026, 10, 7)), '2026-10');
  assert.equal(competenciaAtual(new Date(2026, 0, 15)), '2025-12');
  assert.equal(nomeCompetencia('2026-10'), 'outubro/2026');
});

test('admissões, demissões, férias, parcelamento e subcontratação só entram quando houve', () => {
  const base = itensDoMes({});
  assert.ok(base.some((i) => i.id === 'darf') && base.some((i) => i.id === 'crf') && base.some((i) => i.id === 'forca'));
  assert.ok(!base.some((i) => i.grupo === 'admissao' || i.grupo === 'demissao' || i.grupo === 'ferias'));
  const com = itensDoMes({ admissoes: true, ferias: true });
  assert.ok(com.some((i) => i.id === 'adm-aso') && com.some((i) => i.id === 'fer-recibo'));
  assert.ok(!com.some((i) => i.grupo === 'demissao'));
  assert.equal(new Set(BOOK.flatMap((g) => g.itens.map((i) => i.id))).size, BOOK.flatMap((g) => g.itens).length); // ids únicos
});

test('semáforo: pagar, não pagar ainda (antes do prazo) e travar (depois do prazo)', () => {
  const todos = Object.fromEntries(itensDoMes({}).map((i) => [i.id, { status: 'ok' }]));
  assert.equal(situacaoDoMes({ itens: todos }, '2026-10', { hoje: '2026-11-07' }).sinal, 'pagar');
  const falta = { ...todos, darf: { status: 'pendente' } };
  const antes = situacaoDoMes({ itens: falta }, '2026-10', { hoje: '2026-11-20' });
  assert.equal(antes.sinal, 'aguardando');
  assert.equal(antes.diasParaPrazo, 5);
  assert.equal(situacaoDoMes({ itens: falta }, '2026-10', { hoje: '2026-11-26' }).sinal, 'travar');
  // recusado também impede o pagamento, com o motivo
  const recusa = { ...todos, crf: { status: 'recusado', motivo: 'CRF vencido' } };
  const s = situacaoDoMes({ itens: recusa }, '2026-10', { hoje: '2026-11-26' });
  assert.equal(s.sinal, 'travar');
  assert.equal(s.recusados[0].motivo, 'CRF vencido');
  // "não se aplica" conta como conferido
  assert.equal(situacaoDoMes({ itens: { ...todos, 'va-vr': { status: 'na' } } }, '2026-10', { hoje: '2026-11-07' }).sinal, 'pagar');
  const msg = mensagemPendencias({ razao: 'Limpa Tudo Ltda', contrato: '12/2026' }, '2026-10', s);
  assert.ok(msg.includes('outubro/2026') && msg.includes('CRF vencido') && msg.includes('25/11/2026'));
});
