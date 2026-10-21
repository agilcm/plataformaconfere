// Usado apenas no build para gerar o HTML estático das páginas (SEO).
import { renderToString } from 'react-dom/server';
import App from './App.tsx';
import LicitacoesPage from './pages/LicitacoesPage.tsx';
import { FAQ_ITEMS } from './data/faq.ts';

export function render(page: 'home' | 'licitacoes' = 'home') {
  return renderToString(page === 'licitacoes' ? <LicitacoesPage /> : <App />);
}

export function faqJsonLd() {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  });
}
