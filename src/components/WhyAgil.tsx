import { Container, Icon } from './ui.tsx';

const REASONS = [
  { icon: 'users', title: 'Equipe própria e treinada', text: 'Seleção criteriosa, treinamento contínuo e NRs em dia.' },
  { icon: 'clock', title: 'Supervisão e reposição rápida', text: 'Gestor dedicado em cada contrato e substituição imediata.' },
  { icon: 'doc', title: 'Documentação sem pendências', text: 'NFS-e com certidões negativas todo mês, sem glosas.' },
  { icon: 'shield', title: 'Segurança jurídica', text: 'Seguro garantia e conformidade com eSocial e CLT.' },
];

export default function WhyAgil() {
  return (
    <section id="diferenciais" aria-labelledby="titulo-diferenciais" className="py-16 sm:py-24 bg-[#F4F7FB]">
      <Container>
        <header className="mb-10 max-w-3xl">
          <p className="text-sm font-bold text-[#0478CA] mb-2">Por que a Ágil CM</p>
          <h2 id="titulo-diferenciais" className="text-3xl sm:text-4xl font-bold font-display text-[#0F2053] tracking-tight [text-wrap:balance]">
            Quem contrata a Ágil CM não se preocupa com a operação
          </h2>
        </header>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {REASONS.map((r) => (
            <li key={r.title} className="p-6 rounded-2xl bg-white border border-slate-200">
              <div className="w-12 h-12 rounded-xl bg-[#0478CA] text-white flex items-center justify-center mb-4">
                <Icon name={r.icon} className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold font-display text-[#0F2053]">{r.title}</h3>
              <p className="mt-2 text-base text-slate-600 leading-relaxed">{r.text}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
