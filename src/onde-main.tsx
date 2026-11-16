import { createRoot, hydrateRoot } from 'react-dom/client';
import OndeAtuamosPage from './pages/OndeAtuamosPage.tsx';
import './index.css';

const root = document.getElementById('root')!;
if (root.hasChildNodes()) hydrateRoot(root, <OndeAtuamosPage />);
else createRoot(root).render(<OndeAtuamosPage />);
