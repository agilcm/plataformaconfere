import { createRoot, hydrateRoot } from 'react-dom/client';
import LicitacoesPage from './pages/LicitacoesPage.tsx';
import './index.css';

const root = document.getElementById('root')!;
if (root.hasChildNodes()) hydrateRoot(root, <LicitacoesPage />);
else createRoot(root).render(<LicitacoesPage />);
