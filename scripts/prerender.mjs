// Pré-renderiza as páginas no build: o HTML completo vai para dist/,
// assim buscadores e redes sociais leem o conteúdo sem executar JavaScript.
// Também grava as páginas de serviço (/<slug>/index.html), o sitemap.xml e o llms.txt.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = path.resolve('dist');
const { render, faqJsonLd, paginasServico, headServico, sitemapXml, llmsTxt } = await import(pathToFileURL(path.resolve('dist-ssr/entry-server.js')).href);

for (const [page, file] of [
  ['home', 'index.html'],
  ['licitacoes', 'licitacoes/index.html'],
]) {
  const target = path.join(dist, file);
  let html = fs.readFileSync(target, 'utf8');
  html = html.replace('<!--app-html-->', () => render(page));
  html = html.replace('<!--faq-jsonld-->', () => `<script type="application/ld+json">${faqJsonLd()}</script>`);
  fs.writeFileSync(target, html);
  console.log(`✓ ${file} pré-renderizado`);
}

// Páginas de serviço: uma cópia do modelo servico/index.html para cada página de src/data/paginasServico.ts
const modelo = fs.readFileSync(path.join(dist, 'servico/index.html'), 'utf8');
const MARCA_HEAD = /<!--head-servico-->[\s\S]*?<!--\/head-servico-->/;
if (!MARCA_HEAD.test(modelo) || !modelo.includes('<!--app-html-->')) throw new Error('servico/index.html sem as marcações do modelo');
for (const { slug } of paginasServico()) {
  const html = modelo.replace(MARCA_HEAD, () => headServico(slug)).replace('<!--app-html-->', () => render('servico', slug));
  fs.mkdirSync(path.join(dist, slug), { recursive: true });
  fs.writeFileSync(path.join(dist, slug, 'index.html'), html);
  console.log(`✓ ${slug}/index.html pré-renderizado`);
}
fs.rmSync(path.join(dist, 'servico'), { recursive: true, force: true });

fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemapXml(new Date().toISOString().slice(0, 10)));
fs.writeFileSync(path.join(dist, 'llms.txt'), llmsTxt());
console.log('✓ sitemap.xml e llms.txt');

fs.rmSync(path.resolve('dist-ssr'), { recursive: true, force: true });

// Vite copies public files verbatim: keep their asset URLs relative to the deployment base.
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
