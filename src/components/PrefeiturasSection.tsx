import { useId, useState } from 'react';
import { CONSULTING_SERVICES, CONSULTING_TO_CONTACT, formatBRL } from '../data/servicesData.ts';
import { Container, Icon } from './ui.tsx';

interface Props {
  onContact: (service?: string) => void;
}

const ICONS: Record<string, string> = {
  'readequacao-gilrat': 'chart',
  'reparcelamento-previdenciario': 'bank',
  'gestao-rh-compliance': 'shield',
};

const STEPS = [
  { title: 'Reunião com a gestão', text: 'Entendemos a realidade do município com prefeito e secretários.' },
  { title: 'Coleta de dados', text: 'Folha, guias do INSS, parcelamentos e certidões.' },
  { title: 'Estudo e parecer', text: 'Análise técnica e jurídica com riscos e resultado esperado.' },
  { title: 'Implantação', text: 'Executamos a solução e acompanhamos mês a mês.' },
];

const ALSO = [
  { icon: 'building', text: 'Limpeza e portaria de prédios públicos' },
  { icon: 'tree', text: 'Capina, roçada e jardinagem urbana' },
  { icon: 'box', text: 'Merenda, material escolar e suprimentos' },
];

// Deixa só a primeira letra maiúscula (mantém siglas como GILRAT, INSS, RH)
const sentence = (t: string) =>
  t
    .split(' ')
    .map((w, i) => (i === 0 || /^[A-ZÁÉÍÓÚ]{2,}$/.test(w) ? w : w.toLowerCase()))
    .join(' ');

// Média observada: a readequação recupera cerca de 1,5% da folha por mês (estimativa, sem garantia)
const TAXA_RECUPERACAO = 0.015;
const MESES_RETROATIVO = 60; // 5 anos (prazo de prescrição)
const FOLHA_MIN = 50000;
const FOLHA_MAX = 5000000;
const PREPONDERANCE_THRESHOLD = 33;

