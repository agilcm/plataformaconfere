// Usado apenas no build para gerar o HTML estático das páginas (SEO): o corpo de cada página, o <head> das páginas de
// serviço (título, descrição, canônico e dados estruturados), o sitemap.xml e o llms.txt.
import { renderToString } from 'react-dom/server';
import App from './App.tsx';
import LicitacoesPage from './pages/LicitacoesPage.tsx';
import ServicoPage from './pages/ServicoPage.tsx';
import { FAQ_ITEMS } from './data/faq.ts';
import { COMPANY_PROFILE } from './data/servicesData.ts';
import { PAGINAS_SERVICO, paginaServico } from './data/paginasServico.ts';

const SITE = COMPANY_PROFILE.siteUrl;
const EMPRESA = 'Ágil CM Soluções Integradas';
const urlServico = (slug: string) => `${SITE}/${slug}/`;

export function render(page: 'home' | 'licitacoes' | 'servico' = 'home', slug = '') {
  if (page === 'servico') {
    const pagina = paginaServico(slug);
    if (!pagina) throw new Error(`Página de serviço desconhecida: ${slug}`);
    return renderToString(<ServicoPage pagina={pagina} />);
  }
  return renderToString(page === 'licitacoes' ? <LicitacoesPage /> : <App />);
}

const faqPage = (itens: { q: string; a: string }[]) => ({
  '@type': 'FAQPage',
  mainEntity: itens.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});

export function faqJsonLd() {
  return JSON.stringify({ '@context': 'https://schema.org', ...faqPage(FAQ_ITEMS) });
}

/** Páginas de serviço que o build grava em /<slug>/index.html */
export const paginasServico = () => PAGINAS_SERVICO.map((p) => ({ slug: p.slug, atualizado: p.atualizado }));

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// dentro de <script>, "<" vira \u003c para o texto nunca fechar a tag
const jsonLd = (dados: unknown) => `<script type="application/ld+json">${JSON.stringify(dados).replace(/</g, '\\u003c')}</script>`;

/** <head> de uma página de serviço: título, descrição, canônico, Open Graph e dados estruturados do que está na página */
export function headServico(slug: string) {
  const p = paginaServico(slug);
  if (!p) throw new Error(`Página de serviço desconhecida: ${slug}`);
  const url = urlServico(p.slug);
  const imagem = `${SITE}/images/og-image.jpg`;
  const dados = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: p.nav, item: url },
        ],
      },
      {
        '@type': ['Organization', 'ProfessionalService'],
        '@id': `${SITE}/#empresa`,
        name: EMPRESA,
        url: `${SITE}/`,
        logo: `${SITE}/brand/logo-completo.png`,
        image: imagem,
        telephone: '+55 32 99921-7912',
        email: COMPANY_PROFILE.email,
        address: {
          '@type': 'PostalAddress',
          streetAddress: `${COMPANY_PROFILE.street} - ${COMPANY_PROFILE.district}`,
          addressLocality: COMPANY_PROFILE.cityShort,
          addressRegion: 'MG',
          postalCode: COMPANY_PROFILE.postalCode,
          addressCountry: 'BR',
        },
      },
      {
        '@type': 'Service',
        '@id': `${url}#servico`,
        name: p.h1,
        serviceType: p.nav,
        description: p.description,
        url,
        provider: { '@id': `${SITE}/#empresa` },
        areaServed: [
          { '@type': 'State', name: 'Minas Gerais' },
          { '@type': 'State', name: 'Rio de Janeiro' },
          { '@type': 'State', name: 'São Paulo' },
        ],
      },
      faqPage(p.faq),
    ],
  };
  return [
    `<title>${esc(p.title)}</title>`,
    `<meta name="description" content="${esc(p.description)}" />`,
    '<meta name="robots" content="index, follow, max-image-preview:large" />',
    `<link rel="canonical" href="${url}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:locale" content="pt_BR" />',
    `<meta property="og:site_name" content="${EMPRESA}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${esc(p.title)}" />`,
    `<meta property="og:description" content="${esc(p.description)}" />`,
    `<meta property="og:image" content="${imagem}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${EMPRESA}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(p.title)}" />`,
    `<meta name="twitter:description" content="${esc(p.description)}" />`,
    `<meta name="twitter:image" content="${imagem}" />`,
    jsonLd(dados),
  ].join('\n    ');
}

/** sitemap.xml com as páginas públicas (as áreas internas ficam de fora) */
export function sitemapXml(hoje: string) {
  const urls = [
    { loc: `${SITE}/`, lastmod: hoje },
    { loc: `${SITE}/licitacoes/`, lastmod: hoje },
    ...PAGINAS_SERVICO.map((p) => ({ loc: urlServico(p.slug), lastmod: p.atualizado })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n  </url>`).join('\n')}
</urlset>
`;
}

/** llms.txt: a empresa em texto simples, para assistentes de IA lerem os fatos certos (só o que já está no site) */
export function llmsTxt() {
  return `# ${EMPRESA}

> Terceirização de limpeza, portaria e manutenção urbana, fornecimento de suprimentos, assessoria em licitações, folha de pagamento, RH e consultoria tributária para empresas e prefeituras. Sede em ${COMPANY_PROFILE.city}, na ${COMPANY_PROFILE.region}.

## O que fazemos
${PAGINAS_SERVICO.map((p) => `- [${p.nav}](${urlServico(p.slug)}): ${p.description}`).join('\n')}

## Onde atendemos
Sede em ${COMPANY_PROFILE.city} (${COMPANY_PROFILE.region}). ${COMPANY_PROFILE.coverage}

## Horário de atendimento
Segunda a sexta, das 8h às 18h.

## Contato
- Endereço: ${COMPANY_PROFILE.street} - ${COMPANY_PROFILE.district}, ${COMPANY_PROFILE.cityShort} - MG, ${COMPANY_PROFILE.postalCode}
- WhatsApp e telefone: ${COMPANY_PROFILE.phoneDisplay}
- E-mail: ${COMPANY_PROFILE.email}
- CNPJ: ${COMPANY_PROFILE.cnpj}

## Páginas principais
- [Página inicial](${SITE}/): todos os serviços, pedido de orçamento e contato
- [Painel de licitações de Minas Gerais](${SITE}/licitacoes/): editais abertos e contratos das prefeituras, com dados oficiais do PNCP e foco na Zona da Mata

## Perguntas frequentes
${FAQ_ITEMS.map((f) => `### ${f.q}\n${f.a}`).join('\n\n')}
`;
}
