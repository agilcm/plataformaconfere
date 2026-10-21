import { COMPANY_PROFILE } from '../data/servicesData.ts';

export default function WhatsAppFloatingButton() {
  const whatsappUrl = `https://wa.me/${COMPANY_PROFILE.phoneRaw}?text=${encodeURIComponent('Olá! Acessei o site da Ágil CM Soluções Integradas e gostaria de tirar dúvidas sobre serviços e propostas.')}`;

  return (
    <div className="fixed bottom-5 right-5 z-40 group print:hidden">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar no WhatsApp com a Ágil CM"
        className="w-14 h-14 rounded-full bg-[#128C4A] hover:bg-[#0E7A40] text-white flex items-center justify-center shadow-lg shadow-slate-900/20 hover:scale-105 active:scale-95 transition-all cursor-pointer relative"
      >
        <svg className="w-7 h-7 fill-current" aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.41a8.176 8.176 0 012.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.42 0-2.81-.37-4.04-1.07l-.29-.17-3.11.82.83-3.03-.19-.3a8.19 8.19 0 01-1.26-4.49c0-4.54 3.7-8.24 8.24-8.24h.03zM8.53 7.33c-.14 0-.36.05-.54.25-.19.2-.72.71-.72 1.73s.74 2.01.84 2.15c.1.14 1.43 2.24 3.51 3.11.5.21.88.34 1.18.44.5.16.95.14 1.31.09.4-.06 1.23-.5 1.4-1 .17-.49.17-.91.12-1-.05-.09-.19-.14-.4-.25l-1.2-.59c-.2-.1-.35-.14-.5.1-.15.24-.59.73-.72.88-.13.15-.27.17-.48.06-.21-.1-.89-.33-1.69-1.05-.63-.56-1.05-1.25-1.18-1.46-.13-.21-.01-.33.09-.43.09-.1.21-.24.31-.36.1-.12.14-.2.21-.34.07-.14.03-.26-.02-.36-.05-.1-.48-1.16-.66-1.59-.17-.42-.35-.36-.5-.37h-.43z" />
        </svg>

        {/* Floating tooltip */}
        <span className="hidden sm:block absolute right-16 top-1/2 -translate-y-1/2 bg-[#0F2053] text-white text-sm font-semibold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Fale com a Ágil CM no WhatsApp
        </span>
      </a>
    </div>
  );
}
