import { Container, Icon, SectionHeader } from './ui.tsx';

interface Props {
  onContact: (service?: string) => void;
}

const DP_ITEMS = [
  'Revisão e ajuste de cálculos da folha',
  'Conferência de férias, 13º e rescisões',
  'Horas extras, adicionais e médias',
  'Regras de ponto e banco de horas',
  'Conferência de eSocial, FGTS Digital e DCTFWeb',
  'Encargos e obrigações sem multa',
];

const RH_ITEMS = [
  'Plano de cargos e salários',
  'Recrutamento e seleção',
  'Políticas internas e regulamentos',
  'Avaliação de desempenho',
  'Prevenção de processos trabalhistas',
];

export default function RhDpSection({ onContact }: Props) {
  return (
    <section id="rh-dp" aria-labelledby="titulo-rh-dp" className="py-16 sm:py-24 bg-[#F4F7FB]">
      <Container>
        <SectionHeader
          id="titulo-rh-dp"
          eyebrow="Consultoria em Departamento Pessoal e RH"
          title="Consultoria para sua folha e seu RH"
          lead="Revisamos os cálculos da folha, ajustamos o que está errado e orientamos sua equipe de DP e RH para a empresa crescer com segurança."
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* DP */}
          <article className="flex flex-col p-7 sm:p-8 rounded-3xl bg-white border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#0478CA] text-white flex items-center justify-center shrink-0">
                <Icon name="sheet" className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-2xl font-bold font-display text-[#0F2053]">Consultoria em folha e DP</h3>
                <p className="text-base text-slate-600">Cálculos revisados e ajustados, sua equipe orientada</p>
              </div>
            </div>
            <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 flex-1">
              {DP_ITEMS.map((it) => (
                <li key={it} className="flex items-start gap-2.5 text-base text-slate-800">
                  <Icon name="check" className="w-5 h-5 mt-0.5 text-[#0478CA] shrink-0" />
                  {it}
                </li>
              ))}
            </ul>
            <div className="mt-7 p-4 rounded-2xl bg-[#F2F7FC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-base text-slate-700">
                <strong className="text-[#0F2053]">Quanto custa um funcionário?</strong> Calcule em 1 minuto.
              </p>
              <a
                href="#simulador-dp"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-base font-bold text-white bg-[#0F2053] hover:bg-[#1a2f6e] rounded-xl whitespace-nowrap"
              >
                <Icon name="calc" className="w-5 h-5" />
                Simulador de DP
              </a>
            </div>
            <button
              type="button"
              onClick={() => onContact('Folha de Pagamento & DP')}
              className="mt-4 inline-flex items-center gap-1.5 text-base font-bold text-[#0478CA] hover:text-[#03609F] cursor-pointer self-start"
            >
              Pedir consultoria de folha
              <Icon name="arrow" className="w-4 h-4" />
            </button>
          </article>

          {/* RH */}
          <article className="flex flex-col p-7 sm:p-8 rounded-3xl bg-white border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#0F2053] text-white flex items-center justify-center shrink-0">
                <Icon name="users" className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-2xl font-bold font-display text-[#0F2053]">Consultoria de RH</h3>
                <p className="text-base text-slate-600">Gestão de pessoas estruturada e segura</p>
              </div>
            </div>
            <ul className="mt-6 space-y-3 flex-1">
              {RH_ITEMS.map((it) => (
                <li key={it} className="flex items-start gap-2.5 text-base text-slate-800">
                  <Icon name="check" className="w-5 h-5 mt-0.5 text-[#0478CA] shrink-0" />
                  {it}
                </li>
              ))}
            </ul>
            <blockquote className="mt-7 p-4 rounded-2xl bg-[#F2F7FC] text-base text-slate-700 italic">
              “Um RH eficiente não serve só para gerir pessoas: ele protege o caixa e evita passivos.”
            </blockquote>
            <button
              type="button"
              onClick={() => onContact('Consultoria de RH para Empresas')}
              className="mt-4 inline-flex items-center gap-1.5 text-base font-bold text-[#0478CA] hover:text-[#03609F] cursor-pointer self-start"
            >
              Falar com um consultor de RH
              <Icon name="arrow" className="w-4 h-4" />
            </button>
          </article>
        </div>
      </Container>
    </section>
  );
}
