import { createRoot, hydrateRoot } from 'react-dom/client';
import ServicoPage from './pages/ServicoPage.tsx';
import { PAGINAS_SERVICO, paginaServico } from './data/paginasServico.ts';
import './index.css';

// A página é escolhida pelo endereço (/gilrat/ → "gilrat"); no modelo aberto direto, por ?p=gilrat
const slug = new URLSearchParams(window.location.search).get('p') || window.location.pathname.split('/').filter(Boolean).pop() || '';
const pagina = paginaServico(slug) ?? PAGINAS_SERVICO[0];

const root = document.getElementById('root')!;
if (root.hasChildNodes()) hydrateRoot(root, <ServicoPage pagina={pagina} />);
else createRoot(root).render(<ServicoPage pagina={pagina} />);
