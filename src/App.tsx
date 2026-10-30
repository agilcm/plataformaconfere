import { useCallback, useState } from 'react';
import Header from './components/Header.tsx';
import Hero from './components/Hero.tsx';
import OperationalHub from './components/OperationalHub.tsx';
import LicitacoesSection from './components/LicitacoesSection.tsx';
import RhDpSection from './components/RhDpSection.tsx';
import AuditoriaSection from './components/AuditoriaSection.tsx';
import PrefeiturasSection from './components/PrefeiturasSection.tsx';
import QuoteCalculator from './components/QuoteCalculator.tsx';
import WhyAgil from './components/WhyAgil.tsx';
import FaqSection from './components/FaqSection.tsx';
import ContactSection from './components/ContactSection.tsx';
import Footer from './components/Footer.tsx';
import WhatsAppFloatingButton from './components/WhatsAppFloatingButton.tsx';

const scrollToId = (id: string) => {
  requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
};

export default function App() {
  const [quoteServiceId, setQuoteServiceId] = useState<string | undefined>();
  const [contactService, setContactService] = useState<string | undefined>();

  const goToQuote = useCallback((serviceId: string) => {
    setQuoteServiceId(serviceId);
    scrollToId('simular-orcamento');
  }, []);

  const goToContact = useCallback((service?: string) => {
    if (service) setContactService(service);
    scrollToId('contato');
  }, []);

  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2 focus:bg-[#0478CA] focus:text-white focus:rounded-lg focus:font-semibold"
      >
        Pular para o conteúdo
      </a>
      <Header />
      <main id="conteudo">
        <Hero />
        <OperationalHub onQuote={goToQuote} />
        <QuoteCalculator preselectedServiceId={quoteServiceId} />
        <PrefeiturasSection onContact={goToContact} />
        <RhDpSection onContact={goToContact} />
        <AuditoriaSection onContact={goToContact} />
        <LicitacoesSection onContact={goToContact} />
        <WhyAgil />
        <FaqSection />
        <ContactSection defaultService={contactService} />
      </main>
      <Footer />
      <WhatsAppFloatingButton />
    </>
  );
}