export default function PrefeiturasSection({ onContact }: Props) {
  const folhaId = useId();
  const educId = useId();
  const [folhaMensal, setFolhaMensal] = useState(300000);
  const [folhaTexto, setFolhaTexto] = useState('300.000');
  const [percEducacao, setPercEducacao] = useState(38);
  const elegivel = percEducacao >= PREPONDERANCE_THRESHOLD;
  const economiaMensal = Math.round(folhaMensal * TAXA_RECUPERACAO);
  const economia60 = economiaMensal * MESES_RETROATIVO;
  const folhas = economia60 / folhaMensal;
  const definirFolha = (v: number) => {
    const n = Math.min(FOLHA_MAX, Math.max(FOLHA_MIN, Math.round(v) || FOLHA_MIN));
    setFolhaMensal(n);
    setFolhaTexto(n.toLocaleString('pt-BR'));
  };

  const servicos = CONSULTING_SERVICES.filter((s) => s.audience === 'publico');

  return (
    <section
      id="prefeituras"
      aria-labelledby="titulo-prefeituras"
      className="relative py-16 sm:py-24 bg-gradient-to-br from-[#0F2053] via-[#13306f] to-[#0A1640] text-white overflow-hidden"
    >
      <div aria-hidden="true" className="absolute -top-40 -left-40 w-[32rem] h-[32rem] rounded-full bg-[#0478CA]/30 blur-3xl" />
      <div aria-hidden="true" className="absolute bottom-0 right-0 w-[26rem] h-[26rem] rounded-full bg-[#0478CA]/20 blur-3xl" />

      <Container className="relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end mb-12">
          <header className="lg:col-span-7">
            <p className="text-sm font-bold text-[#9fd3ff] mb-2">Para prefeituras e órgãos públicos</p>
            <h2 id="titulo-prefeituras" className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display tracking-tight [text-wrap:balance]">
              Mais fôlego para o caixa do município
            </h2>
            <p className="mt-4 text-lg text-white/85 leading-relaxed max-w-2xl">
              Estudos tributários, reparcelamento de dívidas e gestão de RH para prefeituras investirem mais em saúde, educação e
              obras.
            </p>
          </header>
          <blockquote className="lg:col-span-5 p-6 rounded-2xl bg-white/10 border border-white/15 backdrop-blur">
            <p className="text-xl font-display font-semibold leading-snug">
              “Um RH eficiente protege o orçamento público e financia o futuro do município.”
            </p>
            <footer className="mt-3 text-sm text-white/70">Ágil CM Soluções Integradas</footer>
          </blockquote>
        </div>

        {/* Serviços */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {servicos.map((s) => (
            <article key={s.id} className="flex flex-col p-6 rounded-2xl bg-white text-slate-800 shadow-xl shadow-black/10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0478CA] to-[#0F2053] text-white flex items-center justify-center">
                <Icon name={ICONS[s.id] ?? 'check'} className="w-7 h-7" />
              </div>
              <span className="mt-4 self-start px-2.5 py-1 rounded-full bg-[#0478CA]/10 text-[#0478CA] text-sm font-bold">{s.highlight}</span>
              <h3 className="mt-3 text-xl font-bold font-display text-[#0F2053]">{s.title}</h3>
              <p className="mt-2 text-base text-slate-600 leading-relaxed">{s.shortDescription}</p>
              <ul className="mt-4 space-y-2 flex-1">
                {s.benefits.slice(0, 3).map((b) => (
                  <li key={b.title} className="flex items-start gap-2 text-[15px]">
                    <Icon name="check" className="w-5 h-5 mt-0.5 text-[#0478CA] shrink-0" />
                    {sentence(b.title)}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => onContact(CONSULTING_TO_CONTACT[s.id])}
                className="mt-6 inline-flex items-center justify-center gap-2 w-full px-5 py-3 text-base font-bold text-white bg-[#0478CA] hover:bg-[#03609F] rounded-xl transition-colors cursor-pointer"
              >
                Falar sobre o meu município
              </button>
            </article>
          ))}
        </div>

        {/* Como trabalhamos */}
        <div className="mt-14">
          <h3 className="text-2xl font-bold font-display">Como trabalhamos com o município</h3>
          <ol className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((st, i) => (
              <li key={st.title} className="relative p-5 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-4xl font-bold font-display text-[#9fd3ff]/60">{String(i + 1).padStart(2, '0')}</span>
                <h4 className="mt-2 text-lg font-bold">{st.title}</h4>
                <p className="mt-1 text-base text-white/80 leading-relaxed">{st.text}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Simulador GILRAT */}
        <div id="simulador-gilrat" className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 sm:p-8 rounded-3xl bg-white text-slate-800">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0478CA]/10 text-[#0478CA] text-sm font-bold">
              <Icon name="calc" className="w-4 h-4" />
              Simulador
            </span>
            <h3 className="mt-3 text-2xl font-bold font-display text-[#0F2053]">Quanto o seu município pode economizar no GILRAT?</h3>
            <p className="mt-2 text-base text-slate-600 leading-relaxed">
              Quando a Educação pesa muito na folha, o GILRAT pode ser readequado. Em média, isso recupera cerca de{' '}
              <strong>1,5% da folha por mês</strong>. A confirmação vem com o estudo técnico.
            </p>
            <div className="mt-6">
              <div className="flex flex-wrap justify-between gap-2 mb-2">
                <label htmlFor={folhaId} className="text-base font-semibold text-slate-800">
                  Folha mensal do município
                </label>
                <span className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Valor da folha mensal em reais"
                    value={folhaTexto}
                    onChange={(e) => {
                      const dig = e.target.value.replace(/\D/g, '').slice(0, 8);
                      setFolhaTexto(dig ? Number(dig).toLocaleString('pt-BR') : '');
                      const n = Number(dig);
                      if (n >= FOLHA_MIN && n <= FOLHA_MAX) setFolhaMensal(n);
                    }}
                    onBlur={() => definirFolha(Number(folhaTexto.replace(/\D/g, '')))}
                    className="w-40 pl-10 pr-3 py-1.5 rounded-lg border border-slate-300 text-right text-base font-bold text-[#0478CA] tabular-nums focus:outline-none focus:border-[#0478CA] focus:ring-2 focus:ring-[#0478CA]/20"
                  />
                </span>
              </div>
              <input
                id={folhaId}
                type="range"
                min={FOLHA_MIN}
                max={FOLHA_MAX}
                step={10000}
                value={folhaMensal}
                aria-valuetext={formatBRL(folhaMensal)}
                onChange={(e) => definirFolha(Number(e.target.value))}
                className="w-full accent-[#0478CA] cursor-pointer"
              />
              <div className="mt-1 flex justify-between text-sm text-slate-500">
                <span>R$ 50 mil</span>
                <span>R$ 5 milhões</span>
              </div>
            </div>
            <div className="mt-5">
              <div className="flex flex-wrap justify-between gap-2 mb-2">
                <label htmlFor={educId} className="text-base font-semibold text-slate-800">
                  Peso da Educação na folha
                </label>
                <span className={`text-base font-bold tabular-nums ${elegivel ? 'text-[#0478CA]' : 'text-amber-700'}`}>{percEducacao}%</span>
              </div>
              <input
                id={educId}
                type="range"
                min={20}
                max={60}
                step={1}
                value={percEducacao}
                onChange={(e) => setPercEducacao(Number(e.target.value))}
                className="w-full accent-[#0478CA] cursor-pointer"
              />
              {!elegivel && (
                <p role="status" className="mt-3 text-[15px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Com esse percentual o enquadramento é menos provável, mas o estudo pode avaliar outras atividades.
                </p>
              )}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl bg-gradient-to-br from-[#0478CA] to-[#0F2053] text-white p-6 flex flex-col">
            <p className="text-base text-white/85">Recuperação estimada por mês (1,5% da folha)</p>
            <p className={`text-4xl sm:text-5xl font-bold font-display tabular-nums mt-1 ${elegivel ? '' : 'opacity-60'}`} aria-live="polite">
              {formatBRL(economiaMensal)}
            </p>
            <dl className="mt-5 space-y-2 text-base">
              <div className="flex justify-between gap-4">
                <dt className="text-white/85">Em 12 meses</dt>
                <dd className="font-bold tabular-nums">{formatBRL(economiaMensal * 12)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-white/85">Em 60 meses (5 anos)</dt>
                <dd className="font-bold tabular-nums">{formatBRL(economia60)}</dd>
              </div>
            </dl>
            <div className="mt-5 p-4 rounded-xl bg-white/10">
              <p className="text-base">
                Equivale a <strong className="text-2xl font-display tabular-nums">{folhas.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</strong>{' '}
                {folhas >= 0.995 && folhas < 1.005 ? 'folha mensal' : 'da folha mensal'} do município
              </p>
              <div className="mt-3 h-3 rounded-full bg-white/20 overflow-hidden" aria-hidden="true">
                <div className="h-full rounded-full bg-[#9fd3ff]" style={{ width: `${Math.min(100, folhas * 100)}%` }} />
              </div>
              <p className="mt-1 text-sm text-white/75">{Math.round(folhas * 100)}% de uma folha inteira paga de volta</p>
            </div>
            <details className="mt-4 text-sm text-white/85">
              <summary className="cursor-pointer font-bold text-white">Como calculamos</summary>
              <ol className="mt-2 space-y-1 list-decimal pl-5 tabular-nums">
                <li>
                  Folha mensal × 1,5% = {formatBRL(folhaMensal)} × 1,5% = <strong>{formatBRL(economiaMensal)}</strong> por mês
                </li>
                <li>
                  × 60 meses (5 anos, prazo para recuperar) = <strong>{formatBRL(economia60)}</strong>
                </li>
                <li>
                  {formatBRL(economia60)} ÷ {formatBRL(folhaMensal)} = <strong>{folhas.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} folha</strong>
                </li>
              </ol>
            </details>
            <p className="mt-4 text-sm text-white/75">Estimativa sem garantia de resultado. Depende do estudo técnico da folha.</p>
            <button
              type="button"
              onClick={() => onContact('Readequação do GILRAT')}
              className="mt-5 w-full px-5 py-3 text-base font-bold text-[#0F2053] bg-white hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Solicitar o estudo para meu município
            </button>
          </div>
        </div>

        {/* Também para o município */}
        <div className="mt-10 flex flex-col lg:flex-row lg:items-center gap-4 p-5 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-base font-bold shrink-0">Também atendemos o município com:</p>
          <ul className="flex flex-wrap gap-3">
            {ALSO.map((a) => (
              <li key={a.text}>
                <a href="#terceirizacao" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-base transition-colors">
                  <Icon name={a.icon} className="w-5 h-5 text-[#9fd3ff]" />
                  {a.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
