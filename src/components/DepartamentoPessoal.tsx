import { useEffect, useId, useMemo, useState } from 'react';
import { formatBRL, whatsappLink } from '../data/servicesData.ts';
import { downloadPdf, slug } from '../lib/pdfReport.ts';
import { SectionHeader } from './ui.tsx';
import { employeeReport } from '../lib/reports.ts';
import {
  calcLaborCost,
  REGIMES,
  SALARIO_MINIMO_2026,
  type Adicional,
  type LaborInput,
  type Rates,
  type Regime,
} from '../data/laborCost.ts';

interface DepartamentoPessoalProps {
  onContact: (service: string) => void;
}

const inputCls =
  'w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-[#0F2053] tabular-nums focus:outline-none focus:border-[#0478CA]';
const labelCls = 'block text-sm font-semibold text-slate-700 mb-1.5';

// Campo numérico que aceita apagar e redigitar sem pular para zero
function NumField({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
  min = 0,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  hint?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text.replace(',', '.')) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value.replace(',', '.'));
            onChange(Number.isFinite(n) && n >= min ? n : min);
          }}
          className={`${inputCls} ${prefix ? 'pl-9' : ''} ${suffix ? 'pr-10' : ''}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-sm text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

export default function DepartamentoPessoal({ onContact }: DepartamentoPessoalProps) {
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;

  const [regime, setRegime] = useState<Regime>('presumido');
  const [rates, setRates] = useState<Rates>(REGIMES[0].rates);
  const [salario, setSalario] = useState(3000);
  const [adicional, setAdicional] = useState<Adicional>('nenhum');
  const [outrosAdicionais, setOutrosAdicionais] = useState(0);
  const [jornadaMensal, setJornadaMensal] = useState(220);
  const [he1Horas, setHe1Horas] = useState(0);
  const [he1Perc, setHe1Perc] = useState(50);
  const [he2Horas, setHe2Horas] = useState(0);
  const [he2Perc, setHe2Perc] = useState(100);
  const [noturnoHoras, setNoturnoHoras] = useState(0);
  const [diasUteis, setDiasUteis] = useState(26);
  const [domingosFeriados, setDomingosFeriados] = useState(4);
  const [valeTransporte, setValeTransporte] = useState(0);
  const [valeAlimentacao, setValeAlimentacao] = useState(0);
  const [planoSaude, setPlanoSaude] = useState(0);
  const [outrosBeneficios, setOutrosBeneficios] = useState(0);
  const [provisionarMulta, setProvisionarMulta] = useState(true);
  const [empresa, setEmpresa] = useState('');
  const [cargo, setCargo] = useState('');
  const [exportState, setExportState] = useState<'idle' | 'busy' | 'done' | 'declined' | 'error'>('idle');

  const regimeInfo = REGIMES.find((r) => r.id === regime)!;

  const selectRegime = (r: Regime) => {
    setRegime(r);
    setRates(REGIMES.find((x) => x.id === r)!.rates);
  };

  const laborInput: LaborInput = useMemo(
    () => ({
      regime,
      rates,
      salario,
      adicional,
      outrosAdicionais,
      jornadaMensal,
      he1Horas,
      he1Perc,
      he2Horas,
      he2Perc,
      noturnoHoras,
      diasUteis,
      domingosFeriados,
      valeTransporte,
      valeAlimentacao,
      planoSaude,
      outrosBeneficios,
      provisionarMulta,
    }),
    [regime, rates, salario, adicional, outrosAdicionais, jornadaMensal, he1Horas, he1Perc, he2Horas, he2Perc, noturnoHoras, diasUteis, domingosFeriados, valeTransporte, valeAlimentacao, planoSaude, outrosBeneficios, provisionarMulta],
  );

  const result = useMemo(() => calcLaborCost(laborInput), [laborInput]);

  const handleExport = async () => {
    setExportState('busy');
    try {
      const nome = ['custo-funcionario', cargo, empresa].filter((x) => x.trim()).map(slug).join('-');
      const r = await downloadPdf(
        `${nome}.pdf`,
        'Relatório de Custo de Funcionário',
        employeeReport(laborInput, result, { empresa: empresa.trim(), cargo: cargo.trim() }),
      );
      setExportState(r === 'declined' ? 'declined' : 'done');
    } catch (err) {
      console.error('Falha ao gerar PDF', err);
      setExportState('error');
    }
  };

  const ratesChanged = JSON.stringify(rates) !== JSON.stringify(regimeInfo.rates);
  const fixPct = result.totalMensal > 0 ? (result.totalFixos / result.totalMensal) * 100 : 0;
  const fmt2 = (n: number) => formatBRL(n, 2);

  const summary =
    `Olá! Fiz a simulação de custo de funcionário no site da Ágil CM:\n` +
    `Regime: ${regimeInfo.label}\n` +
    `Salário-base: ${fmt2(salario)}\n` +
    `Custos fixos mensais: ${fmt2(result.totalFixos)}\n` +
    `Provisões mensais: ${fmt2(result.totalProvisoes)}\n` +
    `Custo total mensal: ${fmt2(result.totalMensal)}\n\n` +
    `Gostaria de conversar sobre as soluções de Departamento Pessoal.`;

  const setRate = (k: keyof Rates) => (n: number) => setRates((prev) => ({ ...prev, [k]: n }));

  const showSalarioMinWarning = salario > 0 && salario < SALARIO_MINIMO_2026;

  return (
    <section id="simulador-dp" aria-labelledby="titulo-simulador-dp" className="py-16 sm:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          id="titulo-simulador-dp"
          eyebrow="Simulador de Departamento Pessoal"
          title="Quanto custa um funcionário para a sua empresa?"
          lead="Escolha o regime tributário, informe o salário e veja o custo real por mês, com encargos, férias e 13º."
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Inputs */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-8 min-w-0">
            {/* 1. Regime */}
            <fieldset>
              <legend className="text-base font-bold font-display text-[#0F2053] mb-4">1. Regime tributário do empregador</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {REGIMES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={regime === r.id}
                    onClick={() => selectRegime(r.id)}
                    className={`px-3 py-2.5 rounded-lg text-sm font-semibold border transition-colors cursor-pointer text-center ${
                      regime === r.id
                        ? 'bg-[#0478CA] border-[#0478CA] text-white'
                        : 'bg-white border-slate-300 text-slate-700 hover:text-[#0F2053] hover:border-slate-400'
                    }`}
                  >
                    {r.short}
                  </button>
                ))}
              </div>
              <p className="mt-3 p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 leading-relaxed">
                <strong className="text-[#0F2053]">{regimeInfo.label}:</strong> {regimeInfo.note}
                <span className="block mt-1 text-slate-600">
                  Encargos sobre a folha neste regime:{' '}
                  <strong className="text-[#0478CA] tabular-nums">
                    {result.encargosPerc.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%
                  </strong>
                  {regime === 'presumido' || regime === 'real' ? (
                    <> (INSS + RAT + terceiros = {(rates.patronal + rates.rat + rates.terceiros).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%, mais FGTS)</>
                  ) : null}
                </span>
              </p>
            </fieldset>

            {/* 2. Salário */}
            <fieldset className="space-y-4">
              <legend className="text-base font-bold font-display text-[#0F2053] mb-4">2. Salário e adicionais</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NumField id={id('sal')} label="Salário-base" prefix="R$" step={50} value={salario} onChange={setSalario} />
                <div className="min-w-0">
                  <label htmlFor={id('adic')} className={labelCls}>
                    Insalubridade / periculosidade
                  </label>
                  <select
                    id={id('adic')}
                    value={adicional}
                    onChange={(e) => setAdicional(e.target.value as Adicional)}
                    className={inputCls}
                  >
                    <option value="nenhum">Nenhum</option>
                    <option value="insal10">Insalubridade grau mínimo (10%)</option>
                    <option value="insal20">Insalubridade grau médio (20%)</option>
                    <option value="insal40">Insalubridade grau máximo (40%)</option>
                    <option value="peric30">Periculosidade (30% do salário)</option>
                  </select>
                  <p className="text-sm text-slate-500 mt-1">
                    Insalubridade sobre o mínimo de {formatBRL(SALARIO_MINIMO_2026)}. Não acumula com periculosidade.
                  </p>
                </div>
              </div>
              {showSalarioMinWarning && (
                <p role="alert" className="text-sm text-amber-800">
                  O salário informado está abaixo do salário mínimo nacional de {formatBRL(SALARIO_MINIMO_2026)} (jornada integral).
                </p>
              )}
              <NumField
                id={id('outros')}
                label="Gratificações, comissões e outros adicionais fixos"
                prefix="R$"
                step={50}
                value={outrosAdicionais}
                onChange={setOutrosAdicionais}
              />
            </fieldset>

            {/* 3. Jornada */}
            <fieldset className="space-y-4">
              <legend className="text-base font-bold font-display text-[#0F2053] mb-4">3. Horas extras e adicional noturno</legend>
              <div className="grid grid-cols-2 gap-4 items-end">
                <NumField id={id('he1h')} label="Horas extras" suffix="h" value={he1Horas} onChange={setHe1Horas} />
                <NumField id={id('he1p')} label="Adicional" suffix="%" step={5} value={he1Perc} onChange={setHe1Perc} />
                <NumField
                  id={id('he2h')}
                  label="Horas dom./feriados"
                  suffix="h"
                  value={he2Horas}
                  onChange={setHe2Horas}
                />
                <NumField id={id('he2p')} label="Adicional" suffix="%" step={5} value={he2Perc} onChange={setHe2Perc} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NumField
                  id={id('not')}
                  label="Horas noturnas no mês"
                  suffix="h"
                  value={noturnoHoras}
                  onChange={setNoturnoHoras}
                  hint={regime === 'rural' ? 'Adicional noturno rural de 25%' : 'Adicional noturno urbano de 20% (22h às 5h)'}
                />
                <NumField
                  id={id('jor')}
                  label="Jornada mensal (divisor)"
                  suffix="h"
                  value={jornadaMensal}
                  onChange={setJornadaMensal}
                  min={1}
                  hint="220 h para 44 h semanais · 180 h para 36 h"
                />
              </div>
              <details className="group">
                <summary className="cursor-pointer text-sm font-semibold text-[#0478CA] hover:text-[#03609F] list-none [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">+ Ajustar dias para o cálculo do DSR</span>
                  <span className="hidden group-open:inline">− Ocultar dias do DSR</span>
                </summary>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <NumField id={id('du')} label="Dias úteis no mês" value={diasUteis} onChange={setDiasUteis} min={1} />
                  <NumField id={id('df')} label="Domingos e feriados" value={domingosFeriados} onChange={setDomingosFeriados} />
                </div>
              </details>
            </fieldset>

            {/* 4. Benefícios */}
            <fieldset className="space-y-4">
              <legend className="text-base font-bold font-display text-[#0F2053] mb-4">4. Benefícios</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NumField
                  id={id('vt')}
                  label="Vale-transporte (custo total no mês)"
                  prefix="R$"
                  step={10}
                  value={valeTransporte}
                  onChange={setValeTransporte}
                  hint="O empregado arca com até 6% do salário-base"
                />
                <NumField id={id('va')} label="Vale-alimentação / refeição" prefix="R$" step={10} value={valeAlimentacao} onChange={setValeAlimentacao} />
                <NumField id={id('ps')} label="Plano de saúde (parte da empresa)" prefix="R$" step={10} value={planoSaude} onChange={setPlanoSaude} />
                <NumField id={id('ob')} label="Outros benefícios" prefix="R$" step={10} value={outrosBeneficios} onChange={setOutrosBeneficios} />
              </div>
            </fieldset>

            {/* 5. Alíquotas */}
            <details className="group border-t border-slate-200 pt-6">
              <summary className="cursor-pointer flex items-center justify-between gap-3 list-none [&::-webkit-details-marker]:hidden">
                <span className="text-base font-bold font-display text-[#0F2053]">5. Ajustar alíquotas e provisões</span>
                <span className="text-sm font-semibold text-[#0478CA]">
                  {ratesChanged ? 'Alíquotas personalizadas' : 'Padrão do regime'}
                </span>
              </summary>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <NumField id={id('rp')} label={regime === 'mei' ? 'CPP' : 'INSS patronal'} suffix="%" step={0.1} value={rates.patronal} onChange={setRate('patronal')} />
                  <NumField id={id('rr')} label="RAT ajustado (RAT × FAP)" suffix="%" step={0.1} value={rates.rat} onChange={setRate('rat')} />
                  <NumField id={id('rt')} label="Terceiros" suffix="%" step={0.1} value={rates.terceiros} onChange={setRate('terceiros')} />
                  <NumField id={id('rf')} label="FGTS" suffix="%" step={0.1} value={rates.fgts} onChange={setRate('fgts')} hint="2% para menor aprendiz" />
                  {regime === 'domestica' && (
                    <NumField id={id('ri')} label="Indenização compensatória" suffix="%" step={0.1} value={rates.indenizacao} onChange={setRate('indenizacao')} />
                  )}
                </div>
                {ratesChanged && (
                  <button
                    type="button"
                    onClick={() => setRates(regimeInfo.rates)}
                    className="text-sm font-semibold text-slate-700 hover:text-[#0F2053] underline underline-offset-2 cursor-pointer"
                  >
                    Voltar às alíquotas padrão de {regimeInfo.short}
                  </button>
                )}
                {regimeInfo.multaFgts && (
                  <label className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer">
                    <span>
                      <span className="block text-sm font-semibold text-[#0F2053]">Provisionar multa de 40% do FGTS</span>
                      <span className="block text-sm text-slate-600">Reserva mensal para uma eventual dispensa sem justa causa</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={provisionarMulta}
                      onChange={(e) => setProvisionarMulta(e.target.checked)}
                      className="w-5 h-5 shrink-0 accent-[#0478CA] cursor-pointer"
                    />
                  </label>
                )}
              </div>
            </details>
          </div>

          {/* Results */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 min-w-0">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="text-sm text-slate-600">Custo total mensal do funcionário</div>
              <div className="text-4xl sm:text-5xl font-bold font-display text-[#0F2053] mt-1 tabular-nums" aria-live="polite">
                {fmt2(result.totalMensal)}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                <span>
                  Por ano: <strong className="text-[#0F2053] tabular-nums">{fmt2(result.totalAnual)}</strong>
                </span>
                <span>
                  <strong className="text-[#0478CA] tabular-nums">
                    {result.fatorSobreSalario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×
                  </strong>{' '}
                  o salário-base
                </span>
              </div>

              {/* Proporção fixo × provisionado */}
              <div className="mt-5">
                <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100" aria-hidden="true">
                  <div className="bg-[#0478CA]" style={{ width: `${fixPct}%` }} />
                  <div className="bg-sky-400" style={{ width: `${100 - fixPct}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-sm text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#0478CA]" aria-hidden="true"></span>
                    Fixos {fixPct.toFixed(0)}%
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-400" aria-hidden="true"></span>
                    Provisionados {(100 - fixPct).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Fixos */}
              <div className="mt-6">
                <h3 className="flex items-baseline justify-between gap-3 text-sm font-bold text-[#0F2053] border-b border-slate-200 pb-2">
                  <span>Custos fixos mensais</span>
                  <span className="text-[#0478CA] tabular-nums">{fmt2(result.totalFixos)}</span>
                </h3>
                <p className="text-sm text-slate-500 mt-1 mb-2">Saem do caixa todo mês</p>
                <dl className="space-y-1.5 text-sm">
                  {result.fixos.map((l) => (
                    <div key={l.label} className="flex justify-between gap-3 text-slate-700">
                      <dt className="min-w-0">{l.label}</dt>
                      <dd className="font-mono text-[#0F2053] tabular-nums whitespace-nowrap">{fmt2(l.value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Provisões */}
              <div className="mt-6">
                <h3 className="flex items-baseline justify-between gap-3 text-sm font-bold text-[#0F2053] border-b border-slate-200 pb-2">
                  <span>Custos mensais provisionados</span>
                  <span className="text-[#0478CA] tabular-nums">{fmt2(result.totalProvisoes)}</span>
                </h3>
                <p className="text-sm text-slate-500 mt-1 mb-2">Reserve todo mês para pagar férias, 13º e rescisão</p>
                <dl className="space-y-1.5 text-sm">
                  {result.provisoes.map((l) => (
                    <div key={l.label} className="flex justify-between gap-3 text-slate-700">
                      <dt className="min-w-0">{l.label}</dt>
                      <dd className="font-mono text-[#0F2053] tabular-nums whitespace-nowrap">{fmt2(l.value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <p className="mt-5 text-sm text-slate-500 leading-relaxed">
                Estimativa referencial. Não inclui convenção coletiva, aviso prévio, afastamentos ou desoneração da folha. Os
                descontos do empregado (INSS e IRRF) saem do salário e não aumentam o custo da empresa.
              </p>

              <div className="mt-6 pt-5 border-t border-slate-200">
                <div className="text-sm font-semibold text-slate-700 mb-2">Relatório em PDF no layout da Ágil CM</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    id={id('emp')}
                    aria-label="Empresa (opcional)"
                    placeholder="Empresa (opcional)"
                    value={empresa}
                    onChange={(e) => setEmpresa(e.target.value)}
                    className={inputCls}
                  />
                  <input
                    id={id('cargo')}
                    aria-label="Cargo ou funcionário (opcional)"
                    placeholder="Cargo / funcionário (opcional)"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exportState === 'busy'}
                  className="mt-2 w-full py-2.5 px-4 bg-[#0F2053] hover:bg-[#1a2f6e] disabled:opacity-60 text-white font-bold text-sm rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
                  </svg>
                  {exportState === 'busy' ? 'Gerando relatório…' : 'Exportar relatório do funcionário (PDF)'}
                </button>
                {exportState === 'done' && (
                  <p role="status" className="mt-2 text-sm text-emerald-800">Relatório gerado. Confira a pasta de downloads.</p>
                )}
                {exportState === 'declined' && (
                  <p role="status" className="mt-2 text-sm text-slate-600">Download cancelado. Clique novamente quando quiser salvar.</p>
                )}
                {exportState === 'error' && (
                  <p role="alert" className="mt-2 text-sm text-amber-800">
                    Não foi possível gerar o arquivo neste navegador. Tente novamente ou fale conosco pelo WhatsApp.
                  </p>
                )}
              </div>

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => onContact('Folha de Pagamento & DP')}
                  className="w-full py-3 px-4 bg-[#0478CA] hover:bg-[#03609F] text-white font-bold text-sm rounded-lg transition-colors cursor-pointer"
                >
                  Quero terceirizar meu Departamento Pessoal
                </button>
                <a
                  href={whatsappLink(summary)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-[#0F2053] font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 border border-slate-300"
                >
                  Enviar esta simulação pelo WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
