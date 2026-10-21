import { FAQ_ITEMS } from '../data/faq.ts';
import { Container, SectionHeader } from './ui.tsx';

export default function FaqSection() {
  return (
    <section id="duvidas" aria-labelledby="titulo-duvidas" className="py-16 sm:py-24 bg-white">
      <Container className="max-w-4xl">
        <SectionHeader id="titulo-duvidas" eyebrow="Perguntas frequentes" title="Tire suas dúvidas" center />
        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="group rounded-2xl border border-slate-200 bg-[#F7FAFD] open:bg-white open:border-[#0478CA]/40">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none p-5 text-[#0F2053] [&::-webkit-details-marker]:hidden">
                <h3 className="text-lg font-semibold">{item.q}</h3>
                <svg className="w-6 h-6 shrink-0 text-[#0478CA] transition-transform group-open:rotate-45" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m-7-7h14" />
                </svg>
              </summary>
              <p className="px-5 pb-5 -mt-1 text-base text-slate-700 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
