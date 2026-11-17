import { createRoot, hydrateRoot } from 'react-dom/client';
import DiagnosticoPage from './pages/DiagnosticoPage.tsx';
import './index.css';

const root = document.getElementById('root')!;
if (root.hasChildNodes()) hydrateRoot(root, <DiagnosticoPage />);
else createRoot(root).render(<DiagnosticoPage />);
