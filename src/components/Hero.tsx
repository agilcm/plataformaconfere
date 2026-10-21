import { useEffect, useRef, useState } from 'react';
import { btnPrimary, btnSecondary, Container, Icon } from './ui.tsx';

const SLIDES = [
  {
    id: 'terceirizacao',
    tag: 'Terceirização e Facilities',
    title: 'Limpeza, portaria, manutenção urbana e suprimentos',
    text: 'Equipes treinadas e supervisionadas para empresas e prefeituras.',
    points: ['Limpeza e portaria', 'Capina, roçada e jardinagem', 'Merenda, material escolar e TI'],
    image: '/images/hero_service_corporate.webp',
    alt: 'Equipe uniformizada de terceirização e facilities',
    href: '#terceirizacao',
    cta: 'Ver serviços de terceirização',
  },
  {
    id: 'rh',
    tag: 'RH, Folha e Consultoria',
    title: 'Folha de pagamento, RH e recuperação tributária',
    text: 'Departamento Pessoal completo e impostos pagos a mais de volta.',
    points: ['Folha de pagamento e DP', 'Auditoria e recuperação tributária', 'GILRAT e reparcelamento para prefeituras'],
    image: '/images/service_operational_management.webp',
    alt: 'Reunião de consultoria de RH e tributária',
    href: '#rh-dp',
    cta: 'Ver RH e consultoria',
  },
  {
    id: 'licitacoes',
    tag: 'Assessoria em Licitações',
    title: 'Sua empresa vendendo para prefeituras e governo',
    text: 'Do edital ao empenho: documentos, proposta e pregão eletrônico.',
    points: ['Monitoramento de editais', 'Habilitação e proposta', 'Disputa no pregão eletrônico'],
    image: '',
    alt: '',
    href: '#licitacoes',
    cta: 'Ver assessoria em licitações',
  },
];

// Ilustração do slide de licitações (sem foto)
function EditalIllustration() {
  const rows = ['Edital analisado', 'Habilitação completa', 'Lance vencedor', 'Contrato assinado'];
  return (
    <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-[#0478CA] via-[#0F2053] to-[#0A1640]">
      <div className="absolute top-4 right-5 sm:top-6 sm:right-7 w-[62%] max-w-[280px] rotate-3 origin-top-right scale-[0.8] sm:scale-100 rounded-2xl bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#0F2053]">PREGÃO ELETRÔNICO</span>
          <span className="text-[10px] font-bold text-white bg-[#128C4A] rounded-full px-2 py-0.5">GANHO</span>
        </div>
        <div className="mt-2 h-1.5 w-2/3 rounded bg-slate-200" />
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r} className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
              <span className="w-4 h-4 rounded-full bg-[#0478CA] text-white flex items-center justify-center">
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={4}><path d="M5 13l4 4L19 7" /></svg>
              </span>
              {r}
            </li>
          ))}
        </ul>
      </div>
      <div className="absolute top-10 left-5 sm:top-14 sm:left-8 w-[34%] max-w-[170px] -rotate-6 rounded-xl bg-white/15 border border-white/25 p-3 backdrop-blur">
        <div className="h-2 w-3/4 rounded bg-white/60" />
        <div className="mt-2 h-2 w-1/2 rounded bg-white/40" />
        <div className="mt-2 h-2 w-2/3 rounded bg-white/40" />
        <div className="mt-3 text-[10px] font-bold text-white/90">Lei 14.133/2021</div>
      </div>
    </div>
  );
}

const INTERVAL = 6000;

