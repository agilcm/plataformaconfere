// /dados/ › Hora: monta a escala de trabalho de um período (com as duas folgas semanais do 5x2) e diz se ela cabe na
// regra de 40, 42 ou 44 horas, com a base legal de cada ponto. As regras ficam em lib/jornada.js.
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/ui.tsx';
import {
  DIAS,
  DIAS_CURTOS,
  FACULTATIVOS,
  LEGISLACAO,
  LIMITE_DIAS,
  MESES_CURTOS,
  REGIMES,
  abasEscala,
  avaliarEscala,
  blocosEscala,
  calcularDia,
  compararRegimes,
  dataBR,
  feriadosDoPeriodo,
  gerarEscala,
  horas,
  mesesDaEscala,
  mudancasDeRegra,
  nomeDoMes,
  programarFolgas,
  regimeDaData,
  semanaPadrao,
} from '../lib/jornada.js';
import { dateText, downloadPdf } from '../lib/pdfReport.ts';
import { baixarXlsx } from '../lib/xlsx.js';

type Regime = 40 | 42 | 44;
type DiaModelo = { dow: number; trabalha: boolean; entrada: string; intervaloInicio: string; intervaloFim: string; saida: string };
type Ajuste = Partial<{ tipo: string; entrada: string; intervaloInicio: string; intervaloFim: string; saida: string }>;
type FeriadoRegra = { regra: string; nome: string };
type DadosFeriados = { fonte: string; cidades: Record<string, [string, string][]>; municipios: string[] };

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
/** Véspera da mesma data n meses depois: 15/01 + 3 meses -> 14/04 */
const maisMeses = (iso: string, n: number) => {
  const [a, m, d] = iso.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m - 1 + n + 1, 0, 12)).getUTCDate();
  return soma(new Date(Date.UTC(a, m - 1 + n, Math.min(d, ultimo), 12)).toISOString().slice(0, 10), -1);
};
const CHAVE = 'agilcm:hora';
const sem = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const mesCurto = (ym: string) => `${MESES_CURTOS[Number(ym.slice(5, 7)) - 1]}/${ym.slice(2, 4)}`;
const diaSemana = (iso: string) => DIAS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
const quantosMeses = (ini: string, fi: string) =>
  (Number(fi.slice(0, 4)) - Number(ini.slice(0, 4))) * 12 + Number(fi.slice(5, 7)) - Number(ini.slice(5, 7)) + 1;
