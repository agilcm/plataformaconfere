import { OPERATIONAL_GROUPS } from '../data/servicesData.ts';
import { Container, Icon, SectionHeader } from './ui.tsx';

interface OperationalHubProps {
  onQuote: (serviceId: string) => void;
}

export default function OperationalHub({ onQuote }: OperationalHubProps) {
  return (
    <section id="terceirizacao" aria-labelledby="titulo-terceirizacao" className="py-16 sm:py-24 bg-white">
      <Container>
        <SectionHeader
          id="titulo-terceirizacao"
          eyebrow="Terceirização e Facilities"
          title="Serviços terceirizados para empresas e prefeituras"
          lead="Equipe própria, supervisão constante e documentação em dia para você contratar com segurança."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {OPERATIONAL_GROUPS.map((g) => (
            <article key={g.id} className="flex flex-col p-7 rounded-2xl border border-slate-200 bg-[#F7FAFD] hover:border-[#0478CA]/40 hover:shadow-lg hover:shadow-[#0F2053]/5 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-[#0478CA] text-white flex items-center justify-center mb-5">
                <Icon name={g.icon} className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold font-display text-[#0F2053]">{g.title}</h3>
              <p className="mt-2 text-base text-slate-600 leading-relaxed">{g.description}</p>
              <ul className="mt-5 space-y-2.5 flex-1">
                {g.items.map((it) => (
                  <li key={it} className="flex items-start gap-2.5 text-base text-slate-800">
                    <Icon name="check" className="w-5 h-5 mt-0.5 text-[#0478CA] shrink-0" />
                    {it}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => onQuote(g.quoteServiceId)}
                className="mt-7 inline-flex items-center justify-center gap-2 w-full px-5 py-3 text-base font-bold text-[#0478CA] bg-white border-2 border-[#0478CA]/25 hover:border-[#0478CA] rounded-xl transition-colors cursor-pointer"
              >
                Pedir orçamento
                <Icon name="arrow" className="w-5 h-5" />
              </button>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
