// /dados/ › Hora: monta uma escala de trabalho por período e confere se ela cabe na jornada de 40, 42 ou 44 horas.
// Regras: CF art. 7º XIII e XV com a redação da EC 141/2026 (promulgada em 16/10/2026: 42h a partir de 17/12/2026 e
// 40h a partir de 17/12/2027, com dois dias de repouso semanal), CLT arts. 58, 59, 66, 67, 71 e 73 e Lei 605/1949.
// Puro: sem tela, para testar.
import { pascoa } from './docpref.js';

export const MARCOS_EC141 = { promulgacao: '2026-10-16', jornada42: '2026-12-17', jornada40: '2027-12-17' };

/** As três regras que a tela compara */
export const REGIMES = {
  40: {
    id: 40,
    rotulo: '40 horas',
    detalhe: 'EC 141/2026, a partir de 17/12/2027',
    semanal: 40 * 60,
    folgas: 2,
    divisor: 200,
    base: 'CF art. 7º, XIII e XV, com a redação da EC 141/2026',
  },
  42: {
    id: 42,
    rotulo: '42 horas',
    detalhe: 'transição da EC 141/2026, de 17/12/2026 a 16/12/2027',
    semanal: 42 * 60,
    folgas: 2,
    divisor: 210,
    base: 'EC 141/2026 (regra de transição) e CF art. 7º, XV',
  },
  44: {
    id: 44,
    rotulo: '44 horas',
    detalhe: 'regra anterior à EC 141/2026, até 16/12/2026',
    semanal: 44 * 60,
    folgas: 1,
    divisor: 220,
    base: 'CF art. 7º, XIII (redação anterior), CLT art. 58 e Lei 605/1949',
  },
};

/** Regra que vale numa data, pelo cronograma da EC 141/2026 */
export const regimeDaData = (iso) => (iso < MARCOS_EC141.jornada42 ? 44 : iso < MARCOS_EC141.jornada40 ? 42 : 40);