export default function Hero() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }, []);

  // Passa sozinho entre os dois serviços; pausa quando o visitante está interagindo
  useEffect(() => {
    if (paused || reduced.current) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % SLIDES.length), INTERVAL);
    return () => clearTimeout(t);
  }, [active, paused]);

  return (
    <section id="inicio" aria-labelledby="titulo-principal" className="relative bg-gradient-to-b from-[#EEF4FB] to-white overflow-hidden">
      <Container className="py-12 sm:py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Texto principal */}
          <div className="lg:col-span-6">
            <p className="text-sm font-bold text-[#0478CA] mb-3">Astolfo Dutra · Zona da Mata · MG</p>
            <h1
              id="titulo-principal"
              className="text-4xl sm:text-5xl font-bold font-display text-[#0F2053] leading-[1.1] tracking-tight [text-wrap:balance]"
            >
              Terceirização, licitações e RH para empresas e prefeituras
            </h1>
            <p className="mt-5 text-lg sm:text-xl text-slate-600 leading-relaxed max-w-xl">
              Cuidamos da operação, da folha e da burocracia, e preparamos sua empresa para vender para o governo. Atendimento
              próximo e tudo dentro da lei.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a href="#simular-orcamento" className={btnPrimary}>
                Pedir orçamento
                <Icon name="arrow" className="w-5 h-5" />
              </a>
              <a href="#licitacoes" className={btnSecondary}>
                Vender para o governo
              </a>
            </div>
            <ul className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[15px] text-slate-700">
              {['Equipe própria e treinada', 'Regularidade fiscal em dia', 'Atendimento em MG, RJ e SP'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#0478CA]/10 text-[#0478CA] flex items-center justify-center shrink-0">
                    <Icon name="check" className="w-4 h-4" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Vitrine automática dos dois serviços */}
          <div
            className="lg:col-span-6"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            <div
              className="relative rounded-3xl overflow-hidden bg-[#0F2053] shadow-xl shadow-[#0F2053]/20 aspect-[3/4] sm:aspect-square max-w-full"
              role="region"
              aria-roledescription="carrossel"
              aria-label="Nossas áreas de atuação"
            >
              {SLIDES.map((s, i) => (
                <article
                  key={s.id}
                  aria-hidden={active !== i}
                  className={`absolute inset-0 transition-opacity duration-700 ${active === i ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                  {s.image ? (
                  <img
                    src={s.image}
                    alt={s.alt}
                    width={1200}
                    height={825}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    fetchPriority={i === 0 ? 'high' : 'auto'}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  ) : (
                    <EditalIllustration />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0F2053] via-[#0F2053]/75 to-[#0F2053]/10" />
                  <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 text-white">
                    <span className="inline-block px-3 py-1 rounded-full bg-[#0478CA] text-sm font-bold">{s.tag}</span>
                    <p className="mt-3 text-2xl sm:text-3xl font-bold font-display leading-tight">{s.title}</p>
                    <p className="mt-2 text-base sm:text-lg text-white/85">{s.text}</p>
                    <ul className="mt-4 space-y-1.5 text-base">
                      {s.points.map((p) => (
                        <li key={p} className="flex items-center gap-2">
                          <Icon name="check" className="w-5 h-5 text-[#7cc4ff] shrink-0" />
                          {p}
                        </li>
                      ))}
                    </ul>
                    <a
                      href={s.href}
                      tabIndex={active === i ? 0 : -1}
                      className="mt-5 inline-flex items-center gap-2 text-base font-bold text-white underline underline-offset-4 decoration-white/40 hover:decoration-white"
                    >
                      {s.cta}
                      <Icon name="arrow" className="w-5 h-5" />
                    </a>
                  </div>
                </article>
              ))}
            </div>

            {/* Indicadores (o carrossel passa sozinho; clicar é opcional) */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              {SLIDES.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActive(i)}
                  aria-label={`Mostrar ${s.tag}`}
                  aria-current={active === i}
                  className="group py-2 cursor-pointer"
                >
                  <span className="block h-1.5 w-full min-w-14 rounded-full bg-slate-200 overflow-hidden">
                    <span
                      key={`${active}-${paused}`}
                      className={`block h-full bg-[#0478CA] rounded-full ${
                        active === i ? (paused ? 'w-full' : 'hero-progress') : 'w-0'
                      }`}
                    />
                  </span>
                  <span className={`block mt-1.5 text-xs sm:text-sm font-semibold leading-tight ${active === i ? 'text-[#0F2053]' : 'text-slate-500'}`}>{s.tag}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
