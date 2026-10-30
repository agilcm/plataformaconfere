import { CONSULTING_SERVICES, CONSULTING_TO_CONTACT } from '../data/servicesData.ts';
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

export default function PrefeiturasSection({ onContact }: Props) {
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