/** Regra do feriado em texto: "todo ano em 22/05", "Páscoa + 60 dias" ou a data */
const quando = (regra: string) =>
  /^\d{2}-\d{2}$/.test(regra)
    ? `todo ano em ${regra.slice(3)}/${regra.slice(0, 2)}`
    : regra === 'P+60'
      ? '60 dias depois da Páscoa (muda todo ano)'
      : regra.startsWith('P')
        ? 'data ligada à Páscoa (muda todo ano)'
        : `só em ${dataBR(regra)}`;

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
  const [modo, setModo] = useState<'meses' | 'datas'>(salvo?.modo ?? 'meses');
  const [inicio, setInicio] = useState<string>(salvo?.inicio ?? `${hojeISO().slice(0, 7)}-01`);
  const [fim, setFim] = useState<string>(salvo?.fim ?? fimDoMes(hojeISO()));
  const [anoMeses, setAnoMeses] = useState<number>(Number((salvo?.inicio ?? hojeISO()).slice(0, 4)));
  const [ancora, setAncora] = useState('');
  const [primeiroDia, setPrimeiroDia] = useState<0 | 1>(salvo?.primeiroDia ?? 1);
  const [semana, setSemana] = useState<DiaModelo[]>(salvo?.semana ?? semanaPadrao());
  const [folgasEscolhidas, setFolgasEscolhidas] = useState<number[]>(salvo?.folgas ?? [6, 0]);
  const [cidade, setCidade] = useState<string>(salvo?.cidade ?? '');
  // feriados incluídos à mão, por cidade (os antigos, sem cidade, ficam na chave '')
  const [doUsuario, setDoUsuario] = useState<Record<string, FeriadoRegra[]>>(
    salvo?.doUsuario ?? (salvo?.locais?.length ? { '': salvo.locais.map((l: any) => ({ regra: l.data, nome: l.nome })) } : {}),
  );
  const [desligados, setDesligados] = useState<Record<string, string[]>>(salvo?.desligados ?? {});
  const [facultativos, setFacultativos] = useState<string[]>(salvo?.facultativos ?? []);
  const [trabFeriados, setTrabFeriados] = useState<boolean>(salvo?.trabFeriados ?? false);
  const [ajustes, setAjustes] = useState<Record<string, Ajuste>>(salvo?.ajustes ?? {});
  const [novoFeriado, setNovoFeriado] = useState({ data: '', nome: '', todoAno: true });
  const [dadosFer, setDadosFer] = useState<DadosFeriados | null>(null);
  const [mesAberto, setMesAberto] = useState('');
  const [gerando, setGerando] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(
        CHAVE,
        JSON.stringify({
          regime,
          modo,
          inicio,
          fim,
          primeiroDia,
          semana,
          folgas: folgasEscolhidas,
          cidade,
          doUsuario,
          desligados,
          facultativos,
          trabFeriados,
          ajustes,
        }),
      );
    } catch {
      /* sem armazenamento: segue sem salvar */
    }
  }, [regime, modo, inicio, fim, primeiroDia, semana, folgasEscolhidas, cidade, doUsuario, desligados, facultativos, trabFeriados, ajustes]);

  // feriados municipais das comarcas de MG (TJMG), carregados uma vez
  useEffect(() => {
    let vivo = true;
    fetch(`${import.meta.env.BASE_URL}dados-hora/feriados-mg.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => vivo && d && setDadosFer(d))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const cidadeOficial = useMemo(() => (cidade.trim() && dadosFer?.municipios.find((m) => sem(m) === sem(cidade))) || '', [dadosFer, cidade]);
  const chaveCidade = cidadeOficial || cidade.trim();
  // a Sexta-feira da Paixão já entra com os nacionais
  const daLista: FeriadoRegra[] = useMemo(
    () => (dadosFer?.cidades[cidadeOficial] || []).filter(([regra]) => regra !== 'P-2').map(([regra, nome]) => ({ regra, nome })),
    [dadosFer, cidadeOficial],
  );
  const desligadosCidade = desligados[chaveCidade] || [];
  const meus = doUsuario[chaveCidade] || [];
  const facultativosLivres = FACULTATIVOS.filter((f) => !f.regras.every((r) => daLista.some((x) => x.regra === r)));

  const erroPeriodo = !inicio || !fim ? 'Informe as duas datas.' : fim < inicio ? 'A data final vem antes da inicial.' : '';
  const feriados = useMemo(() => {
    if (erroPeriodo) return [];
    const municipais = [...daLista.filter((f) => !desligadosCidade.includes(f.regra)), ...meus];
    return feriadosDoPeriodo(inicio, fim, { municipais, facultativos });
  }, [inicio, fim, erroPeriodo, daLista, desligadosCidade, meus, facultativos]);
  const base = useMemo(() => {
    if (erroPeriodo) return [];
    try {
      return gerarEscala({ inicio, fim, semana, feriados, trabalharFeriados: trabFeriados });
    } catch {
      return [];
    }
  }, [inicio, fim, semana, feriados, trabFeriados, erroPeriodo]);
  const dias = useMemo(() => base.map((d: any) => ({ ...d, ...(ajustes[d.data] || {}) })), [base, ajustes]);
  const a = useMemo(() => (dias.length ? avaliarEscala(dias, { regime, primeiroDia }) : null), [dias, regime, primeiroDia]);
  const comparativo = useMemo(() => (dias.length ? compararRegimes(dias, primeiroDia) : []), [dias, primeiroDia]);
  const ajustados = Object.keys(ajustes).filter((d) => d >= inicio && d <= fim).length;
  const ordemDias = primeiroDia === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  const totalModelo = semana.reduce((t, d) => (d.trabalha ? t + calcularDia(d).computados : t), 0);
  const folgasModelo = semana.filter((d) => !d.trabalha).length;
  const regraDaData = regimeDaData(inicio || hojeISO()) as Regime;
  const totalDias = erroPeriodo ? 0 : Math.round((Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / 86400e3) + 1;
  const mudancas = erroPeriodo ? [] : mudancasDeRegra(inicio, fim);

  const clicarMes = (ym: string) => {
    if (ancora) {
      const [x, y] = ancora <= ym ? [ancora, ym] : [ym, ancora];
      setInicio(`${x}-01`);
      setFim(fimDoMes(`${y}-01`));
      setAncora('');
    } else {
      setInicio(`${ym}-01`);
      setFim(fimDoMes(`${ym}-01`));
      setAncora(ym);
    }
  };
  const incluirFeriado = () => {
    if (!novoFeriado.data) return;
    const regra = novoFeriado.todoAno ? novoFeriado.data.slice(5) : novoFeriado.data;
    setDoUsuario((x) => ({
      ...x,
      [chaveCidade]: [...(x[chaveCidade] || []).filter((f) => f.regra !== regra), { regra, nome: novoFeriado.nome.trim() || 'Feriado municipal' }],
    }));
    setNovoFeriado({ data: '', nome: '', todoAno: novoFeriado.todoAno });
  };
  const alternarDaLista = (regra: string) =>
    setDesligados((x) => {
      const atual = x[chaveCidade] || [];
      return { ...x, [chaveCidade]: atual.includes(regra) ? atual.filter((r) => r !== regra) : [...atual, regra] };
    });

  const mudarDiaModelo = (dow: number, campoNome: keyof DiaModelo, valor: any) =>
    setSemana((s) => s.map((d) => (d.dow === dow ? { ...d, [campoNome]: valor } : d)));
  const alternarFolga = (dow: number) => setFolgasEscolhidas((f) => (f.includes(dow) ? f.filter((x) => x !== dow) : f.length >= 2 ? [f[1], dow] : [...f, dow]));
  const ajustar = (data: string, campoNome: keyof Ajuste, valor: string) => setAjustes((x) => ({ ...x, [data]: { ...(x[data] || {}), [campoNome]: valor } }));

  const nomeArquivo = (ext: string) => `escala-${regime}h-${inicio}-a-${fim}.${ext}`;
  const baixarPdf = async () => {
    if (!a) return;
    setGerando('Gerando o PDF…');
    try {
      await downloadPdf(
        nomeArquivo('pdf'),
        `Escala ${regime}h`,
        blocosEscala(a, { inicio, fim, dataText: dateText(), comparativo, primeiroDia, cidade: chaveCidade, feriados }) as never,
      );
    } finally {
      setGerando('');
    }
  };

  // dias agrupados por semana, para a tabela
  const semanasTabela = useMemo(() => {
    if (!a) return [];
    return a.semanas.map((s: any) => ({ ...s, linhas: a.dias.filter((d: any) => d.data >= s.inicio && d.data <= s.fim) }));
  }, [a]);
  const meses = useMemo(() => (a ? mesesDaEscala(a) : []), [a]);
  const iMes = Math.max(
    0,
    meses.findIndex((m: any) => m.mes === mesAberto),
  );
  const mesAtivo: any = meses[iMes];
  const semanasDoMes = mesAtivo
    ? semanasTabela.map((s: any) => ({ ...s, linhas: s.linhas.filter((d: any) => d.data.startsWith(mesAtivo.mes)) })).filter((s: any) => s.linhas.length)
    : [];
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
          Escolha a regra, os meses (ou as datas), a cidade e a semana padrão com as duas folgas. A escala é montada dia a dia, com o dia da semana e os
          feriados nacionais e da cidade, e aparece uma página por mês. Cada dia pode ser ajustado. A conferência segue a EC 141/2026 (5x2, 42h e 40h) e a CLT.
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="h-periodo" className="text-lg font-bold text-[#0F2053]">
            2. Período
          </h2>
          <div className="inline-flex p-1 rounded-xl bg-slate-100" role="group" aria-label="Como escolher o período">
            {(
              [
                ['meses', 'Escolher os meses'],
                ['datas', 'Digitar as datas'],
              ] as const
            ).map(([id, rot]) => (
              <button
                key={id}
                type="button"
                aria-pressed={modo === id}
                onClick={() => {
                  setModo(id);
                  setAncora('');
                  if (id === 'meses') setAnoMeses(Number((inicio || hojeISO()).slice(0, 4)));
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold cursor-pointer ${modo === id ? 'bg-white text-[#0F2053] shadow-sm' : 'text-slate-600 hover:text-[#0F2053]'}`}
              >
                {rot}
              </button>
            ))}
          </div>
        </div>

        {modo === 'meses' ? (
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-label="Ano anterior"
                onClick={() => setAnoMeses((y) => y - 1)}
                className="w-9 h-9 rounded-lg border border-slate-300 bg-white font-bold text-[#0F2053] hover:border-[#0478CA] cursor-pointer"
              >
                ‹
              </button>
              <span className="min-w-[4rem] text-center text-lg font-bold tabular-nums text-[#0F2053]" aria-live="polite">
                {anoMeses}
              </span>
              <button
                type="button"
                aria-label="Próximo ano"
                onClick={() => setAnoMeses((y) => y + 1)}
                className="w-9 h-9 rounded-lg border border-slate-300 bg-white font-bold text-[#0F2053] hover:border-[#0478CA] cursor-pointer"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => {
                  setInicio(`${anoMeses}-01-01`);
                  setFim(`${anoMeses}-12-31`);
                  setAncora('');
                }}
                className="ml-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-[#0F2053] hover:border-[#0478CA] cursor-pointer"
              >
                Ano inteiro de {anoMeses}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2" role="group" aria-label={`Meses de ${anoMeses}`}>
              {MESES_CURTOS.map((m, i) => {
                const ym = `${anoMeses}-${String(i + 1).padStart(2, '0')}`;
                const marcado = !erroPeriodo && ym >= inicio.slice(0, 7) && ym <= fim.slice(0, 7);
                return (
                  <button
                    key={ym}
                    type="button"
                    aria-pressed={marcado}
                    aria-label={nomeDoMes(ym)}
                    onClick={() => clicarMes(ym)}
                    className={`py-2 rounded-lg border-2 text-sm font-bold capitalize cursor-pointer ${ancora === ym ? 'ring-2 ring-offset-1 ring-[#0478CA]' : ''} ${marcado ? 'bg-[#0F2053] border-[#0F2053] text-white' : 'bg-white border-slate-300 text-[#0F2053] hover:border-[#0478CA]'}`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {ancora
                ? `Começa em ${nomeDoMes(ancora)}. Clique no último mês do período (pode trocar o ano nas setas) ou em outro trabalho.`
                : 'Clique num mês para escolher só ele. Para um período, clique no primeiro mês e depois no último.'}
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
              <label>
                <span className="block text-sm font-semibold text-slate-700 mb-1">Data inicial</span>
                <input id="hora-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={campo} />
                {inicio && <span className="block mt-1 text-xs text-slate-500">{diaSemana(inicio)}</span>}
              </label>
              <label>
                <span className="block text-sm font-semibold text-slate-700 mb-1">Data final</span>
                <input id="hora-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={campo} />
                {fim && <span className="block mt-1 text-xs text-slate-500">{diaSemana(fim)}</span>}
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <span className="self-center font-semibold text-slate-700">Atalhos:</span>
              {[
                ['4 semanas', () => setFim(soma(inicio, 27))],
                ['Mês da data inicial', () => (setInicio(`${inicio.slice(0, 7)}-01`), setFim(fimDoMes(inicio)))],
                ['3 meses', () => setFim(maisMeses(inicio, 3))],
                ['12 meses', () => setFim(maisMeses(inicio, 12))],
              ].map(([rot, fn]) => (
                <button
                  key={rot as string}
                  type="button"
                  disabled={!inicio}
                  onClick={fn as () => void}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-[#0F2053] hover:border-[#0478CA] cursor-pointer disabled:opacity-40"
                >
                  {rot as string}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
          <label className="block">
            <span className="block text-sm font-semibold text-slate-700 mb-1">A semana começa no</span>
            <select id="hora-semana" value={primeiroDia} onChange={(e) => setPrimeiroDia(Number(e.target.value) as 0 | 1)} className={campo}>
              <option value={1}>segunda (segunda a domingo)</option>
              <option value={0}>domingo (domingo a sábado)</option>
            </select>
          </label>
          {!erroPeriodo && (
            <p className="pb-2 text-[15px] text-slate-700" aria-live="polite">
              <strong className="text-[#0F2053]">
                {dataBR(inicio)} a {dataBR(fim)}
              </strong>{' '}
              · {diaSemana(inicio)} a {diaSemana(fim)} ·{' '}
              {inicio.endsWith('-01') && fim === fimDoMes(fim)
                ? `${quantosMeses(inicio, fim)} ${quantosMeses(inicio, fim) === 1 ? 'mês' : 'meses'} · ${totalDias} dias`
                : `${totalDias} dias · ${quantosMeses(inicio, fim) === 1 ? 'dentro de 1 mês' : `passa por ${quantosMeses(inicio, fim)} meses`}`}
            </p>
          )}
        </div>
        {erroPeriodo && <p className="mt-2 text-sm font-semibold text-red-700">{erroPeriodo}</p>}
        {totalDias > LIMITE_DIAS && <p className="mt-2 text-sm font-semibold text-red-700">Escolha um período de até 24 meses.</p>}
        {mudancas.map((m) => (
          <p key={m.data} className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
            Em {dataBR(m.data)} a regra muda de {m.de} para {m.para} horas (EC 141/2026). A conferência usa uma regra só para o período todo: confira a parte
            antes e a parte depois dessa data em separado, ou use a regra de {m.para} horas, que é a mais exigente.
          </p>
        ))}
      </section>

      {/* 3. Cidade e feriados */}
      <section className={card} aria-labelledby="h-cidade">
        <h2 id="h-cidade" className="text-lg font-bold text-[#0F2053]">
          3. Cidade e feriados
        </h2>
        <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="min-w-0">
            <label className="block max-w-md">
              <span className="block text-sm font-semibold text-slate-700 mb-1">Cidade (MG)</span>
              <input
                id="hora-cidade"
                type="text"
                list="hora-cidades-mg"
                autoComplete="off"
                placeholder="Digite o nome da cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                onBlur={() => cidadeOficial && cidadeOficial !== cidade && setCidade(cidadeOficial)}
                className={campo}
              />
              <datalist id="hora-cidades-mg">
                {(dadosFer?.municipios || []).map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </label>
            <p className="mt-2 text-sm text-slate-600">
              {!cidade.trim()
                ? 'Escolha a cidade para incluir os feriados municipais.'
                : !dadosFer
                  ? 'Carregando os feriados municipais…'
                  : daLista.length
                    ? `${cidadeOficial}: feriados municipais da Portaria Conjunta nº 1.798/2026 do TJMG. Desmarque o que não valer e inclua o que faltar.`
                    : cidadeOficial
                      ? `${cidadeOficial} não é sede de comarca e não está na lista do TJMG. Inclua abaixo os feriados da lei municipal: eles ficam guardados para essa cidade.`
                      : 'Cidade fora da lista de municípios de MG. Inclua os feriados abaixo: eles ficam guardados com esse nome.'}
            </p>

            {(daLista.length > 0 || meus.length > 0) && (
              <ul className="mt-3 space-y-1.5" aria-label={`Feriados municipais de ${chaveCidade}`}>
                {daLista.map((f) => (
                  <li key={f.regra}>
                    <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!desligadosCidade.includes(f.regra)}
                        onChange={() => alternarDaLista(f.regra)}
                        className="mt-0.5 w-4 h-4"
                      />
                      <span>
                        <strong className="text-[#0F2053]">{f.nome}</strong> <span className="text-slate-500">· {quando(f.regra)}</span>
                      </span>
                    </label>
                  </li>
                ))}
                {meus.map((f) => (
                  <li key={f.regra} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-0.5 w-4 text-center text-[#0478CA]" aria-hidden="true">
                      ●
                    </span>
                    <span className="flex-1">
                      <strong className="text-[#0F2053]">{f.nome}</strong> <span className="text-slate-500">· {quando(f.regra)} · incluído por você</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Tirar ${f.nome}`}
                      onClick={() => setDoUsuario((x) => ({ ...x, [chaveCidade]: (x[chaveCidade] || []).filter((y) => y.regra !== f.regra) }))}
                      className="px-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 p-3 rounded-xl bg-[#F4F7FB]">
              <p className="text-sm font-semibold text-slate-700">Incluir feriado {chaveCidade ? `de ${chaveCidade}` : 'da cidade'}</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="min-w-0">
                  <span className="sr-only">Data do feriado municipal</span>
                  <input
                    id="hora-feriado-data"
                    type="date"
                    value={novoFeriado.data}
                    onChange={(e) => setNovoFeriado((f) => ({ ...f, data: e.target.value }))}
                    className={campo}
                  />
                </label>
                <label className="min-w-0 flex-1 basis-48">
                  <span className="sr-only">Nome do feriado municipal</span>
                  <input
                    id="hora-feriado-nome"
                    type="text"
                    placeholder="Nome (ex.: aniversário da cidade)"
                    value={novoFeriado.nome}
                    onChange={(e) => setNovoFeriado((f) => ({ ...f, nome: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && incluirFeriado()}
                    className={campo}
                  />
                </label>
                <button
                  type="button"
                  disabled={!novoFeriado.data}
                  onClick={incluirFeriado}
                  className="px-3 py-1.5 rounded-lg bg-[#0F2053] text-white font-bold disabled:opacity-40 cursor-pointer"
                >
                  Incluir
                </button>
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  id="hora-feriado-todo-ano"
                  type="checkbox"
                  checked={novoFeriado.todoAno}
                  onChange={(e) => setNovoFeriado((f) => ({ ...f, todoAno: e.target.checked }))}
                  className="w-4 h-4"
                />
                Repete todo ano nesse dia e mês
              </label>
            </div>
          </div>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-700">
              Feriados no período ({feriados.length}){chaveCidade && ` · ${chaveCidade}`}
            </p>
            {feriados.length === 0 ? (
              <p className="mt-1 text-sm text-slate-600">Nenhum feriado nas datas escolhidas.</p>
            ) : (
              <ul className="mt-2 max-h-80 overflow-auto rounded-xl border border-slate-200 divide-y divide-slate-100" aria-label="Feriados no período">
                {feriados.map((f: any) => (
                  <li key={f.data} className="px-3 py-2 flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-bold tabular-nums text-[#0F2053]">{dataBR(f.data)}</span>
                    <span className="text-slate-500">{diaSemana(f.data)}</span>
                    <span className="flex-1 min-w-[10rem] text-slate-800">{f.nome}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${f.tipo === 'nacional' ? 'bg-[#0F2053]/10 text-[#0F2053]' : f.tipo === 'municipal' ? 'bg-[#0478CA]/10 text-[#03609F]' : 'bg-amber-100 text-amber-900'}`}
                    >
                      {f.tipo === 'nacional' ? 'nacional' : f.tipo === 'municipal' ? 'municipal' : 'ponto facultativo'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {facultativosLivres.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-slate-600">Pontos facultativos (só contam como feriado se a lei da cidade ou a convenção disser):</p>
                <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
                  {facultativosLivres.map((f) => (
                    <label key={f.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        id={`hora-facultativo-${f.id}`}
                        type="checkbox"
                        checked={facultativos.includes(f.id)}
                        onChange={() => setFacultativos((x) => (x.includes(f.id) ? x.filter((y) => y !== f.id) : [...x, f.id]))}
                        className="w-4 h-4"
                      />
                      {f.nome}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <label className="mt-3 flex items-start gap-3 p-3 rounded-xl bg-[#F4F7FB] cursor-pointer">
              <input
                id="hora-trab-feriado"
                type="checkbox"
                checked={trabFeriados}
                onChange={(e) => setTrabFeriados(e.target.checked)}
                className="mt-1 w-4 h-4"
              />
              <span className="text-sm text-slate-700">
                <strong className="text-[#0F2053]">Trabalhar nos feriados</strong>
                <span className="block">
                  Desmarcado, o feriado vira folga. Marcado, segue a semana padrão e o sistema avisa que o dia deve ser pago em dobro ou compensado.
                </span>
              </span>
            </label>
          </div>
        </div>
        {dadosFer && (
          <p className="mt-3 text-xs text-slate-500">
            Feriados municipais: {dadosFer.fonte}. A lista cobre as 298 cidades sede de comarca; confira sempre a lei municipal.
          </p>
        )}
      </section>

      {/* 4. Semana padrão */}
      <section className={card} aria-labelledby="h-semana">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="h-semana" className="text-lg font-bold text-[#0F2053]">
            4. Semana padrão
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
              onClick={() => baixarXlsx(nomeArquivo('xlsx'), abasEscala(a, { inicio, fim, cidade: chaveCidade, feriados }) as never)}
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
            Escala dia a dia · uma página por mês
          </h2>
          <p className="mt-1 text-sm text-slate-600">Mude qualquer dia: troque trabalho por folga ou ajuste os horários. A conferência acompanha na hora.</p>
          {meses.length > 1 && (
            <nav className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Meses da escala">
              <button
                type="button"
                aria-label="Mês anterior"
                disabled={iMes === 0}
                onClick={() => setMesAberto(meses[iMes - 1].mes)}
                className="w-9 h-9 rounded-lg border border-slate-300 bg-white font-bold text-[#0F2053] disabled:opacity-30 cursor-pointer"
              >
                ‹
              </button>
              {meses.map((m: any) => (
                <button
                  key={m.mes}
                  type="button"
                  aria-current={m.mes === mesAtivo.mes ? 'page' : undefined}
                  aria-label={`Ver ${nomeDoMes(m.mes)}${m.alertas ? `, ${m.alertas} dias com alerta` : ''}`}
                  onClick={() => setMesAberto(m.mes)}
                  className={`relative px-2.5 h-9 rounded-lg border text-sm font-bold capitalize cursor-pointer ${m.mes === mesAtivo.mes ? 'bg-[#0F2053] border-[#0F2053] text-white' : 'bg-white border-slate-300 text-[#0F2053] hover:border-[#0478CA]'}`}
                >
                  {mesCurto(m.mes)}
                  {m.alertas > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-600" aria-hidden="true" />}
                </button>
              ))}
              <button
                type="button"
                aria-label="Próximo mês"
                disabled={iMes === meses.length - 1}
                onClick={() => setMesAberto(meses[iMes + 1].mes)}
                className="w-9 h-9 rounded-lg border border-slate-300 bg-white font-bold text-[#0F2053] disabled:opacity-30 cursor-pointer"
              >
                ›
              </button>
            </nav>
          )}
          {mesAtivo && (
            <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <h3 className="text-xl font-bold text-[#0F2053]">{maiuscula(mesAtivo.rotulo)}</h3>
              <p className="text-sm text-slate-700">
                <strong className="tabular-nums">{mesAtivo.trabalhados}</strong> dias de trabalho · <strong className="tabular-nums">{mesAtivo.folgas}</strong>{' '}
                folgas · <strong className="tabular-nums">{mesAtivo.feriados}</strong> {mesAtivo.feriados === 1 ? 'feriado' : 'feriados'} ·{' '}
                <strong className="tabular-nums">{horas(mesAtivo.computados)}</strong> no mês
                {mesAtivo.alertas > 0 && (
                  <span className="text-red-700">
                    {' '}
                    · {mesAtivo.alertas} {mesAtivo.alertas === 1 ? 'dia' : 'dias'} com alerta
                  </span>
                )}
              </p>
              {meses.length > 1 && (
                <p className="text-sm text-slate-500">
                  página {iMes + 1} de {meses.length}
                </p>
              )}
            </div>
          )}
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
              {semanasDoMes.map((s: any) => (
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
