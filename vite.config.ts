import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

// Em desenvolvimento (npm run dev), atende /api/* com as mesmas funções usadas na Vercel
const apiDevServer = (): Plugin => ({
  name: 'api-dev-server',
  configureServer(server) {
    for (const name of ['editais', 'contratos', 'compra']) {
      server.middlewares.use(`/api/${name}`, async (req, res) => {
        const mod = await server.ssrLoadModule(`/api/${name}.js`);
        await mod.default(req, res);
      });
    }
  },
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiDevServer()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(import.meta.dirname, 'index.html'),
          licitacoes: path.resolve(import.meta.dirname, 'licitacoes/index.html'),
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
