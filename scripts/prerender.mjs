// Pré-renderiza as páginas no build: o HTML completo vai para dist/,
// assim buscadores e redes sociais leem o conteúdo sem executar JavaScript.
// Também grava as páginas de serviço (/<slug>/index.html), as páginas Onde já atuamos e Diagnóstico de licitações, o sitemap.xml e o llms.txt.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = path.resolve('dist');
const { render, faqJsonLd, paginasServico, headServico, headOnde, headDiagnostico, sitemapXml, llmsTxt } = await import(
  pathToFileURL(path.resolve('dist-ssr/entry-server.js')).href
);

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

// "Onde já atuamos": órgãos públicos atendidos (src/data/ondeAtuamos.json, gerado por scripts/onde-atuamos.mjs)
{
  const alvo = path.join(dist, 'onde-atuamos/index.html');
  const MARCA = /<!--head-onde-->[\s\S]*?<!--\/head-onde-->/;
  let html = fs.readFileSync(alvo, 'utf8');
  if (!MARCA.test(html) || !html.includes('<!--app-html-->')) throw new Error('onde-atuamos/index.html sem as marcações do modelo');
  html = html.replace(MARCA, () => headOnde()).replace('<!--app-html-->', () => render('onde'));
  fs.writeFileSync(alvo, html);
  console.log('✓ onde-atuamos/index.html pré-renderizado');
}

// "Diagnóstico de licitações": a empresa digita o CNPJ (os dados são carregados no navegador, de prospeccao/cnpj/)
{
  const alvo = path.join(dist, 'diagnostico-licitacoes/index.html');
  const MARCA = /<!--head-diagnostico-->[\s\S]*?<!--\/head-diagnostico-->/;
  let html = fs.readFileSync(alvo, 'utf8');
  if (!MARCA.test(html) || !html.includes('<!--app-html-->')) throw new Error('diagnostico-licitacoes/index.html sem as marcações do modelo');
  html = html.replace(MARCA, () => headDiagnostico()).replace('<!--app-html-->', () => render('diagnostico'));
  fs.writeFileSync(alvo, html);
  console.log('✓ diagnostico-licitacoes/index.html pré-renderizado');
}

fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemapXml(new Date().toISOString().slice(0, 10)));
fs.writeFileSync(path.join(dist, 'llms.txt'), llmsTxt());
console.log('✓ sitemap.xml e llms.txt');

fs.rmSync(path.resolve('dist-ssr'), { recursive: true, force: true });

// Vite copies public files verbatim: keep their asset URLs relative to the deployment base.
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
