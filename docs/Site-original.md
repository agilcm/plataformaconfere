# Ágil CM — Site Institucional

Site da Ágil CM Soluções Integradas (React 19 + Vite + Tailwind CSS 4), com pré-renderização do HTML para SEO.

## Rodar localmente

Pré-requisito: Node.js 20 ou superior.

```bash
npm install
npm run dev      # abre em http://localhost:3000
```

## Publicar

```bash
npm run build    # gera a pasta dist/ já com o HTML completo pré-renderizado
```

Envie o conteúdo de `dist/` para a hospedagem (Vercel, Netlify, Hostinger, Cloudflare Pages etc.).
Depois de publicar, cadastre o site no **Google Search Console** e envie o endereço `https://agilcm.com.br/sitemap.xml`.

## Formulários de e-mail

Os botões "Enviar por e-mail" usam o [FormSubmit](https://formsubmit.co), sem servidor próprio.
A mensagem chega em contato@agilcm.com.br e uma cópia vai para o e-mail que o visitante digitou.

**Ativação (uma vez só):** depois de publicar o site, faça um envio de teste. O FormSubmit manda um e-mail
para contato@agilcm.com.br com o botão **Activate Form**. Clique nele e os próximos envios chegam normalmente.

## Onde editar

| O quê | Arquivo |
| --- | --- |
| Telefone, e-mail, CNPJ, cidade | `src/data/servicesData.ts` → `COMPANY_PROFILE` |
| 3 quadros de Terceirização | `src/data/servicesData.ts` → `OPERATIONAL_GROUPS` |
| Serviços de consultoria | `src/data/servicesData.ts` → `CONSULTING_SERVICES` |
| Perguntas frequentes (também vão para o Google) | `src/data/faq.ts` |
| Valores do simulador de orçamento | `src/components/QuoteCalculator.tsx` → `baseServiceRates` |
| Regras do simulador de DP | `src/data/laborCost.ts` |
| Layout dos PDFs | `src/lib/pdfReport.ts` e `src/lib/reports.ts` |
| Título, descrição e dados para o Google | `index.html` |
| Imagens e logo | `public/images/` e `public/brand/` |

## Página de licitações (/licitacoes/)

Usa a API pública do PNCP (pncp.gov.br) em duas abas:

- **Editais abertos:** todos os editais recebendo propostas em MG, ordenados pela última atualização, com filtro
  da Zona da Mata (142 municípios fixos em `src/data/zonaDaMata.js`) e por microrregião. Cada edital abre os
  itens e os documentos (edital, termo de referência…).
- **CONTRATOS:** pesquise um produto e veja qual prefeitura comprou, a descrição/modelo pedido, quantidade,
  valor estimado, valor pago (homologado) e o fornecedor vencedor, com menor/médio/maior preço.

- **Botão Fonte (na aba de editais):** cada edital mostra a plataforma que o publicou no PNCP (campo
  `usuario_nome`, o mesmo "Fonte:" do site do PNCP — ex.: Compras.gov.br, Licitar Digital, Licitanet, Portal de
  Compras Públicas). O botão lista as fontes com a quantidade de editais e permite marcar quais mostrar; a escolha
  fica lembrada no aparelho. Nomes de empresas são trocados pelo nome da plataforma em `FONTES_CONHECIDAS`
  (`src/lib/pncp.js`). API: `/api/editais?fontes=Licitanet|Compras.gov.br` e `/api/editais?facetas=1`.
- **Botão Sugestão (na aba de editais):** o escritório escolhe o CSV do "Cadastro geral" do Alterdata e o site
  gera um PDF (layout Ágil CM) dizendo qual empresa da carteira pode disputar qual edital aberto. O cruzamento usa
  o CNAE principal x o texto do objeto, e dá mais nota para editais perto da empresa (mesma cidade, microrregião,
  Zona da Mata). **O CSV é lido só no navegador** (nada é enviado nem salvo — LGPD). As regras CNAE → termos
  ficam em `src/lib/sugestoes.js` (`CNAE_RULES`, `EXCLUIDOS`) e podem ser ajustadas à vontade.

Funções de servidor (Vercel, pasta `api/`): `editais` (com `?todos=1` para a lista completa usada pela Sugestão),
`contratos` e `compra`.

**Quando o PNCP falha** (acontece com frequência):
1. cada chamada tem tempo limite e até 3 novas tentativas com espera crescente;
2. o servidor guarda as respostas em cache e, se o PNCP cair, entrega a última resposta boa com aviso;
3. sem servidor, o navegador consulta o PNCP direto;
4. se nada responder, a página mostra a última consulta salva no aparelho do visitante, com aviso e botão
   "Tentar novamente";
5. uma compra cujos itens não carregam aparece só com o valor do contrato, sem derrubar a lista.

Hospedagem recomendada: **Vercel** (o `vercel.json` já está configurado).
