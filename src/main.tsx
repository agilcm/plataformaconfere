import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const root = document.getElementById('root')!;

// O HTML já vem pré-renderizado no build (bom para o Google); aqui o React só "acorda" a página
if (root.hasChildNodes()) hydrateRoot(root, <App />);
else createRoot(root).render(<App />);
