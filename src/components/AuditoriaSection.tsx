import { Container, Icon } from './ui.tsx';

interface Props {
  onContact: (service?: string) => void;
}

const STEPS = [
  { icon: 'doc', title: 'Diagnóstico sem custo', text: 'Você nos envia folhas e guias dos últimos 5 anos.' },
  { icon: 'search', title: 'Cruzamento de dados', text: 'Comparamos folha, eSocial, DCTFWeb e contabilidade em busca de diferenças.' },
  { icon: 'shield', title: 'Validação técnica', text: 'Cada oportunidade é conferida e só seguimos com teses consolidadas.' },
  { icon: 'chart', title: 'Recuperação', text: 'Compensamos com tributos futuros ou pedimos a restituição à Receita.' },
];

const CHECKS = [
  'Verbas indenizatórias com INSS e FGTS indevidos',
  'Alíquota de RAT, FAP e CNAE errados',
  'Pagamentos em duplicidade ou sem compensação',
  'Débitos que podem ser parcelados com desconto',
];

export default function AuditoriaSection({ onContact }: Props) {
  return (
    <section id="recuperacao-tributaria" aria-labelledby="titulo-recuperacao" className="py-16 sm:py-24 bg-white">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <p className="text-sm font-bold text-[#0478CA] mb-2">Auditoria de folha e recuperação tributária</p>
            <h2 id="titulo-recuperacao" className="text-3xl sm:text-4xl font-bold font-display text-[#0F2053] tracking-tight [text-wrap:balance]">
              Sua empresa pode estar pagando imposto a mais na folha
            </h2>
            <p className="mt-4 text-lg text-slate-600 leading-relaxed">
              Erros de enquadramento e de base de cálculo são comuns e se repetem todo mês. Encontramos essas diferenças e
              buscamos a devolução dos últimos 5 anos.
            </p>

            <ol className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="p-5 rounded-2xl bg-[#F7FAFD] border border-slate-200">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-[#0478CA]/10 text-[#0478CA] flex items-center justify-center">
                      <Icon name={s.icon} className="w-5 h-5" />
                    </span>
                    <span className="text-sm font-bold text-slate-500">Etapa {i + 1}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-[#0F2053]">{s.title}</h3>
                  <p className="mt-1 text-base text-slate-600 leading-relaxed">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>

          <aside className="lg:col-span-5 p-7 sm:p-8 rounded-3xl bg-gradient-to-br from-[#0478CA] to-[#0F2053] text-white shadow-xl shadow-[#0F2053]/20">
            <p className="text-sm font-bold text-white/80">Sem risco para sua empresa</p>
            <p className="mt-1 text-3xl font-bold font-display leading-tight">Você só paga se recuperar</p>
            <p className="mt-3 text-base text-white/85 leading-relaxed">
              Diagnóstico inicial gratuito. Nossos honorários são um percentual apenas sobre o valor efetivamente recuperado ou
              economizado.
            </p>
            <h3 className="mt-6 text-base font-bold">O que revisamos</h3>
            <ul className="mt-3 space-y-2.5">
              {CHECKS.map((c) => (
                <li key={c} className="flex items-start gap-2.5 text-base">
                  <Icon name="check" className="w-5 h-5 mt-0.5 text-[#9fd3ff] shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onContact('Auditoria de Folha & Recuperação Tributária')}
              className="mt-7 w-full px-5 py-3.5 text-base font-bold text-[#0F2053] bg-white hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Quero o diagnóstico gratuito
            </button>
          </aside>
        </div>
      </Container>
    </section>
  );
}
