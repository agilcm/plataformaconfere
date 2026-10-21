import type { ReactNode } from 'react';

// Cabeçalho padrão das seções: rótulo curto + título (h2) + frase de apoio
export function SectionHeader({
  eyebrow,
  title,
  lead,
  center = false,
  id,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  center?: boolean;
  id?: string;
}) {
  return (
    <header className={`mb-10 sm:mb-12 max-w-3xl ${center ? 'mx-auto text-center' : ''}`}>
      <p className="text-sm font-bold text-[#0478CA] mb-2">{eyebrow}</p>
      <h2 id={id} className="text-3xl sm:text-4xl font-bold font-display text-[#0F2053] tracking-tight [text-wrap:balance]">
        {title}
      </h2>
      {lead && <p className="mt-3 text-lg text-slate-600 leading-relaxed">{lead}</p>}
    </header>
  );
}

const PATHS: Record<string, string> = {
  building:
    'M3 21h18M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1M10 21v-3h4v3',
  tree: 'M12 22v-6m0 0l-3-3m3 3l3-3M12 3a5 5 0 00-5 5c0 1 .3 2 .8 2.8A4 4 0 008 18h8a4 4 0 00.2-7.2A5 5 0 0012 3z',
  box: 'M21 8l-9-5-9 5m18 0l-9 5m9-5v8l-9 5m0-8L3 8m9 5v8M3 8v8l9 5',
  users: 'M17 20h5v-2a3 3 0 00-5.4-1.8M9 20H2v-2a3 3 0 015.4-1.8M15 7a3 3 0 11-6 0 3 3 0 016 0zm-9 3a2 2 0 11-4 0 2 2 0 014 0zm16 0a2 2 0 11-4 0 2 2 0 014 0zM7.4 16.2a5 5 0 019.2 0',
  sheet: 'M9 17v-6m3 6v-3m3 3V9M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z',
  receipt: 'M9 14l2 2 4-4M7 3h10a2 2 0 012 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 012-2z',
  search: 'M21 21l-4.3-4.3M10 18a8 8 0 100-16 8 8 0 000 16zM7 10h6m-3-3v6',
  gavel: 'M14 4l6 6M12 6l6 6M9 9l6 6M4 20l7-7M3 21h8',
  bank: 'M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18M12 3l9 5H3l9-5z',
  shield: 'M9 12l2 2 4-4m6-2c0 5.5-3.8 10.3-9 11.6C6.8 18.3 3 13.5 3 8c0-1 .1-2 .4-3A12 12 0 0012 3a12 12 0 008.6 2c.3 1 .4 2 .4 3z',
  check: 'M5 13l4 4L19 7',
  clock: 'M12 8v4l3 3M12 21a9 9 0 100-18 9 9 0 000 18z',
  chart: 'M4 19h16M7 15l3-3 3 3 5-6',
  doc: 'M9 12h6m-6 4h6M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z',
  arrow: 'M5 12h14m-6-6l6 6-6 6',
  calc: 'M8 7h8M8 11h2m4 0h2m-8 4h2m4 0h2M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z',
};

export function Icon({ name, className = 'w-6 h-6' }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={PATHS[name] ?? PATHS.check} />
    </svg>
  );
}

export function WhatsAppIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={`${className} fill-current`} aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.41a8.176 8.176 0 012.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.42 0-2.81-.37-4.04-1.07l-.29-.17-3.11.82.83-3.03-.19-.3a8.19 8.19 0 01-1.26-4.49c0-4.54 3.7-8.24 8.24-8.24h.03zM8.53 7.33c-.14 0-.36.05-.54.25-.19.2-.72.71-.72 1.73s.74 2.01.84 2.15c.1.14 1.43 2.24 3.51 3.11.5.21.88.34 1.18.44.5.16.95.14 1.31.09.4-.06 1.23-.5 1.4-1 .17-.49.17-.91.12-1-.05-.09-.19-.14-.4-.25l-1.2-.59c-.2-.1-.35-.14-.5.1-.15.24-.59.73-.72.88-.13.15-.27.17-.48.06-.21-.1-.89-.33-1.69-1.05-.63-.56-1.05-1.25-1.18-1.46-.13-.21-.01-.33.09-.43.09-.1.21-.24.31-.36.1-.12.14-.2.21-.34.07-.14.03-.26-.02-.36-.05-.1-.48-1.16-.66-1.59-.17-.42-.35-.36-.5-.37h-.43z" />
    </svg>
  );
}

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-bold text-white bg-[#0478CA] hover:bg-[#03609F] rounded-xl transition-colors shadow-sm cursor-pointer';
export const btnSecondary =
  'inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-semibold text-[#0F2053] bg-white hover:bg-slate-50 border-2 border-[#0F2053]/15 rounded-xl transition-colors cursor-pointer';
export const btnWhatsApp =
  'inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-bold text-white bg-[#128C4A] hover:bg-[#0E7A40] rounded-xl transition-colors shadow-sm cursor-pointer';
