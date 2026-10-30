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

// Contador de visitas (Cloudflare Web Analytics, sem cookies): entra só se o token estiver configurado
// na variável CF_WEB_ANALYTICS_TOKEN do GitHub Actions. As áreas Privado e Dados ficam de fora.
const contadorVisitas = (): Plugin => ({
  name: 'contador-visitas',
  transformIndexHtml(html, ctx) {
    const token = (process.env.CF_WEB_ANALYTICS_TOKEN || '').trim();
    if (!/^[a-f0-9]{32}$/i.test(token) || /privado|dados/.test(ctx.path)) return html;
    return html.replace(
      '</body>',
      `  <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${token}"}'></script>\n  </body>`,
    );
  },
});

export default defineConfig(() => {
  return {
    base: process.env.SITE_BASE_PATH || '/',
    plugins: [react(), tailwindcss(), apiDevServer(), contadorVisitas()],
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
          privado: path.resolve(import.meta.dirname, 'privado/index.html'),
          dados: path.resolve(import.meta.dirname, 'dados/index.html'),
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
