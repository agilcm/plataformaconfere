// /dados/ › Hora: monta a escala de trabalho de um período (com as duas folgas semanais do 5x2) e diz se ela cabe na
// regra de 40, 42 ou 44 horas, com a base legal de cada ponto. As regras ficam em lib/jornada.js.
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/ui.tsx';
import {
  DIAS,
  DIAS_CURTOS,
  LEGISLACAO,
  REGIMES,
  abasEscala,
  avaliarEscala,
  blocosEscala,
  calcularDia,
  compararRegimes,
  dataBR,
  gerarEscala,
  horas,
  programarFolgas,
  regimeDaData,
  semanaPadrao,
} from '../lib/jornada.js';
import { dateText, downloadPdf } from '../lib/pdfReport.ts';
import { baixarXlsx } from '../lib/xlsx.js';

type Regime = 40 | 42 | 44;
type DiaModelo = { dow: number; trabalha: boolean; entrada: string; intervaloInicio: string; intervaloFim: string; saida: string };
type Ajuste = Partial<{ tipo: string; entrada: string; intervaloInicio: string; intervaloFim: string; saida: string }>;

const card = 'p-5 sm:p-6 rounded-2xl bg-white border border-slate-200';
const campo =
  'w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-[15px] text-[#0F2053] focus:outline-none focus:border-[#0478CA] disabled:bg-slate-100 disabled:text-slate-400';
const hojeISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const soma = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);
const fimDoMes = (iso: string) => {
  const [a, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0, 12)).toISOString().slice(0, 10);
};
const CHAVE = 'agilcm:hora';

const MODELOS: { id: string; rotulo: string; nota: string; semana: () => DiaModelo[] }[] = [
  { id: '5x2-40', rotulo: '5x2 · 8h por dia', nota: '40h na semana', semana: () => semanaPadrao() },
  { id: '5x2-42', rotulo: '5x2 · 8h24 por dia', nota: '42h, exige acordo coletivo', semana: () => semanaPadrao({ saida: '17:24' }) },
  {
    id: '6x1-44',
    rotulo: '6x1 · seg a sex 8h e sábado 4h',
    nota: '44h, regra antiga',
    semana: () => semanaPadrao({ folgas: [0] }).map((d) => (d.dow === 6 ? { ...d, intervaloInicio: '', intervaloFim: '', saida: '12:00' } : d)),
  },
];

function lerSalvo() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || 'null');
  } catch {
    return null;
  }
}

