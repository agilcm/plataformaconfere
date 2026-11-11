import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliarEscala, calcularDia, compararRegimes, gerarEscala, horas, minutos, programarFolgas, regimeDaData, semanaPadrao } from '../src/lib/jornada.js';

const problemasDe = (a, regra) => a.problemas.filter((p) => p.regra === regra);

test('horários: minutos, horas e o dia que passa da meia-noite (hora noturna reduzida)', () => {
  assert.equal(minutos('08:30'), 510);
  assert.equal(minutos(''), null);
  assert.equal(horas(480), '8h');
  assert.equal(horas(504), '8h24');
  const comum = calcularDia({ entrada: '08:00', intervaloInicio: '12:00', intervaloFim: '13:00', saida: '17:00' });
  assert.deepEqual([comum.trabalhados, comum.intervalo, comum.noturnos, comum.computados], [480, 60, 0, 480]);
  const noite = calcularDia({ entrada: '22:00', intervaloInicio: '02:00', intervaloFim: '03:00', saida: '06:00' });
  assert.deepEqual([noite.trabalhados, noite.noturnos], [420, 360], '5h às 6h não é noturno');
  assert.equal(noite.computados, Math.round(60 + (360 * 60) / 52.5), 'cada hora noturna vale 52min30s');
  const madrugada = calcularDia({ entrada: '04:00', intervaloInicio: '', intervaloFim: '', saida: '10:00' });
  assert.equal(madrugada.noturnos, 60);
});

test('regra pela data da EC 141/2026', () => {
  assert.equal(regimeDaData('2026-12-16'), 44);
  assert.equal(regimeDaData('2026-12-17'), 42);
  assert.equal(regimeDaData('2027-12-17'), 40);
});

test('gerar a escala: dias da semana, duas folgas, feriado nacional e local', () => {
  const semana = programarFolgas(semanaPadrao(), [0, 6]);
  const dias = gerarEscala({ inicio: '2026-11-09', fim: '2026-11-22', semana, feriadosLocais: [{ data: '2026-11-18', nome: 'Aniversário da cidade' }] });
  assert.equal(dias.length, 14);
  assert.equal(dias[0].dow, 1, '09/11/2026 é segunda-feira');
  const d20 = dias.find((d) => d.data === '2026-11-20');
  assert.deepEqual([d20.feriado, d20.tipo], ['Dia da Consciência Negra', 'feriado']);
  assert.equal(dias.find((d) => d.data === '2026-11-18').tipo, 'feriado');
  assert.equal(dias.find((d) => d.data === '2026-11-15').tipo, 'folga', 'domingo de folga, mesmo sendo feriado');
  const folgas = programarFolgas(semanaPadrao(), [3, 4]);
  assert.deepEqual(
    folgas.filter((d) => !d.trabalha).map((d) => d.dow),
    [3, 4],
  );
  assert.ok(folgas[0].trabalha && folgas[0].entrada === '08:00', 'domingo passa a trabalhar no horário padrão');
});

test('5x2 de 8h: dentro de 40h, 42h e 44h', () => {
  const dias = gerarEscala({ inicio: '2027-07-05', fim: '2027-08-01', semana: semanaPadrao() }); // julho: sem feriado nacional
  const a = avaliarEscala(dias, { regime: 40 });
  assert.equal(a.resumo.dentro, true, JSON.stringify(a.problemas));
  assert.equal(a.semanas.length, 4);
  assert.ok(a.semanas.every((s) => s.computados === 40 * 60 && s.folgas === 2));
  assert.equal(a.resumo.mediaSemanal, 2400);
  assert.deepEqual(
    compararRegimes(dias).map((c) => [c.regime, c.dentro]),
    [
      [44, true],
      [42, true],
      [40, true],
    ],
  );
});

test('8h24 por dia (42h): passa de 40h, cabe em 42h com acordo coletivo', () => {
  const semana = semanaPadrao({ saida: '17:24' });
  const dias = gerarEscala({ inicio: '2027-03-01', fim: '2027-03-14', semana });
  const a40 = avaliarEscala(dias, { regime: 40 });
  assert.equal(a40.resumo.dentro, false);
  assert.equal(problemasDe(a40, 'Limite semanal').length, 2);
  assert.equal(a40.resumo.excesso, 2 * 120);
  const a42 = avaliarEscala(dias, { regime: 42 });
  assert.equal(a42.resumo.dentro, true);
  assert.match(problemasDe(a42, 'Mais de 8h no dia')[0].base, /convenção ou acordo coletivo/);
});

test('6x1 (44h): fora do 5x2, dentro da regra antiga de 44h', () => {
  const semana = semanaPadrao({ saida: '17:00', folgas: [0] }).map((d) => (d.dow === 6 ? { ...d, intervaloInicio: '', intervaloFim: '', saida: '12:00' } : d));
  const dias = gerarEscala({ inicio: '2027-03-01', fim: '2027-03-14', semana });
  const a44 = avaliarEscala(dias, { regime: 44 });
  assert.equal(a44.resumo.dentro, true, JSON.stringify(a44.problemas));
  const a40 = avaliarEscala(dias, { regime: 40 });
  assert.equal(problemasDe(a40, 'Duas folgas por semana (5x2)').length, 2);
  assert.equal(problemasDe(a40, 'Limite semanal').length, 2, '44h > 40h');
});

test('intervalo, descanso entre jornadas, 7 dias seguidos, feriado trabalhado e domingo', () => {
  const semana = semanaPadrao({ intervaloInicio: '', intervaloFim: '', saida: '15:00', folgas: [] });
  const dias = gerarEscala({ inicio: '2026-11-16', fim: '2026-11-22', semana, trabalharFeriados: true });
  dias[1] = { ...dias[1], entrada: '20:00', saida: '23:00', intervaloInicio: '', intervaloFim: '' };
  const a = avaliarEscala(dias, { regime: 40 });
  assert.ok(problemasDe(a, 'Intervalo para refeição').length >= 5, '7h sem intervalo');
  assert.ok(
    problemasDe(a, 'Descanso entre jornadas').some((p) => p.datas[0] === '2026-11-18'),
    'de 23h às 8h são 9h',
  );
  assert.equal(problemasDe(a, 'Dias seguidos de trabalho').length, 1);
  assert.equal(problemasDe(a, 'Trabalho em feriado').length, 1, '20/11');
  assert.equal(problemasDe(a, 'Folga no domingo').length, 1);
  assert.equal(problemasDe(a, 'Duas folgas por semana (5x2)').length, 1);
  assert.equal(a.resumo.dentro, false);
});
