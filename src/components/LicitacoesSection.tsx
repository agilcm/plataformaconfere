import { Container, Icon } from './ui.tsx';
import { ROUTES } from '../lib/routes.ts';

interface Props {
  onContact: (service?: string) => void;
}

const STEPS = [
  { title: 'Monitoramos os editais', text: 'Buscamos todos os dias as licitações compatíveis com o que sua empresa vende.' },
  { title: 'Analisamos o edital', text: 'Lemos as exigências, apontamos riscos e fazemos pedidos de esclarecimento ou impugnação.' },
  { title: 'Preparamos a habilitação', text: 'Certidões, balanço, atestados técnicos e cadastro no SICAF, sempre em dia.' },
  { title: 'Montamos a proposta', text: 'Planilha de custos, proposta comercial e documentos no formato que o edital pede.' },
  { title: 'Disputamos o pregão', text: 'Operamos a sala de lances com estratégia de preço e acompanhamos cada fase.' },
  { title: 'Acompanhamos até o empenho', text: 'Recursos, homologação, assinatura do contrato e emissão da nota de empenho.' },
];

const SEGMENTS = [
  'Alimentação e merenda',
  'Material escolar e de escritório',
  'Informática e tecnologia',
  'Limpeza e higiene',
  'Serviços terceirizados',
  'Saúde e hospitalar',
  'Obras e manutenção',
  'Veículos e combustíveis',
];

const PORTALS = ['Compras.gov.br', 'BLL Compras', 'Licitanet', 'Portal de Compras Públicas', 'BNC Compras'];

export default function LicitacoesSection({ onContact }: Props) {
  return (
    <section id="licitacoes" aria-labelledby="titulo-licitacoes" className="relative py-16 sm:py-24 bg-white overflow-hidden">
      <div aria-hidden="true" className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-[#0478CA]/8 blur-3xl" />
      <Container className="relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          {/* Texto e chamada */}
          <div className="lg:col-span-5 flex flex-col">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF4D6] text-[#8A5A00] text-sm font-bold">
              <Icon name="chart" className="w-4 h-4" />
              Área que mais cresce
            </span>
            <h2 id="titulo-licitacoes" className="mt-4 text-3xl sm:text-4xl font-bold font-display text-[#0F2053] tracking-tight [text-wrap:balance]">
              Assessoria em Licitações Públicas: sua empresa vendendo para o governo
            </h2>
            <p className="mt-4 text-lg text-slate-600 leading-relaxed">
              Prefeituras e órgãos públicos compram de tudo, o ano inteiro. Cuidamos da burocracia, dos documentos e do pregão
              para sua empresa disputar e vencer com segurança, dentro da Lei 14.133/2021.
            </p>

            <div className="mt-6 p-5 rounded-2xl bg-[#0F2053] text-white">
              <p className="text-base font-bold">Por que com a Ágil CM?</p>
              <p className="mt-1 text-base text-white/85 leading-relaxed">
                Nós também vendemos para o poder público. Conhecemos na prática os editais, os portais e o que derruba uma
                proposta.
              </p>
            </div>

            <div className="mt-5 mb-6 p-4 rounded-2xl bg-[#F2F7FC] border border-[#0478CA]/15 text-base text-slate-700">
              <strong className="text-[#0F2053]">Como cobramos:</strong> mensalidade fixa pela operação, mais taxa de êxito
              sobre os contratos ganhos.
            </div>

            <button
              type="button"
              onClick={() => onContact('Assessoria em Licitações')}
              className="mt-6 lg:mt-auto inline-flex items-center justify-center gap-2 w-full sm:w-auto self-start px-6 py-3.5 text-base font-bold text-white bg-[#0478CA] hover:bg-[#03609F] rounded-xl transition-colors cursor-pointer"
            >
              Quero vender para o governo
              <Icon name="arrow" className="w-5 h-5" />
            </button>
            <a href={ROUTES.licitacoes} className="mt-3 inline-flex items-center gap-2 self-start text-base font-bold text-[#0478CA] hover:text-[#03609F] underline underline-offset-4">
              Ver editais abertos em MG e na Zona da Mata
            </a>
          </div>

          {/* Etapas */}
          <div className="lg:col-span-7 flex flex-col">
            <h3 className="text-xl font-bold text-[#0F2053] mb-5">Cuidamos de tudo, do edital ao empenho</h3>
            <ol className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex flex-col p-5 rounded-2xl border border-slate-200 bg-white hover:border-[#0478CA]/40 hover:shadow-md hover:shadow-[#0F2053]/5 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 shrink-0 rounded-xl bg-[#0478CA] text-white font-bold text-lg flex items-center justify-center font-display">
                      {i + 1}
                    </span>
                    <h4 className="text-lg font-bold text-[#0F2053] leading-snug">{s.title}</h4>
                  </div>
                  <p className="mt-2 text-base text-slate-600 leading-relaxed">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-12 gap-5">
          <div className="md:col-span-8 p-6 rounded-2xl bg-[#F7FAFD] border border-slate-200">
            <h3 className="text-lg font-bold text-[#0F2053] mb-4">Segmentos que atendemos</h3>
            <ul className="flex flex-wrap gap-2">
              {SEGMENTS.map((s) => (
                <li key={s} className="px-3.5 py-2 rounded-full bg-white border border-slate-200 text-[15px] text-slate-700">
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-4 p-6 rounded-2xl bg-[#F7FAFD] border border-slate-200">
            <h3 className="text-lg font-bold text-[#0F2053] mb-4">Portais que operamos</h3>
            <ul className="space-y-2">
              {PORTALS.map((p) => (
                <li key={p} className="flex items-center gap-2 text-base text-slate-700">
                  <Icon name="check" className="w-5 h-5 text-[#0478CA] shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