export default function JornadaHora() {
  const salvo = useMemo(lerSalvo, []);
  const [regime, setRegime] = useState<Regime>(salvo?.regime ?? 40);
  const [inicio, setInicio] = useState<string>(salvo?.inicio ?? hojeISO());
  const [fim, setFim] = useState<string>(salvo?.fim ?? soma(hojeISO(), 27));
  const [primeiroDia, setPrimeiroDia] = useState<0 | 1>(salvo?.primeiroDia ?? 1);
  const [semana, setSemana] = useState<DiaModelo[]>(salvo?.semana ?? semanaPadrao());
  const [folgasEscolhidas, setFolgasEscolhidas] = useState<number[]>(salvo?.folgas ?? [6, 0]);
  const [locais, setLocais] = useState<{ data: string; nome: string }[]>(salvo?.locais ?? []);
  const [trabFeriados, setTrabFeriados] = useState<boolean>(salvo?.trabFeriados ?? false);
  const [ajustes, setAjustes] = useState<Record<string, Ajuste>>(salvo?.ajustes ?? {});
  const [novoFeriado, setNovoFeriado] = useState({ data: '', nome: '' });
  const [gerando, setGerando] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ regime, inicio, fim, primeiroDia, semana, folgas: folgasEscolhidas, locais, trabFeriados, ajustes }));
    } catch {
      /* sem armazenamento: segue sem salvar */
    }
  }, [regime, inicio, fim, primeiroDia, semana, folgasEscolhidas, locais, trabFeriados, ajustes]);

  const erroPeriodo = !inicio || !fim ? 'Informe as duas datas.' : fim < inicio ? 'A data final vem antes da inicial.' : '';
  const base = useMemo(() => {
    if (erroPeriodo) return [];
    try {
      return gerarEscala({ inicio, fim, semana, feriadosLocais: locais, trabalharFeriados: trabFeriados });
    } catch {
      return [];
    }
  }, [inicio, fim, semana, locais, trabFeriados, erroPeriodo]);
  const longo = !erroPeriodo && base.length === 0;
  const dias = useMemo(() => base.map((d: any) => ({ ...d, ...(ajustes[d.data] || {}) })), [base, ajustes]);
  const a = useMemo(() => (dias.length ? avaliarEscala(dias, { regime, primeiroDia }) : null), [dias, regime, primeiroDia]);
  const comparativo = useMemo(() => (dias.length ? compararRegimes(dias, primeiroDia) : []), [dias, primeiroDia]);
  const ajustados = Object.keys(ajustes).filter((d) => d >= inicio && d <= fim).length;
  const ordemDias = primeiroDia === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  const totalModelo = semana.reduce((t, d) => (d.trabalha ? t + calcularDia(d).computados : t), 0);
  const folgasModelo = semana.filter((d) => !d.trabalha).length;
  const regraDaData = regimeDaData(inicio || hojeISO()) as Regime;

  const mudarDiaModelo = (dow: number, campoNome: keyof DiaModelo, valor: any) =>
    setSemana((s) => s.map((d) => (d.dow === dow ? { ...d, [campoNome]: valor } : d)));
  const alternarFolga = (dow: number) => setFolgasEscolhidas((f) => (f.includes(dow) ? f.filter((x) => x !== dow) : f.length >= 2 ? [f[1], dow] : [...f, dow]));
  const ajustar = (data: string, campoNome: keyof Ajuste, valor: string) => setAjustes((x) => ({ ...x, [data]: { ...(x[data] || {}), [campoNome]: valor } }));

  const nomeArquivo = (ext: string) => `escala-${regime}h-${inicio}-a-${fim}.${ext}`;
  const baixarPdf = async () => {
    if (!a) return;
    setGerando('Gerando o PDF…');
    try {
      await downloadPdf(nomeArquivo('pdf'), `Escala ${regime}h`, blocosEscala(a, { inicio, fim, dataText: dateText(), comparativo, primeiroDia }) as never);
    } finally {
      setGerando('');
    }
  };

  // dias agrupados por semana, para a tabela
  const semanasTabela = useMemo(() => {
    if (!a) return [];
    return a.semanas.map((s: any) => ({ ...s, linhas: a.dias.filter((d: any) => d.data >= s.inicio && d.data <= s.fim) }));
  }, [a]);
  const porRegra = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const p of a?.problemas || []) m.set(p.regra, [...(m.get(p.regra) || []), p]);
    return [...m.entries()].sort((x, y) => (x[1][0].nivel === y[1][0].nivel ? y[1].length - x[1].length : x[1][0].nivel === 'erro' ? -1 : 1));
  }, [a]);

  return (
    <div className="space-y-4">
      <div className={card}>
        <p className="text-lg font-bold text-[#0F2053]">Hora: monte a escala e veja se ela cabe na lei</p>
        <p className="mt-1 text-[15px] text-slate-600 max-w-3xl">
          Escolha a regra, o período e a semana padrão com as duas folgas. A escala é montada dia a dia, com o dia da semana e os feriados de cada data, e cada
          dia pode ser ajustado. A conferência segue a EC 141/2026 (5x2, 42h e 40h) e a CLT.
        </p>
      </div>

      {/* 1. Regra */}
      <section className={card} aria-labelledby="h-regra">
        <h2 id="h-regra" className="text-lg font-bold text-[#0F2053]">
          1. Regra da jornada
        </h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3" role="group" aria-label="Regra da jornada">
          {([40, 42, 44] as Regime[]).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={regime === r}
              onClick={() => setRegime(r)}
              className={`text-left p-4 rounded-xl border-2 cursor-pointer ${regime === r ? 'border-[#0F2053] bg-[#0F2053] text-white' : 'border-slate-200 bg-white text-[#0F2053] hover:border-[#0478CA]'}`}
            >
              <span className="block text-2xl font-bold tabular-nums">{REGIMES[r].rotulo}</span>
              <span className={`block text-sm ${regime === r ? 'text-white/80' : 'text-slate-600'}`}>{REGIMES[r].detalhe}</span>
              <span className={`block mt-1 text-xs ${regime === r ? 'text-white/70' : 'text-slate-500'}`}>
                {REGIMES[r].folgas === 2 ? 'Duas folgas por semana (5x2)' : 'Uma folga por semana'} · divisor {REGIMES[r].divisor}h/mês
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Pela EC 141/2026, em {dataBR(inicio || hojeISO())} vale a regra de <strong>{regraDaData} horas</strong>.
          {regraDaData !== regime && (
            <button type="button" onClick={() => setRegime(regraDaData)} className="ml-2 font-bold text-[#0478CA] underline cursor-pointer">
              Usar a regra dessa data
            </button>
          )}
        </p>
      </section>

      {/* 2. Período */}
      <section className={card} aria-labelledby="h-periodo">
        <h2 id="h-periodo" className="text-lg font-bold text-[#0F2053]">
          2. Período
        </h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl">
          <label>
            <span className="block text-sm font-semibold text-slate-700 mb-1">Data inicial</span>
            <input id="hora-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={campo} />
            {inicio && <span className="block mt-1 text-xs text-slate-500">{DIAS[new Date(`${inicio}T12:00:00Z`).getUTCDay()]}</span>}
          </label>
          <label>
            <span className="block text-sm font-semibold text-slate-700 mb-1">Data final</span>
            <input id="hora-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={campo} />
            {fim && <span className="block mt-1 text-xs text-slate-500">{DIAS[new Date(`${fim}T12:00:00Z`).getUTCDay()]}</span>}
          </label>
          <label>
            <span className="block text-sm font-semibold text-slate-700 mb-1">A semana começa no</span>
            <select id="hora-semana" value={primeiroDia} onChange={(e) => setPrimeiroDia(Number(e.target.value) as 0 | 1)} className={campo}>
              <option value={1}>segunda (segunda a domingo)</option>
              <option value={0}>domingo (domingo a sábado)</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="self-center font-semibold text-slate-700">Atalhos:</span>
          {[
            ['4 semanas', () => setFim(soma(inicio, 27))],
            ['Mês da data inicial', () => (setInicio(`${inicio.slice(0, 7)}-01`), setFim(fimDoMes(inicio)))],
            ['3 meses', () => setFim(soma(inicio, 90))],
          ].map(([rot, fn]) => (
            <button
              key={rot as string}
              type="button"
              onClick={fn as () => void}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-[#0F2053] hover:border-[#0478CA] cursor-pointer"
            >
              {rot as string}
            </button>
          ))}
        </div>
        {erroPeriodo && <p className="mt-2 text-sm font-semibold text-red-700">{erroPeriodo}</p>}
        {longo && <p className="mt-2 text-sm font-semibold text-red-700">Escolha um período de até 400 dias.</p>}

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-700">Feriados</p>
            <p className="text-sm text-slate-600">Os nacionais entram sozinhos. Inclua os feriados da cidade (aniversário, padroeiro).</p>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="min-w-0">
                <span className="sr-only">Data do feriado local</span>
                <input
                  id="hora-feriado-data"
                  type="date"
                  value={novoFeriado.data}
                  onChange={(e) => setNovoFeriado((f) => ({ ...f, data: e.target.value }))}
                  className={campo}
                />
              </label>
              <label className="min-w-0 flex-1">
                <span className="sr-only">Nome do feriado local</span>
                <input
                  id="hora-feriado-nome"
                  type="text"
                  placeholder="Nome (ex.: aniversário da cidade)"
                  value={novoFeriado.nome}
                  onChange={(e) => setNovoFeriado((f) => ({ ...f, nome: e.target.value }))}
                  className={campo}
                />
              </label>
              <button
                type="button"
                disabled={!novoFeriado.data}
                onClick={() => {
                  setLocais((l) => [
                    ...l.filter((x) => x.data !== novoFeriado.data),
                    { data: novoFeriado.data, nome: novoFeriado.nome.trim() || 'Feriado local' },
                  ]);
                  setNovoFeriado({ data: '', nome: '' });
                }}
                className="px-3 py-1.5 rounded-lg bg-[#0F2053] text-white font-bold disabled:opacity-40 cursor-pointer"
              >
                Incluir
              </button>
            </div>
            {locais.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {locais.map((f) => (
                  <li key={f.data} className="inline-flex items-center gap-2 pl-3 pr-1 py-1 rounded-full bg-[#F4F7FB] border border-slate-200 text-sm">
                    {dataBR(f.data)} · {f.nome}
                    <button
                      type="button"
                      aria-label={`Tirar ${f.nome}`}
                      onClick={() => setLocais((l) => l.filter((x) => x.data !== f.data))}
                      className="w-6 h-6 rounded-full hover:bg-white cursor-pointer"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label className="flex items-start gap-3 self-start p-3 rounded-xl bg-[#F4F7FB] cursor-pointer">
            <input id="hora-trab-feriado" type="checkbox" checked={trabFeriados} onChange={(e) => setTrabFeriados(e.target.checked)} className="mt-1 w-4 h-4" />
            <span className="text-sm text-slate-700">
              <strong className="text-[#0F2053]">Trabalhar nos feriados</strong>
              <span className="block">
                Desmarcado, o feriado vira folga. Marcado, segue a semana padrão e o sistema avisa que o dia deve ser pago em dobro ou compensado.
              </span>
            </span>
          </label>
        </div>
      </section>

      {/* 3. Semana padrão */}
      <section className={card} aria-labelledby="h-semana">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="h-semana" className="text-lg font-bold text-[#0F2053]">
            3. Semana padrão
          </h2>
          <p className={`text-sm font-bold ${totalModelo > REGIMES[regime].semanal ? 'text-red-700' : 'text-[#128C4A]'}`}>
            {horas(totalModelo)} na semana · {folgasModelo} {folgasModelo === 1 ? 'folga' : 'folgas'} · limite {regime}h
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {MODELOS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setSemana(m.semana());
                setFolgasEscolhidas(
                  m
                    .semana()
                    .filter((d) => !d.trabalha)
                    .map((d) => d.dow),
                );
              }}
              className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-left hover:border-[#0478CA] cursor-pointer"
            >
              <span className="block text-sm font-bold text-[#0F2053]">{m.rotulo}</span>
              <span className="block text-xs text-slate-500">{m.nota}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 p-4 rounded-xl border-2 border-[#0478CA]/30 bg-[#0478CA]/5">
          <p className="font-bold text-[#0F2053]">Programar as duas folgas da semana (5x2)</p>
          <p className="text-sm text-slate-600">Marque os dois dias de folga. Os outros cinco usam o horário do primeiro dia de trabalho da tabela.</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Dias de folga">
            {ordemDias.map((dow) => (
              <button
                key={dow}
                type="button"
                aria-pressed={folgasEscolhidas.includes(dow)}
                onClick={() => alternarFolga(dow)}
                className={`w-14 py-2 rounded-lg border-2 text-sm font-bold cursor-pointer ${folgasEscolhidas.includes(dow) ? 'bg-[#0478CA] border-[#0478CA] text-white' : 'bg-white border-slate-300 text-[#0F2053] hover:border-[#0478CA]'}`}
              >
                {DIAS_CURTOS[dow]}
              </button>
            ))}
            <button
              type="button"
              disabled={folgasEscolhidas.length !== 2}
              onClick={() => setSemana((s) => programarFolgas(s, folgasEscolhidas))}
              className="px-4 py-2 rounded-lg bg-[#0F2053] text-white font-bold disabled:opacity-40 cursor-pointer"
            >
              Programar as duas folgas
            </button>
          </div>
          {folgasEscolhidas.length !== 2 && <p className="mt-1 text-xs text-slate-600">Escolha dois dias.</p>}
        </div>

        <div className="mt-4 overflow-auto border border-slate-200 rounded-xl">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="p-2 font-semibold">Dia</th>
                <th className="p-2 font-semibold">Trabalha</th>
                <th className="p-2 font-semibold">Entrada</th>
                <th className="p-2 font-semibold">Saída para o intervalo</th>
                <th className="p-2 font-semibold">Volta do intervalo</th>
                <th className="p-2 font-semibold">Saída</th>
                <th className="p-2 font-semibold text-right">Horas</th>
              </tr>
            </thead>
            <tbody>
              {ordemDias.map((dow) => {
                const d = semana[dow];
                const c = d.trabalha ? calcularDia(d) : null;
                return (
                  <tr key={dow} className="border-t border-slate-100">
                    <td className="p-2 font-semibold text-[#0F2053] whitespace-nowrap">{DIAS[dow]}</td>
                    <td className="p-2">
                      <input
                        id={`hora-trabalha-${dow}`}
                        type="checkbox"
                        aria-label={`Trabalha na ${DIAS[dow]}`}
                        checked={d.trabalha}
                        onChange={(e) => mudarDiaModelo(dow, 'trabalha', e.target.checked)}
                        className="w-4 h-4"
                      />
                    </td>
                    {(['entrada', 'intervaloInicio', 'intervaloFim', 'saida'] as const).map((k) => (
                      <td key={k} className="p-2">
                        <input
                          id={`hora-${k}-${dow}`}
                          type="time"
                          aria-label={`${k} na ${DIAS[dow]}`}
                          value={d[k]}
                          disabled={!d.trabalha}
                          onChange={(e) => mudarDiaModelo(dow, k, e.target.value)}
                          className={campo}
                        />
                      </td>
                    ))}
                    <td className="p-2 text-right tabular-nums font-semibold">{c ? horas(c.computados) : 'folga'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Deixe o intervalo em branco se não houver. Horário que passa da meia-noite (ex.: 22h às 6h) é aceito; a hora noturna conta 52min30s.
        </p>
      </section>

      {/* Resultado */}
      {a && (
        <section
          aria-labelledby="h-resultado"
          className={`p-5 sm:p-6 rounded-2xl bg-white border-2 ${a.resumo.dentro ? 'border-[#128C4A]' : 'border-red-600'}`}
        >
          <h2 id="h-resultado" className={`text-xl sm:text-2xl font-bold ${a.resumo.dentro ? 'text-[#128C4A]' : 'text-red-700'}`}>
            {a.resumo.dentro ? `Dentro da regra de ${regime} horas` : `Fora da regra de ${regime} horas`}
          </h2>
          <p className="mt-1 text-[15px] text-slate-700">
            {dataBR(inicio)} a {dataBR(fim)} · {a.resumo.erros} {a.resumo.erros === 1 ? 'problema' : 'problemas'} e {a.resumo.atencao}{' '}
            {a.resumo.atencao === 1 ? 'ponto' : 'pontos'} de atenção
            {ajustados > 0 && ` · ${ajustados} ${ajustados === 1 ? 'dia ajustado' : 'dias ajustados'} à mão`}
          </p>

          <ul className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3" aria-label="Comparativo entre as regras">
            {comparativo.map((c: any) => (
              <li key={c.regime} className={`p-4 rounded-xl border-2 ${c.regime === regime ? 'border-[#0F2053]' : 'border-slate-200'} bg-[#F4F7FB]`}>
                <p className="text-sm text-slate-600">Regra de {c.regime} horas</p>
                <p className={`text-lg font-bold ${c.dentro ? 'text-[#128C4A]' : 'text-red-700'}`}>{c.dentro ? '✓ Cabe' : '✗ Não cabe'}</p>
                <p className="text-xs text-slate-600">
                  {c.erros} {c.erros === 1 ? 'problema' : 'problemas'}
                  {c.excesso > 0 && ` · ${horas(c.excesso)} acima do limite`}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              ['Dias de trabalho', String(a.resumo.diasTrabalhados)],
              ['Folgas e feriados', String(a.resumo.folgas)],
              ['Horas no período', horas(a.resumo.totalComputado)],
              ['Média por semana', a.resumo.mediaSemanal == null ? '—' : horas(a.resumo.mediaSemanal)],
              ['Acima do limite', horas(a.resumo.excesso)],
            ].map(([k, v]) => (
              <div key={k} className="p-3 rounded-xl border border-slate-200">
                <p className="text-sm text-slate-600">{k}</p>
                <p className="text-xl font-bold tabular-nums text-[#0F2053]">{v}</p>
              </div>
            ))}
          </div>
          {a.resumo.noturnos > 0 && (
            <p className="mt-2 text-sm text-slate-600">
              {horas(a.resumo.noturnos)} de trabalho entre 22h e 5h: hora de 52min30s e adicional noturno de pelo menos 20%.
            </p>
          )}

          {porRegra.length > 0 && (
            <div className="mt-5">
              <h3 className="font-bold text-[#0F2053]">O que precisa de ajuste</h3>
              <div className="mt-2 space-y-2">
                {porRegra.map(([regra, itens]) => (
                  <details key={regra} className="rounded-xl border border-slate-200 bg-white" open={itens[0].nivel === 'erro' && itens.length <= 6}>
                    <summary className="cursor-pointer px-4 py-3 flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${itens[0].nivel === 'erro' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'}`}
                      >
                        {itens[0].nivel === 'erro' ? 'Problema' : 'Atenção'}
                      </span>
                      <span className="font-bold text-[#0F2053]">{regra}</span>
                      <span className="text-sm text-slate-600">
                        {itens.length} {itens.length === 1 ? 'vez' : 'vezes'} · {itens[0].base}
                      </span>
                    </summary>
                    <ul className="px-4 pb-3 space-y-1 text-sm text-slate-700 list-disc pl-8">
                      {itens.slice(0, 40).map((p: any, i: number) => (
                        <li key={i}>{p.texto}</li>
                      ))}
                      {itens.length > 40 && <li>Mais {itens.length - 40} no PDF e no Excel.</li>}
                    </ul>
                  </details>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => baixarXlsx(nomeArquivo('xlsx'), abasEscala(a, { inicio, fim }) as never)}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[#1D6F42] hover:bg-[#185C37] text-white font-bold cursor-pointer"
            >
              <Icon name="sheet" className="w-5 h-5" /> Baixar Excel da escala
            </button>
            <button
              type="button"
              onClick={baixarPdf}
              disabled={!!gerando}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[#0478CA] hover:bg-[#03609F] text-white font-bold cursor-pointer disabled:opacity-50"
            >
              <Icon name="doc" className="w-5 h-5" /> Baixar PDF da escala
            </button>
            {ajustados > 0 && (
              <button
                type="button"
                onClick={() => setAjustes({})}
                className="px-4 py-3 rounded-xl border-2 border-slate-300 font-bold text-[#0F2053] cursor-pointer"
              >
                Desfazer os ajustes dos dias
              </button>
            )}
            {gerando && (
              <span className="text-sm text-slate-600" aria-live="polite">
                {gerando}
              </span>
            )}
          </div>
        </section>
      )}

      {/* Escala dia a dia */}
      {a && (
        <section className={card} aria-labelledby="h-escala">
          <h2 id="h-escala" className="text-lg font-bold text-[#0F2053]">
            Escala dia a dia
          </h2>
          <p className="mt-1 text-sm text-slate-600">Mude qualquer dia: troque trabalho por folga ou ajuste os horários. A conferência acompanha na hora.</p>
          <div className="mt-3 overflow-auto max-h-[75vh] border border-slate-200 rounded-xl">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="p-2 font-semibold">Data</th>
                  <th className="p-2 font-semibold">Situação</th>
                  <th className="p-2 font-semibold">Entrada</th>
                  <th className="p-2 font-semibold">Saída intervalo</th>
                  <th className="p-2 font-semibold">Volta</th>
                  <th className="p-2 font-semibold">Saída</th>
                  <th className="p-2 font-semibold text-right">Horas</th>
                  <th className="p-2 font-semibold">Alertas</th>
                </tr>
              </thead>
              {semanasTabela.map((s: any) => (
                <tbody key={s.inicio}>
                  <tr className="bg-[#F4F7FB] border-t-2 border-slate-200">
                    <td colSpan={8} className="p-2">
                      <span className="font-bold text-[#0F2053]">
                        Semana de {dataBR(s.inicio).slice(0, 5)} a {dataBR(s.fim).slice(0, 5)}
                      </span>
                      <span className={`ml-3 font-semibold tabular-nums ${s.excesso > 0 ? 'text-red-700' : 'text-slate-700'}`}>
                        {horas(s.computados)} de {regime}h
                      </span>
                      <span className="ml-3 text-slate-700">
                        {s.folgas} {s.folgas === 1 ? 'folga' : 'folgas'}
                      </span>
                      <span
                        className={`ml-3 px-2 py-0.5 rounded-full text-xs font-bold ${!s.completa ? 'bg-slate-200 text-slate-700' : s.problemas ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}
                      >
                        {!s.completa ? 'incompleta no período' : s.problemas ? `${s.problemas} a ver` : 'ok'}
                      </span>
                    </td>
                  </tr>
                  {s.linhas.map((d: any) => (
                    <tr key={d.data} className={`border-t border-slate-100 ${ajustes[d.data] ? 'bg-amber-50/60' : ''}`}>
                      <td className="p-2 whitespace-nowrap">
                        <span className="font-semibold text-[#0F2053]">{dataBR(d.data).slice(0, 5)}</span> <span className="text-slate-600">{DIAS[d.dow]}</span>
                        {d.feriado && <span className="block text-xs font-semibold text-[#0478CA]">{d.feriado}</span>}
                      </td>
                      <td className="p-2">
                        <select
                          id={`hora-dia-${d.data}`}
                          aria-label={`Situação em ${dataBR(d.data)}`}
                          value={d.tipo}
                          onChange={(e) => ajustar(d.data, 'tipo', e.target.value)}
                          className={campo}
                        >
                          <option value="trabalho">Trabalho</option>
                          <option value="folga">Folga</option>
                          {d.feriado && <option value="feriado">Feriado (folga)</option>}
                        </select>
                      </td>
                      {(['entrada', 'intervaloInicio', 'intervaloFim', 'saida'] as const).map((k) => (
                        <td key={k} className="p-2">
                          <input
                            id={`hora-${k}-${d.data}`}
                            type="time"
                            aria-label={`${k} em ${dataBR(d.data)}`}
                            value={d[k] || ''}
                            disabled={!d.trabalha}
                            onChange={(e) => ajustar(d.data, k, e.target.value)}
                            className={campo}
                          />
                        </td>
                      ))}
                      <td className="p-2 text-right tabular-nums font-semibold">{d.trabalha ? horas(d.computados) : ''}</td>
                      <td className="p-2 text-xs text-red-700">{d.alertas.join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </section>
      )}

      {/* Legislação */}
      <section className={card} aria-labelledby="h-lei">
        <h2 id="h-lei" className="text-lg font-bold text-[#0F2053]">
          O que diz a lei
        </h2>
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {LEGISLACAO.map((g) => (
            <div key={g.titulo} className="min-w-0">
              <h3 className="font-bold text-[#0F2053]">{g.titulo}</h3>
              <ul className="mt-2 space-y-1.5 list-disc pl-5 text-[15px] text-slate-700">
                {g.itens.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-500">
          A conferência é automática e parte da escala informada. Ela não substitui a leitura do contrato, da convenção ou do acordo coletivo da categoria.
        </p>
      </section>
    </div>
  );
}
