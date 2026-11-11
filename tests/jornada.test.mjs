import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  abasEscala,
  avaliarEscala,
  blocosEscala,
  calcularDia,
  compararRegimes,
  dataDaRegra,
  feriadosDoPeriodo,
  gerarEscala,
  horas,
  mesesDaEscala,
  minutos,
  mudancasDeRegra,
  programarFolgas,
  regimeDaData,
  semanaPadrao,
} from '../src/lib/jornada.js';

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

test('feriados: nacionais, da cidade (todo ano, Páscoa ou só um dia) e pontos facultativos', () => {
  assert.equal(dataDaRegra('05-22', 2027), '2027-05-22');
  assert.equal(dataDaRegra('P+60', 2027), '2027-05-27', 'Corpus Christi de 2027');
  assert.equal(dataDaRegra('P-2', 2026), '2026-04-03', 'Sexta-feira da Paixão de 2026');
  assert.equal(dataDaRegra('2026-06-01', 2027), null, 'data avulsa só vale no seu ano');
  const nac = feriadosDoPeriodo('2027-01-01', '2027-12-31');
  assert.equal(nac.length, 10, '9 nacionais por lei federal e a Sexta-feira da Paixão');
  assert.ok(nac.every((f) => f.tipo === 'nacional'));
  assert.ok(!nac.some((f) => /Carnaval|Corpus/.test(f.nome)), 'Carnaval e Corpus Christi são pontos facultativos');
  // Cataguases pela lista do TJMG: padroeira em 22/05 e Corpus Christi
  const cat = feriadosDoPeriodo('2027-05-01', '2027-06-30', {
    municipais: [
      { regra: '05-22', nome: 'Dia de Santa Rita' },
      { regra: 'P+60', nome: 'Corpus Christi' },
    ],
  });
  assert.deepEqual(
    cat.map((f) => [f.data, f.tipo]),
    [
      ['2027-05-01', 'nacional'],
      ['2027-05-22', 'municipal'],
      ['2027-05-27', 'municipal'],
    ],
  );
  const fac = feriadosDoPeriodo('2027-02-01', '2027-02-28', { facultativos: ['carnaval'] });
  assert.deepEqual(
    fac.map((f) => f.data),
    ['2027-02-08', '2027-02-09'],
  );
  assert.deepEqual(mudancasDeRegra('2027-01-01', '2027-12-31'), [{ data: '2027-12-17', de: 42, para: 40 }]);
  assert.deepEqual(mudancasDeRegra('2027-01-01', '2027-06-30'), []);
});

test('gerar a escala: dias da semana, duas folgas, feriado nacional e local', () => {
  const semana = programarFolgas(semanaPadrao(), [0, 6]);
  const feriados = feriadosDoPeriodo('2026-11-09', '2026-11-22', { municipais: [{ regra: '11-18', nome: 'Aniversário da cidade' }] });
  const dias = gerarEscala({ inicio: '2026-11-09', fim: '2026-11-22', semana, feriados });
  assert.equal(dias.length, 14);
  assert.equal(dias[0].dow, 1, '09/11/2026 é segunda-feira');
  const d20 = dias.find((d) => d.data === '2026-11-20');
  assert.deepEqual([d20.feriado, d20.tipo], ['Dia Nacional de Zumbi e da Consciência Negra', 'feriado']);
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
  const dias = gerarEscala({
    inicio: '2026-11-16',
    fim: '2026-11-22',
    semana,
    feriados: feriadosDoPeriodo('2026-11-16', '2026-11-22'),
    trabalharFeriados: true,
  });
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

test('uma página por mês: meses da escala, abas do Excel e páginas do PDF', () => {
  const inicio = '2027-01-01';
  const fim = '2027-12-31';
  const feriados = feriadosDoPeriodo(inicio, fim, { municipais: [{ regra: '05-22', nome: 'Dia de Santa Rita' }] });
  const dias = gerarEscala({ inicio, fim, semana: semanaPadrao(), feriados });
  assert.equal(dias.length, 365);
  const a = avaliarEscala(dias, { regime: 42 });
  const meses = mesesDaEscala(a);
  assert.equal(meses.length, 12);
  assert.equal(meses[0].rotulo, 'janeiro de 2027');
  assert.equal(meses[0].dias.length, 31);
  assert.equal(meses[0].feriados, 1, '01/01');
  assert.equal(meses[0].trabalhados, 20, 'janeiro de 2027: 21 dias úteis menos o 1º de janeiro');
  assert.equal(
    meses.reduce((t, m) => t + m.dias.length, 0),
    365,
  );
  const abas = abasEscala(a, { inicio, fim, cidade: 'Cataguases', feriados });
  assert.deepEqual(
    abas.slice(0, 3).map((x) => x.nome),
    ['Meses', 'jan 2027', 'fev 2027'],
  );
  assert.equal(abas.length, 1 + 12 + 4);
  for (const x of abas) for (const l of x.linhas) assert.equal(l.length, x.colunas.length, x.nome);
  const fer = abas.find((x) => x.nome === 'Feriados');
  assert.equal(fer.linhas.length, 11);
  assert.ok(fer.linhas.some((l) => l[2] === 'Dia de Santa Rita' && l[3] === 'Municipal'));
  const b = blocosEscala(a, { inicio, fim, dataText: 'hoje', cidade: 'Cataguases', feriados });
  const paginasDeMes = b.filter((x) => x.type === 'heading' && x.text.startsWith('Escala de '));
  assert.equal(paginasDeMes.length, 12);
  assert.equal(b.filter((x) => x.type === 'pagebreak').length, 13, 'cada mês começa numa página e a lei também');
  for (const t of b.filter((x) => x.type === 'table')) for (const r of t.rows) assert.equal(r.length, t.widths.length);
  assert.match(b[2].text, /Cataguases/);
});
