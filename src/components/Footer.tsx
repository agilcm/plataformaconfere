import BrandLogo from './BrandLogo.tsx';
import { COMPANY_PROFILE, whatsappLink } from '../data/servicesData.ts';
import { LICITACOES_PAGE, NAV_LINKS } from './Header.tsx';
import { ROUTES } from '../lib/routes.ts';

const SERVICE_LINKS = [
  { href: '#terceirizacao', label: 'Limpeza, conservação e portaria' },
  { href: '#terceirizacao', label: 'Manutenção urbana e jardinagem' },
  { href: '#terceirizacao', label: 'Fornecimento de suprimentos' },
  { href: '#licitacoes', label: 'Assessoria em licitações públicas' },
  { href: '#rh-dp', label: 'Folha de pagamento e DP' },
  { href: '#rh-dp', label: 'Consultoria de RH' },
  { href: '#recuperacao-tributaria', label: 'Recuperação tributária' },
  { href: '#prefeituras', label: 'Estudo do GILRAT' },
  { href: '#prefeituras', label: 'Reparcelamento previdenciário' },
];

export default function Footer({ page = 'home' }: { page?: 'home' | 'licitacoes' }) {
  const base = page === 'home' ? '' : ROUTES.home;
  return (
    <footer className="bg-[#0A1640] text-white/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <BrandLogo variant="stacked" size="md" theme="dark" />
            <p className="mt-5 text-base leading-relaxed max-w-sm">
              Terceirização, licitações, RH, folha de pagamento e consultoria tributária para empresas e prefeituras da Zona da Mata e de todo o Brasil.
            </p>
          </div>

          <nav aria-label="Serviços" className="lg:col-span-3">
            <h2 className="text-base font-bold text-white mb-4">Serviços</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 text-[15px]">
              {SERVICE_LINKS.map((l) => (
                <li key={l.label}>
                  <a href={base + l.href} className="hover:text-white">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Atalhos" className="lg:col-span-2">
            <h2 className="text-base font-bold text-white mb-4">Atalhos</h2>
            <ul className="space-y-2 text-[15px]">
              <li>
                <a href={LICITACOES_PAGE} className="font-semibold text-white hover:underline">
                  Editais abertos em MG
                </a>
              </li>
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a href={base + l.href} className="hover:text-white">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="lg:col-span-3">
            <h2 className="text-base font-bold text-white mb-4">Contato</h2>
            <address className="not-italic space-y-2 text-[15px]">
              <a href={whatsappLink('Olá! Vim pelo site da Ágil CM.')} target="_blank" rel="noopener noreferrer" className="block hover:text-white">
                {COMPANY_PROFILE.phoneDisplay}
              </a>
              <a href={`mailto:${COMPANY_PROFILE.email}`} className="block hover:text-white break-words">
                {COMPANY_PROFILE.email}
              </a>
              <span className="block">{COMPANY_PROFILE.city}</span>
              <span className="block">Seg a sex, 8h às 18h</span>
            </address>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between gap-3 text-sm text-white/60">
          <p>
            © {new Date().getFullYear()} Ágil CM Soluções Integradas · CNPJ {COMPANY_PROFILE.cnpj}
          </p>
          <p>Inscrição Estadual {COMPANY_PROFILE.inscricaoEstadual}</p>
        </div>
      </div>
    </footer>
  );
}
