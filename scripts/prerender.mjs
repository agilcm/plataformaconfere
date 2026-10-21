// Pré-renderiza as páginas no build: o HTML completo vai para dist/,
// assim buscadores e redes sociais leem o conteúdo sem executar JavaScript.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = path.resolve('dist');
const { render, faqJsonLd } = await import(pathToFileURL(path.resolve('dist-ssr/entry-server.js')).href);

for (const [page, file] of [
  ['home', 'index.html'],
  ['licitacoes', 'licitacoes/index.html'],
]) {
  const target = path.join(dist, file);
  let html = fs.readFileSync(target, 'utf8');
  html = html.replace('<!--app-html-->', render(page));
  html = html.replace('<!--faq-jsonld-->', `<script type="application/ld+json">${faqJsonLd()}</script>`);
  fs.writeFileSync(target, html);
  console.log(`✓ ${file} pré-renderizado`);
}
fs.rmSync(path.resolve('dist-ssr'), { recursive: true, force: true });