export const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const somaDias = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);
export const diaDaSemana = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const diasEntre = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400e3);
export const dataBR = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** "08:30" -> 510; vazio -> null */
export function minutos(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
/** 510 -> "8h30"; 480 -> "8h" */
export function horas(min) {
  const v = Math.round(min || 0);
  const h = Math.floor(Math.abs(v) / 60);
  const m = Math.abs(v) % 60;
  return `${v < 0 ? '−' : ''}${h}h${m ? String(m).padStart(2, '0') : ''}`;
}

/** Semana padrão de 5x2: segunda a sexta das 8h às 17h com 1h de almoço (8h por dia, 40h na semana), sábado e domingo de folga */
export function semanaPadrao({ entrada = '08:00', intervaloInicio = '12:00', intervaloFim = '13:00', saida = '17:00', folgas = [0, 6] } = {}) {
  return DIAS.map((_, dow) => ({ dow, trabalha: !folgas.includes(dow), entrada, intervaloInicio, intervaloFim, saida }));
}

/** Programa as duas folgas da semana: os dias escolhidos viram folga e os demais usam o horário do primeiro dia de trabalho */
export function programarFolgas(semana, folgas) {
  const modelo = semana.find((d) => d.trabalha) || semanaPadrao()[1];
  return semana.map((d) =>
    folgas.includes(d.dow)
      ? { ...d, trabalha: false }
      : {
          ...d,
          trabalha: true,
          entrada: d.trabalha ? d.entrada : modelo.entrada,
          intervaloInicio: d.trabalha ? d.intervaloInicio : modelo.intervaloInicio,
          intervaloFim: d.trabalha ? d.intervaloFim : modelo.intervaloFim,
          saida: d.trabalha ? d.saida : modelo.saida,
        },
  );
}

/* ------------------------------------------------------------------ feriados */

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/** "2027-01" -> "janeiro de 2027" */
export const nomeDoMes = (ym) => `${MESES[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`;

/** Feriados nacionais por lei federal, mais a Sexta-feira da Paixão (feriado religioso da Lei 9.093/1995, adotado nas cidades do país) */
const NACIONAIS = [
  ['01-01', 'Confraternização Universal', 'Lei 662/1949'],
  ['P-2', 'Sexta-feira da Paixão', 'Lei 9.093/1995'],
  ['04-21', 'Tiradentes', 'Lei 662/1949'],
  ['05-01', 'Dia do Trabalho', 'Lei 662/1949'],
  ['09-07', 'Independência do Brasil', 'Lei 662/1949'],
  ['10-12', 'Nossa Senhora Aparecida', 'Lei 6.802/1980'],
  ['11-02', 'Finados', 'Lei 662/1949'],
  ['11-15', 'Proclamação da República', 'Lei 662/1949'],
  ['11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'Lei 14.759/2023'],
  ['12-25', 'Natal', 'Lei 662/1949'],
];
/** Pontos facultativos: só viram feriado se a cidade (ou a convenção coletiva) disser */
export const FACULTATIVOS = [
  { id: 'carnaval', nome: 'Carnaval', regras: ['P-48', 'P-47'] },
  { id: 'corpus', nome: 'Corpus Christi', regras: ['P+60'] },
];

/**
 * Data de uma regra num ano: "MM-DD" (todo ano), "P+N"/"P-N" (dias a partir da Páscoa) ou "AAAA-MM-DD" (só aquele dia)
 * @returns {string|null}
 */
export function dataDaRegra(regra, ano) {
  const r = String(regra || '');
  if (/^\d{2}-\d{2}$/.test(r)) return `${ano}-${r}`;
  const p = /^P([+-]\d+)$/.exec(r);
  if (p) return somaDias(pascoa(ano), Number(p[1]));
  if (/^\d{4}-\d{2}-\d{2}$/.test(r)) return Number(r.slice(0, 4)) === ano ? r : null;
  return null;
}

/**
 * Feriados do período, em ordem de data: nacionais, municipais (lista da cidade e os incluídos à mão) e os pontos
 * facultativos marcados. Na mesma data fica o primeiro: nacional, depois municipal, depois facultativo.
 * @param {string} inicio
 * @param {string} fim
 * @param {{ municipais?: { regra: string, nome: string }[], facultativos?: string[] }} [o]
 * @returns {{ data: string, nome: string, tipo: 'nacional'|'municipal'|'facultativo', regra: string, base?: string }[]}
 */
export function feriadosDoPeriodo(inicio, fim, { municipais = [], facultativos = [] } = {}) {
  const m = new Map();
  const por = (regra, nome, tipo, base) => {
    for (let ano = Number(inicio.slice(0, 4)); ano <= Number(fim.slice(0, 4)); ano++) {
      const data = dataDaRegra(regra, ano);
      if (data && data >= inicio && data <= fim && !m.has(data)) m.set(data, { data, nome, tipo, regra, ...(base ? { base } : {}) });
    }
  };
  for (const [regra, nome, base] of NACIONAIS) por(regra, nome, 'nacional', base);
  for (const f of municipais) if (f?.regra) por(f.regra, f.nome || 'Feriado municipal', 'municipal');
  for (const f of FACULTATIVOS) if (facultativos.includes(f.id)) for (const r of f.regras) por(r, f.nome, 'facultativo');
  return [...m.values()].sort((a, b) => (a.data < b.data ? -1 : 1));
}

export const LIMITE_DIAS = 731;

/**
 * Gera a escala dia a dia no período, a partir da semana padrão.
 * Feriado sem trabalho por padrão (folga do feriado); com trabalharFeriados, o dia segue a semana padrão.
 * @param {{ inicio: string, fim: string, semana: any[], feriados?: { data: string, nome: string }[], trabalharFeriados?: boolean }} o
 */
export function gerarEscala({ inicio, fim, semana, feriados = [], trabalharFeriados = false }) {
  if (!inicio || !fim || fim < inicio) return [];
  const total = diasEntre(inicio, fim) + 1;
  if (total > LIMITE_DIAS) throw new Error('Escolha um período de até 24 meses.');
  const fer = new Map(feriados.map((f) => [f.data, f.nome]));
  const dias = [];
  for (let i = 0; i < total; i++) {
    const data = somaDias(inicio, i);
    const dow = diaDaSemana(data);
    const p = semana[dow];
    const feriado = fer.get(data) || '';
    const trabalha = p.trabalha && (!feriado || trabalharFeriados);
    dias.push({
      data,
      dow,
      feriado,
      tipo: trabalha ? 'trabalho' : feriado && p.trabalha ? 'feriado' : 'folga',
      entrada: p.entrada,
      intervaloInicio: p.intervaloInicio,
      intervaloFim: p.intervaloFim,
      saida: p.saida,
    });
  }
  return dias;
}

/**
 * Os meses do período, para mostrar e imprimir uma página por mês
 * @param {any} a resultado de avaliarEscala
 */
export function mesesDaEscala(a) {
  const m = new Map();
  for (const d of a.dias) {
    const k = d.data.slice(0, 7);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(d);
  }
  return [...m.entries()].map(([mes, dias]) => ({
    mes,
    rotulo: nomeDoMes(mes),
    dias,
    trabalhados: dias.filter((d) => d.trabalha).length,
    folgas: dias.filter((d) => !d.trabalha && d.tipo !== 'feriado').length,
    feriados: dias.filter((d) => d.feriado).length,
    computados: dias.reduce((t, d) => t + (d.trabalha && d.valido ? d.computados : 0), 0),
    alertas: dias.filter((d) => d.alertas.length).length,
  }));
}

/** Datas de mudança de regra da EC 141/2026 dentro do período */
export const mudancasDeRegra = (inicio, fim) =>
  [
    [MARCOS_EC141.jornada42, 44, 42],
    [MARCOS_EC141.jornada40, 42, 40],
  ]
    .filter(([d]) => d > inicio && d <= fim)
    .map(([data, de, para]) => ({ data, de, para }));

/* ------------------------------------------------------------------ cálculo do dia */

const NOTURNO_INI = 22 * 60;
const NOTURNO_FIM = 5 * 60;

/**
 * Horas de um dia de trabalho: horários em ordem (entrada, intervalo, volta, saída), passando da meia-noite quando
 * a hora seguinte é menor. Hora noturna (22h às 5h) vale 52min30s: conta 60/52,5 (CLT art. 73, §1º).
 */
export function calcularDia(d) {
  const e = minutos(d.entrada);
  const s = minutos(d.saida);
  if (e == null || s == null) return { valido: false, trabalhados: 0, noturnos: 0, computados: 0, intervalo: 0 };
  const ii = minutos(d.intervaloInicio);
  const vf = minutos(d.intervaloFim);
  const marcas = [e];
  const temIntervalo = ii != null && vf != null && !(ii === vf);
  if (temIntervalo) marcas.push(ii, vf);
  marcas.push(s);
  for (let i = 1; i < marcas.length; i++) while (marcas[i] <= marcas[i - 1]) marcas[i] += 1440;
  const trechos = temIntervalo
    ? [
        [marcas[0], marcas[1]],
        [marcas[2], marcas[3]],
      ]
    : [[marcas[0], marcas[1]]];
  const trabalhados = trechos.reduce((t, [a, b]) => t + (b - a), 0);
  const noturnos = trechos.reduce((t, [a, b]) => t + noturnosEm(a, b), 0);
  const computados = Math.round(trabalhados - noturnos + (noturnos * 60) / 52.5);
  return {
    valido: trabalhados > 0 && trabalhados <= 24 * 60,
    inicio: marcas[0],
    fim: marcas[marcas.length - 1],
    trabalhados,
    noturnos,
    computados,
    intervalo: temIntervalo ? marcas[2] - marcas[1] : 0,
  };
}

/** Minutos noturnos (22h às 5h) num trecho [a, b), com a e b em minutos a partir da meia-noite do dia (podem passar de 1440) */
function noturnosEm(a, b) {
  let t = 0;
  for (let k = -1; k <= 2; k++) {
    const ini = k * 1440 + NOTURNO_INI;
    const fim = ini + 7 * 60; // 22h às 5h do dia seguinte
    t += Math.max(0, Math.min(b, fim) - Math.max(a, ini));
  }
  return t;
}

/* ------------------------------------------------------------------ verificação */

const inicioDaSemana = (iso, primeiroDia) => somaDias(iso, -((diaDaSemana(iso) - primeiroDia + 7) % 7));

/**
 * Confere a escala numa regra (40, 42 ou 44 horas).
 * Devolve os dias com as horas, as semanas, a lista de problemas (erro = fora da lei; atenção = depende de acordo
 * ou merece cuidado) e o resumo.
 * @param {any[]} dias escala de gerarEscala (ou editada)
 * @param {{ regime: 40|42|44, primeiroDia?: 0|1 }} o primeiroDia: 1 = semana de segunda a domingo; 0 = de domingo a sábado
 */
export function avaliarEscala(dias, { regime, primeiroDia = 1 }) {
  const R = REGIMES[regime];
  const problemas = [];
  const add = (nivel, regra, texto, base, datas = []) => problemas.push({ nivel, regra, texto, base, datas });
  const linhas = dias.map((d, i) => {
    const trabalha = d.tipo === 'trabalho';
    const c = trabalha ? calcularDia(d) : { valido: true, trabalhados: 0, noturnos: 0, computados: 0, intervalo: 0 };
    const ref = Date.parse(`${d.data}T00:00:00Z`) / 60000;
    return { ...d, i, trabalha, ...c, abs: trabalha && c.valido ? { ini: ref + c.inicio, fim: ref + c.fim } : null, alertas: [] };
  });
  const marca = (l, texto) => l.alertas.push(texto);

  // por dia: horário válido, limite diário, intervalo, feriado trabalhado, noite
  for (const l of linhas) {
    if (!l.trabalha) continue;
    if (!l.valido) {
      add('erro', 'Horário', `${dataBR(l.data)}: horário incompleto ou inválido.`, 'Preencha entrada e saída.', [l.data]);
      marca(l, 'horário inválido');
      continue;
    }
    if (l.computados > 10 * 60) {
      add(
        'erro',
        'Limite diário',
        `${dataBR(l.data)}: ${horas(l.computados)} no dia, acima de 10h (8h normais + 2h extras).`,
        'CLT art. 59 (12x36 só por acordo: CLT art. 59-A)',
        [l.data],
      );
      marca(l, 'acima de 10h');
    } else if (l.computados > 8 * 60) {
      const base =
        regime === 42
          ? 'EC 141/2026: na fase de 42h, mais de 8h por dia só com convenção ou acordo coletivo'
          : 'CF art. 7º, XIII (compensação por acordo ou convenção) e CLT art. 59';
      add('atencao', 'Mais de 8h no dia', `${dataBR(l.data)}: ${horas(l.computados)} no dia. Passa de 8h: precisa de acordo de compensação.`, base, [l.data]);
      marca(l, 'mais de 8h');
    }
    const t = l.trabalhados;
    if (t > 6 * 60 && l.intervalo < 60) {
      add(
        'erro',
        'Intervalo para refeição',
        `${dataBR(l.data)}: ${horas(t)} de trabalho com ${l.intervalo ? `${l.intervalo} min` : 'nenhum'} de intervalo. Acima de 6h, o mínimo é 1h.`,
        'CLT art. 71 (pode ser 30 min por convenção ou acordo coletivo: CLT art. 611-A, III)',
        [l.data],
      );
      marca(l, 'intervalo curto');
    } else if (t > 4 * 60 && t <= 6 * 60 && l.intervalo < 15) {
      add('erro', 'Intervalo para refeição', `${dataBR(l.data)}: ${horas(t)} de trabalho sem os 15 min de intervalo.`, 'CLT art. 71, §1º', [l.data]);
      marca(l, 'sem intervalo');
    }
    if (l.intervalo > 120) {
      add(
        'atencao',
        'Intervalo longo',
        `${dataBR(l.data)}: intervalo de ${horas(l.intervalo)}. Acima de 2h só com acordo escrito ou convenção coletiva.`,
        'CLT art. 71',
        [l.data],
      );
      marca(l, 'intervalo acima de 2h');
    }
    if (l.feriado) {
      add('atencao', 'Trabalho em feriado', `${dataBR(l.data)} (${l.feriado}): dia trabalhado. Pagar em dobro ou dar outra folga.`, 'Lei 605/1949, art. 9º', [
        l.data,
      ]);
      marca(l, 'feriado trabalhado');
    }
    if (l.noturnos > 0) marca(l, `${horas(l.noturnos)} noturnas`);
  }

  // descanso entre jornadas (11h) e dias seguidos de trabalho
  const trab = linhas.filter((l) => l.abs);
  for (let k = 1; k < trab.length; k++) {
    const gap = trab[k].abs.ini - trab[k - 1].abs.fim;
    if (gap < 11 * 60) {
      add(
        'erro',
        'Descanso entre jornadas',
        `${dataBR(trab[k - 1].data)} para ${dataBR(trab[k].data)}: só ${horas(gap)} de descanso entre o fim de uma jornada e o início da outra. O mínimo é 11h.`,
        'CLT art. 66',
        [trab[k].data],
      );
      marca(trab[k], 'menos de 11h de descanso');
    }
  }
  let seguidos = 0;
  for (const l of linhas) {
    seguidos = l.trabalha ? seguidos + 1 : 0;
    if (seguidos === 7) {
      add(
        'erro',
        'Dias seguidos de trabalho',
        `${dataBR(l.data)}: 7º dia seguido de trabalho. O repouso tem de vir antes do 7º dia.`,
        'CF art. 7º, XV; CLT art. 67; TST, OJ 410 da SDI-1',
        [l.data],
      );
      marca(l, '7º dia seguido');
    }
  }

  // semanas
  const grupos = new Map();
  for (const l of linhas) {
    const k = inicioDaSemana(l.data, primeiroDia);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(l);
  }
  const semanas = [];
  let semDomingo = 0;
  for (const [ini, ds] of grupos) {
    const completa = ds.length === 7;
    const computados = ds.reduce((t, l) => t + (l.trabalha && l.valido ? l.computados : 0), 0);
    const folgas = ds.filter((l) => !l.trabalha).length;
    const domingoLivre = ds.some((l) => l.dow === 0 && !l.trabalha);
    const temDomingo = ds.some((l) => l.dow === 0);
    // maior descanso seguido que começa na semana (inclui a virada da semana anterior)
    const fimSemana = Date.parse(`${somaDias(ini, 7)}T00:00:00Z`) / 60000;
    const iniSemana = Date.parse(`${ini}T00:00:00Z`) / 60000;
    let maiorDescanso = 0;
    const blocos = trab.map((l) => l.abs);
    const antes = blocos.filter((b) => b.fim <= iniSemana).at(-1);
    const dentro = blocos.filter((b) => b.ini >= iniSemana && b.ini < fimSemana);
    let anterior = antes ? antes.fim : iniSemana;
    for (const b of dentro) {
      maiorDescanso = Math.max(maiorDescanso, b.ini - anterior);
      anterior = b.fim;
    }
    const depois = blocos.find((b) => b.ini >= fimSemana);
    maiorDescanso = Math.max(maiorDescanso, (depois ? depois.ini : fimSemana) - anterior);
    const excesso = Math.max(0, computados - R.semanal);
    const s = {
      inicio: ini,
      fim: somaDias(ini, 6),
      dias: ds.length,
      completa,
      computados,
      limite: R.semanal,
      excesso,
      folgas,
      domingoLivre,
      maiorDescanso,
      problemas: 0,
    };
    const antesProb = problemas.length;
    if (excesso > 0)
      add(
        'erro',
        'Limite semanal',
        `Semana de ${dataBR(ini)}: ${horas(computados)} de trabalho, ${horas(excesso)} acima das ${regime}h. O que passa do limite não pode ser jornada normal: é hora extra, com adicional de 50%.`,
        `${R.base}; CF art. 7º, XVI`,
        ds.map((l) => l.data),
      );
    if (completa && folgas < R.folgas)
      add(
        'erro',
        R.folgas === 2 ? 'Duas folgas por semana (5x2)' : 'Repouso semanal',
        `Semana de ${dataBR(ini)}: ${folgas === 0 ? 'nenhuma folga' : `só ${folgas} folga`}. ${R.folgas === 2 ? 'A EC 141/2026 garante dois dias de repouso semanal remunerado.' : 'É obrigatório um repouso semanal de 24h.'}`,
        R.folgas === 2 ? 'CF art. 7º, XV, com a redação da EC 141/2026' : 'CF art. 7º, XV; CLT art. 67; Lei 605/1949',
        ds.map((l) => l.data),
      );
    if (completa && folgas >= 1 && maiorDescanso < 35 * 60)
      add(
        'atencao',
        'Descanso semanal de 35h',
        `Semana de ${dataBR(ini)}: o maior descanso seguido é de ${horas(maiorDescanso)}. O repouso semanal (24h) mais o intervalo entre jornadas (11h) somam 35h seguidas.`,
        'CLT arts. 66 e 67',
        ds.map((l) => l.data),
      );
    if (completa && temDomingo && !domingoLivre && R.folgas === 2)
      add(
        'atencao',
        'Folga no domingo',
        `Semana de ${dataBR(ini)}: trabalho no domingo. Um dos dois dias de repouso deve cair, de preferência, no domingo.`,
        'CF art. 7º, XV, com a redação da EC 141/2026',
        ds.map((l) => l.data),
      );
    if (temDomingo) {
      semDomingo = domingoLivre ? 0 : semDomingo + 1;
      if (semDomingo === 3)
        add(
          'atencao',
          'Domingos seguidos de trabalho',
          `${dataBR(ds.find((l) => l.dow === 0).data)}: 3º domingo seguido de trabalho. No comércio, a folga deve cair no domingo pelo menos uma vez a cada 3 semanas.`,
          'Lei 10.101/2000, art. 6º, parágrafo único',
          [ds.find((l) => l.dow === 0).data],
        );
    }
    s.problemas = problemas.length - antesProb;
    semanas.push(s);
  }

  const erros = problemas.filter((p) => p.nivel === 'erro').length;
  const atencao = problemas.length - erros;
  const totalComputado = linhas.reduce((t, l) => t + (l.trabalha && l.valido ? l.computados : 0), 0);
  const completas = semanas.filter((s) => s.completa);
  const media = completas.length ? completas.reduce((t, s) => t + s.computados, 0) / completas.length : null;
  return {
    regime: R,
    dias: linhas.map(({ abs, ...l }) => l),
    semanas,
    problemas,
    resumo: {
      dentro: erros === 0,
      erros,
      atencao,
      diasTrabalhados: linhas.filter((l) => l.trabalha).length,
      folgas: linhas.filter((l) => !l.trabalha).length,
      totalComputado,
      noturnos: linhas.reduce((t, l) => t + (l.trabalha ? l.noturnos : 0), 0),
      mediaSemanal: media,
      excesso: semanas.reduce((t, s) => t + s.excesso, 0),
      semanasCompletas: completas.length,
    },
  };
}

/** A mesma escala nas três regras: cabe em 44h, 42h e 40h? */
export function compararRegimes(dias, primeiroDia = 1) {
  return [44, 42, 40].map((r) => {
    const a = avaliarEscala(dias, { regime: r, primeiroDia });
    return { regime: r, rotulo: REGIMES[r].rotulo, dentro: a.resumo.dentro, erros: a.resumo.erros, atencao: a.resumo.atencao, excesso: a.resumo.excesso };
  });
}

/** O que diz a lei: usado na tela e no PDF */
export const LEGISLACAO = [
  {
    titulo: 'Jornada de 40 horas e escala 5x2 (EC 141/2026)',
    itens: [
      'A Emenda Constitucional 141, promulgada em 16/10/2026, muda o art. 7º da Constituição: trabalho normal de até 8 horas por dia e 40 horas por semana (inciso XIII).',
      'Dois dias de repouso semanal remunerado, um deles de preferência no domingo (inciso XV). É a escala 5x2: cinco dias de trabalho e duas folgas por semana.',
      'Transição: 42 horas semanais a partir de 17/12/2026 e 40 horas a partir de 17/12/2027 (datas como divulgadas; confira no texto oficial).',
      'Na fase de 42 horas, distribuir mais de 8 horas num dia exige convenção ou acordo coletivo. Sem ele, valem as 8 horas por dia.',
      'A redução não pode diminuir o salário. Quem já trabalha 40 horas ou menos não tem a jornada reduzida em proporção.',
      'A escala 6x1 só continua se prevista em convenção ou acordo coletivo. A emenda tem exceções (por exemplo, servidores públicos e empregados com diploma de nível superior e salário alto): confira o texto.',
      'Terceirização na administração pública: pelo texto aprovado, a passagem para 42 e 40 horas depende de aditivo ao contrato entre a empresa e o órgão.',
    ],
  },
  {
    titulo: 'Regras da CLT e dos feriados que continuam valendo',
    itens: [
      'Horas extras: no máximo 2 por dia, com adicional de pelo menos 50% (CLT art. 59; CF art. 7º, XVI). A escala 12x36 depende de acordo (CLT art. 59-A).',
      'Descanso entre jornadas: pelo menos 11 horas seguidas (CLT art. 66).',
      'Repouso semanal: 24 horas seguidas, que somadas às 11 horas entre jornadas dão 35 horas (CLT arts. 66 e 67). O repouso deve vir antes do 7º dia seguido de trabalho (TST, OJ 410 da SDI-1).',
      'Intervalo para refeição: de 1 a 2 horas em jornadas acima de 6 horas; 15 minutos entre 4 e 6 horas (CLT art. 71). Pode cair para 30 minutos por convenção ou acordo coletivo (CLT art. 611-A, III).',
      'Trabalho noturno (22h às 5h): a hora vale 52min30s e tem adicional de pelo menos 20% (CLT art. 73).',
      'Feriado trabalhado: pagamento em dobro ou outro dia de folga (Lei 605/1949, art. 9º). No comércio, a folga cai no domingo ao menos uma vez a cada 3 semanas (Lei 10.101/2000, art. 6º).',
      'Feriados municipais vêm de lei municipal: até quatro religiosos, contando a Sexta-feira da Paixão (Lei 9.093/1995). Carnaval e Corpus Christi são pontos facultativos, a não ser que a lei da cidade os declare feriado.',
      'Divisor do salário-hora: 200 horas por mês para 40h semanais, 210 para 42h e 220 para 44h.',
    ],
  },
];

/* ------------------------------------------------------------------ relatórios */

const SITUACAO = { trabalho: 'Trabalho', folga: 'Folga', feriado: 'Feriado (folga)' };
const intervaloTxt = (d) => (d.intervaloInicio && d.intervaloFim && d.intervaloInicio !== d.intervaloFim ? `${d.intervaloInicio} às ${d.intervaloFim}` : '—');

const TIPO_FERIADO = { nacional: 'Nacional', municipal: 'Municipal', facultativo: 'Ponto facultativo marcado' };
const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const horasDecimais = (min) => Math.round((min / 60) * 100) / 100;

/**
 * Excel: os meses, uma aba por mês com a escala dia a dia, as semanas, os feriados, a verificação e a lei
 * @param {any} a resultado de avaliarEscala
 * @param {{ inicio: string, fim: string, cidade?: string, feriados?: { data: string, nome: string, tipo: string }[] }} o
 */
export function abasEscala(a, { inicio, fim, cidade = '', feriados = [] }) {
  const r = a.regime;
  const meses = mesesDaEscala(a);
  return [
    {
      nome: 'Meses',
      colunas: [
        { titulo: 'Mês', largura: 20 },
        { titulo: 'Dias de trabalho', largura: 12, tipo: 'numero' },
        { titulo: 'Folgas', largura: 9, tipo: 'numero' },
        { titulo: 'Feriados', largura: 9, tipo: 'numero' },
        { titulo: 'Horas computadas', largura: 12, tipo: 'numero' },
        { titulo: 'Dias com alerta', largura: 11, tipo: 'numero' },
      ],
      linhas: meses.map((m) => [maiuscula(m.rotulo), m.trabalhados, m.folgas, m.feriados, horasDecimais(m.computados), m.alertas]),
    },
    ...meses.map((m) => ({
      nome: `${MESES_CURTOS[Number(m.mes.slice(5, 7)) - 1]} ${m.mes.slice(0, 4)}`,
      colunas: [
        { titulo: 'Data', largura: 12, tipo: 'data' },
        { titulo: 'Dia da semana', largura: 15 },
        { titulo: 'Feriado', largura: 26 },
        { titulo: 'Situação', largura: 15 },
        { titulo: 'Entrada', largura: 9 },
        { titulo: 'Intervalo', largura: 15 },
        { titulo: 'Saída', largura: 9 },
        { titulo: 'Horas trabalhadas', largura: 12, tipo: 'numero' },
        { titulo: 'Horas noturnas', largura: 11, tipo: 'numero' },
        { titulo: 'Horas computadas', largura: 12, tipo: 'numero' },
        { titulo: 'Alertas', largura: 40 },
      ],
      linhas: m.dias.map((d) => [
        d.data,
        DIAS[d.dow],
        d.feriado,
        SITUACAO[d.tipo] || d.tipo,
        d.trabalha ? d.entrada : '',
        d.trabalha ? intervaloTxt(d) : '',
        d.trabalha ? d.saida : '',
        d.trabalha ? horasDecimais(d.trabalhados) : 0,
        d.trabalha ? horasDecimais(d.noturnos) : 0,
        d.trabalha ? horasDecimais(d.computados) : 0,
        d.alertas.join('; '),
      ]),
    })),
    {
      nome: 'Semanas',
      colunas: [
        { titulo: 'De', largura: 12, tipo: 'data' },
        { titulo: 'Até', largura: 12, tipo: 'data' },
        { titulo: 'Dias no período', largura: 10, tipo: 'numero' },
        { titulo: 'Horas computadas', largura: 13, tipo: 'numero' },
        { titulo: `Limite (${r.id}h)`, largura: 11, tipo: 'numero' },
        { titulo: 'Acima do limite (h)', largura: 13, tipo: 'numero' },
        { titulo: 'Folgas', largura: 8, tipo: 'numero' },
        { titulo: 'Folga no domingo', largura: 11 },
        { titulo: 'Maior descanso seguido (h)', largura: 14, tipo: 'numero' },
        { titulo: 'Situação', largura: 22 },
      ],
      linhas: a.semanas.map((s) => [
        s.inicio,
        s.fim,
        s.dias,
        Math.round((s.computados / 60) * 100) / 100,
        r.id,
        Math.round((s.excesso / 60) * 100) / 100,
        s.folgas,
        s.domingoLivre ? 'sim' : 'não',
        Math.round((s.maiorDescanso / 60) * 10) / 10,
        !s.completa ? 'semana incompleta' : s.problemas ? `${s.problemas} problema(s)` : 'ok',
      ]),
    },
    {
      nome: 'Feriados',
      colunas: [
        { titulo: 'Data', largura: 12, tipo: 'data' },
        { titulo: 'Dia da semana', largura: 15 },
        { titulo: 'Feriado', largura: 50 },
        { titulo: 'Tipo', largura: 24 },
        { titulo: 'Na escala', largura: 16 },
      ],
      linhas: feriados.map((f) => {
        const d = a.dias.find((x) => x.data === f.data);
        return [f.data, DIAS[diaDaSemana(f.data)], f.nome, TIPO_FERIADO[f.tipo] || f.tipo, !d ? '' : d.trabalha ? 'trabalhado' : 'folga'];
      }),
    },
    {
      nome: 'Verificação',
      colunas: [
        { titulo: 'Nível', largura: 10 },
        { titulo: 'Regra', largura: 26 },
        { titulo: 'O que aconteceu', largura: 90 },
        { titulo: 'Base legal', largura: 60 },
      ],
      linhas: [
        [
          '',
          'Resultado',
          `${a.resumo.dentro ? 'Dentro' : 'Fora'} da regra de ${r.id} horas (${dataBR(inicio)} a ${dataBR(fim)}${cidade ? `, ${cidade}` : ''}): ${a.resumo.erros} problema(s) e ${a.resumo.atencao} ponto(s) de atenção.`,
          r.base,
        ],
        ...a.problemas.map((p) => [p.nivel === 'erro' ? 'Problema' : 'Atenção', p.regra, p.texto, p.base]),
      ],
    },
    {
      nome: 'O que diz a lei',
      colunas: [
        { titulo: 'Tema', largura: 40 },
        { titulo: 'Regra', largura: 140 },
      ],
      linhas: LEGISLACAO.flatMap((g) => g.itens.map((t, i) => [i ? '' : g.titulo, t])),
    },
  ];
}

/**
 * PDF: resultado, comparação das regras, meses, feriados, problemas, semanas, uma página por mês e a lei
 * @param {any} a resultado de avaliarEscala
 * @param {{ inicio: string, fim: string, dataText: string, comparativo?: any[], primeiroDia?: 0|1, cidade?: string, feriados?: { data: string, nome: string, tipo: string }[] }} o
 */
export function blocosEscala(a, { inicio, fim, dataText, comparativo, primeiroDia = 1, cidade = '', feriados = [] }) {
  const r = a.regime;
  const res = a.resumo;
  const meses = mesesDaEscala(a);
  const b = [
    { type: 'date', text: dataText },
    { type: 'title', text: `Escala de trabalho · regra de ${r.id} horas` },
    {
      type: 'para',
      text: `Período de ${dataBR(inicio)} a ${dataBR(fim)}${cidade ? ` · ${cidade}` : ''} · semana de ${primeiroDia === 1 ? 'segunda a domingo' : 'domingo a sábado'} · ${r.detalhe}.`,
      size: 9.5,
      color: 'muted',
      gapAfter: 4,
    },
    {
      type: 'para',
      text: res.dentro
        ? `Dentro da regra de ${r.id} horas.${res.atencao ? ` ${res.atencao} ponto(s) de atenção, que dependem de acordo ou merecem cuidado.` : ''}`
        : `Fora da regra de ${r.id} horas: ${res.erros} problema(s)${res.atencao ? ` e ${res.atencao} ponto(s) de atenção` : ''}.`,
      bold: true,
      gapAfter: 6,
    },
    {
      type: 'table',
      size: 8.6,
      widths: [0.2, 0.2, 0.2, 0.2, 0.2],
      header: ['Dias de trabalho', 'Folgas e feriados', 'Horas no período', 'Média por semana', 'Acima do limite'],
      headerAlign: ['center', 'center', 'center', 'center', 'center'],
      rows: [
        [
          { text: String(res.diasTrabalhados), align: 'center' },
          { text: String(res.folgas), align: 'center' },
          { text: horas(res.totalComputado), align: 'center' },
          { text: res.mediaSemanal == null ? '—' : horas(res.mediaSemanal), align: 'center' },
          { text: horas(res.excesso), align: 'center', bold: res.excesso > 0 },
        ],
      ],
    },
  ];
  if (comparativo?.length)
    b.push({
      type: 'table',
      size: 8.6,
      widths: [0.34, 0.33, 0.33],
      header: comparativo.map((c) => `Regra de ${c.regime} horas`),
      headerAlign: comparativo.map(() => 'center'),
      rows: [comparativo.map((c) => ({ text: c.dentro ? 'Cabe' : `Não cabe (${c.erros} problema${c.erros === 1 ? '' : 's'})`, align: 'center', bold: true }))],
    });
  if (meses.length > 1) {
    b.push({ type: 'heading', text: 'Mês a mês' });
    b.push({
      type: 'table',
      size: 8.4,
      widths: [0.28, 0.16, 0.14, 0.14, 0.14, 0.14],
      header: ['Mês', 'Dias de trabalho', 'Folgas', 'Feriados', 'Horas', 'Dias com alerta'],
      headerAlign: ['left', 'center', 'center', 'center', 'center', 'center'],
      rows: meses.map((m) => [
        maiuscula(m.rotulo),
        { text: String(m.trabalhados), align: 'center' },
        { text: String(m.folgas), align: 'center' },
        { text: String(m.feriados), align: 'center' },
        { text: horas(m.computados), align: 'center' },
        { text: String(m.alertas), align: 'center', bold: m.alertas > 0 },
      ]),
    });
  }
  if (feriados.length) {
    b.push({ type: 'heading', text: `Feriados do período${cidade ? ` (${cidade})` : ''}` });
    b.push({
      type: 'table',
      size: 8,
      widths: [0.12, 0.16, 0.48, 0.24],
      header: ['Data', 'Dia', 'Feriado', 'Tipo'],
      headerAlign: ['left', 'left', 'left', 'left'],
      rows: feriados.map((f) => [dataBR(f.data), DIAS[diaDaSemana(f.data)], f.nome, TIPO_FERIADO[f.tipo] || f.tipo]),
    });
  }
  if (a.problemas.length) {
    b.push({ type: 'heading', text: 'O que precisa de ajuste' });
    b.push({
      type: 'table',
      size: 8,
      widths: [0.12, 0.2, 0.43, 0.25],
      header: ['Nível', 'Regra', 'O que aconteceu', 'Base legal'],
      rows: a.problemas.slice(0, 120).map((p) => [{ text: p.nivel === 'erro' ? 'Problema' : 'Atenção', bold: p.nivel === 'erro' }, p.regra, p.texto, p.base]),
    });
    if (a.problemas.length > 120) b.push({ type: 'note', text: `Mais ${a.problemas.length - 120} itens no Excel.` });
  }
  b.push({ type: 'heading', text: 'Semanas' });
  b.push({
    type: 'table',
    size: 8,
    widths: [0.24, 0.14, 0.12, 0.1, 0.16, 0.24],
    header: ['Semana', 'Horas', 'Limite', 'Folgas', 'Domingo livre', 'Situação'],
    headerAlign: ['left', 'center', 'center', 'center', 'center', 'left'],
    rows: a.semanas.map((s) => [
      `${dataBR(s.inicio)} a ${dataBR(s.fim)}`,
      { text: horas(s.computados), align: 'center', bold: s.excesso > 0 },
      { text: `${r.id}h`, align: 'center' },
      { text: String(s.folgas), align: 'center' },
      { text: s.domingoLivre ? 'sim' : 'não', align: 'center' },
      !s.completa ? 'incompleta no período' : s.problemas ? `${s.problemas} item(ns) a ver` : 'ok',
    ]),
  });
  for (const m of meses) {
    b.push({ type: 'pagebreak' }, { type: 'heading', text: `Escala de ${m.rotulo}` });
    b.push({
      type: 'para',
      text: `${m.trabalhados} dias de trabalho · ${m.folgas} folgas · ${m.feriados} ${m.feriados === 1 ? 'feriado' : 'feriados'} · ${horas(m.computados)} no mês${m.alertas ? ` · ${m.alertas} ${m.alertas === 1 ? 'dia' : 'dias'} com alerta` : ''}`,
      size: 9,
      color: 'muted',
      gapAfter: 4,
    });
    b.push({
      type: 'table',
      size: 7.6,
      widths: [0.08, 0.13, 0.19, 0.08, 0.13, 0.08, 0.08, 0.23],
      header: ['Data', 'Dia', 'Situação', 'Entrada', 'Intervalo', 'Saída', 'Horas', 'Alertas'],
      headerAlign: ['left', 'left', 'left', 'center', 'center', 'center', 'center', 'left'],
      rows: m.dias.map((d) => [
        dataBR(d.data).slice(0, 5),
        DIAS[d.dow],
        d.feriado ? `${SITUACAO[d.tipo]} · ${d.feriado}` : SITUACAO[d.tipo],
        { text: d.trabalha ? d.entrada : '', align: 'center' },
        { text: d.trabalha ? intervaloTxt(d) : '', align: 'center' },
        { text: d.trabalha ? d.saida : '', align: 'center' },
        { text: d.trabalha ? horas(d.computados) : '', align: 'center' },
        d.alertas.join('; '),
      ]),
    });
  }
  b.push({ type: 'pagebreak' }, { type: 'heading', text: 'O que diz a lei' });
  for (const g of LEGISLACAO) b.push({ type: 'para', text: g.titulo, bold: true, gapAfter: 2 }, { type: 'bullets', items: g.itens });
  b.push({
    type: 'note',
    text: 'Conferência automática da escala informada. Não substitui a análise do contrato, da convenção ou do acordo coletivo da categoria.',
  });
  return b;
}
