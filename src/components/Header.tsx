import { useEffect, useState } from 'react';
import BrandLogo from './BrandLogo.tsx';
import { COMPANY_PROFILE, whatsappLink } from '../data/servicesData.ts';
import { WhatsAppIcon } from './ui.tsx';
import { ROUTES } from '../lib/routes.ts';

export const NAV_LINKS = [
  { href: '#terceirizacao', label: 'Terceirização' },
  { href: '#prefeituras', label: 'Prefeituras' },
  { href: '#rh-dp', label: 'RH e DP' },
  { href: '#simulador-dp', label: 'Simulador de DP' },
  { href: '#simular-orcamento', label: 'Pedir Orçamento' },
  { href: '#contato', label: 'Contato' },
];

export const LICITACOES_PAGE = ROUTES.licitacoes;

interface HeaderProps {
  /** Página atual: na página de licitações os links apontam para a home (/#secao) */
  page?: 'home' | 'licitacoes';
}

export default function Header({ page = 'home' }: HeaderProps) {
  const base = page === 'home' ? '' : ROUTES.home;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 transition-shadow ${
        scrolled ? 'shadow-md shadow-slate-900/5' : ''
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 h-[72px]">
          <a href={page === 'home' ? '#inicio' : ROUTES.home} aria-label="Ágil CM Soluções Integradas – página inicial" className="shrink-0">
            <BrandLogo size="md" theme="light" className="[&>img:last-child]:hidden sm:[&>img:last-child]:block" />
          </a>



          <div className="hidden sm:flex items-center gap-2 ml-auto xl:ml-0">
          <a
            href={LICITACOES_PAGE}
            aria-current={page === 'licitacoes' ? 'page' : undefined}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold tracking-wide rounded-xl border-2 transition-colors whitespace-nowrap ${
              page === 'licitacoes'
                ? 'bg-[#0F2053] border-[#0F2053] text-white'
                : 'border-[#0F2053] text-[#0F2053] hover:bg-[#0F2053] hover:text-white'
            }`}
          >
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#0478CA] opacity-75 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-[#0478CA]" />
            </span>
            LICITAÇÕES
          </a>
          <a href={ROUTES.documentos} className="inline-flex items-center px-4 py-2.5 text-sm font-extrabold tracking-wide rounded-xl border-2 border-[#0478CA] text-[#0478CA] hover:bg-[#0478CA] hover:text-white transition-colors whitespace-nowrap">
            Documentos
          </a>
          <a
            href={whatsappLink('Olá! Vim pelo site da Ágil CM e gostaria de atendimento.')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-[#128C4A] hover:bg-[#0E7A40] rounded-xl transition-colors whitespace-nowrap"
          >
            <WhatsAppIcon className="w-4 h-4" />
            <span className="hidden 2xl:inline">{COMPANY_PROFILE.phoneDisplay}</span>
            <span className="2xl:hidden">WhatsApp</span>
          </a>
          </div>

          <a
            href={LICITACOES_PAGE}
            className="sm:hidden ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-xs font-extrabold tracking-wide text-white bg-[#0F2053] rounded-lg"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#7cc4ff]" aria-hidden="true" />
            LICITAÇÕES
          </a>
          <a href={ROUTES.documentos} className="sm:hidden inline-flex items-center px-2 py-2 text-xs font-bold text-[#0478CA] border border-[#0478CA] rounded-lg">Documentos</a>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="xl:hidden p-2 -mr-2 text-[#0F2053] cursor-pointer"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
            aria-controls="menu-mobile"
          >
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

          <nav aria-label="Navegação principal" className="hidden xl:flex items-center justify-center gap-5 py-3 border-t border-slate-100 text-[14px] font-semibold text-slate-700">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={base + l.href} className="hover:text-[#0478CA] transition-colors whitespace-nowrap">
                {l.label}
              </a>
            ))}
          </nav>

        {open && (
          <nav id="menu-mobile" aria-label="Menu" className="xl:hidden border-t border-slate-200 py-3 pb-5 flex flex-col">
            <a
              href={LICITACOES_PAGE}
              className="mb-2 inline-flex items-center justify-center gap-2 px-4 py-3 text-base font-extrabold tracking-wide text-white bg-[#0F2053] rounded-xl"
            >
              LICITAÇÕES · editais abertos em MG
            </a>
            <a href={ROUTES.documentos} className="mb-2 inline-flex items-center justify-center px-4 py-3 text-base font-bold text-[#0478CA] border-2 border-[#0478CA] rounded-xl">Documentos</a>
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={base + l.href}
                onClick={() => setOpen(false)}
                className="px-2 py-3 text-lg font-semibold text-[#0F2053] border-b border-slate-100 last:border-0"
              >
                {l.label}
              </a>
            ))}
            <a
              href={whatsappLink('Olá! Vim pelo site da Ágil CM e gostaria de atendimento.')}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center justify-center gap-2 px-4 py-3 text-base font-bold text-white bg-[#128C4A] rounded-xl"
            >
              <WhatsAppIcon className="w-5 h-5" />
              Falar no WhatsApp
            </a>
          </nav>
        )}
      </div>
    </header>
  );
}
