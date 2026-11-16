# Ágil CM — site principal e Licitações

O site institucional ocupa a raiz. O botão **Licitações** no cabeçalho abre a consulta de editais e contratos do PNCP.

| Caminho                        | Conteúdo                                                                                                                                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                            | Site principal da Ágil CM                                                                                                                                                                                                                    |
| `/licitacoes/`                 | Painel de licitações, com as abas na ordem do trabalho: Editais abertos, Ágil CNAE (`#agil-cnae`), Raio-X (`#raio-x`), Contratos (`#contratos`) e Meus editais (`#meus-editais`). `?busca=texto` abre com a busca feita em toda Minas Gerais |
| `/terceirizacao/`, `/gilrat/`… | Uma página por serviço (9 páginas), geradas no build a partir de `src/data/paginasServico.ts`                                                                                                                                                |
| `/onde-atuamos/`               | Onde já atuamos: órgãos públicos em que a Ágil venceu pregão ou dispensa e o tipo de material fornecido (sem valores)                                                                                                                        |
| `/dados/`                      | Simuladores internos (sem link no site): RH e Simples, pró-labore e regime (Simples × Lucro Presumido)                                                                                                                                       |
| `/docpref/`                    | DocPref: fiscalização documental dos contratos de um órgão público (painel do órgão, análise mês a mês, parecer e notificação)                                                                                                               |
| `/privado/`                    | Área restrita: organiza no Google Drive os termos de homologação/adjudicação e gera relatórios                                                                                                                                               |
| `/api/*`                       | Funções de consulta ao PNCP, para hospedagem compatível                                                                                                                                                                                      |

## Desenvolvimento

Requer Node.js 22.12+ (validado com Node.js 24).

```sh
npm ci
npm run dev
```

O código editável do site fica em `src/`; imagens e outros arquivos públicos em `public/`. Edite essa origem, não os arquivos gerados em `dist/`.

```sh
npm test
npm run lint
npm run build
npm run preview -- --host 0.0.0.0
```

O build gera o site completo em `dist/`, com a página principal e Licitações pré-renderizadas.

## Google e assistentes de IA (SEO)

- **Endereço oficial:** `https://www.agilcm.com.br` (o endereço sem `www` redireciona para ele). Canônico, Open Graph, dados estruturados, sitemap e `robots.txt` usam sempre o `www`; o valor fica em `COMPANY_PROFILE.siteUrl`.
- **Páginas de serviço:** cada serviço tem a sua página, com título, descrição, H1, conteúdo, perguntas frequentes e dados estruturados (`Service`, `BreadcrumbList`, `FAQPage`). Para criar ou editar uma página, mexa só em `src/data/paginasServico.ts`; o build copia o modelo `servico/index.html` para `/<slug>/index.html` (`scripts/prerender.mjs`). Os textos repetem o que a empresa já afirma na página inicial: não invente números, prazos ou certificações.
- **Onde já atuamos** (`/onde-atuamos/`): página pública com os órgãos em que a Ágil venceu, por município, e o tipo de material fornecido. O resumo fica em `src/data/ondeAtuamos.json` e é refeito em cada publicação por `scripts/onde-atuamos.mjs`, a partir da leitura da área Privado (`privado/leitura.json`). Saem só órgão, município, ano, modalidade, objeto e tipo de material: **nunca valores, quantidades, preços ou links da pasta** (`tests/ondeAtuamos.test.mjs` confere). Os tipos de material são reconhecidos por palavras no começo da descrição de cada item (`CATEGORIAS` em `src/lib/ondeAtuamos.js`). Se a leitura falhar, vale o resumo que está no repositório.
- **Gerados no build:** `sitemap.xml` (só as páginas públicas) e `llms.txt` (a empresa em texto simples para assistentes de IA), a partir dos mesmos dados.
- **Áreas internas** (`/privado/`, `/dados/`, `/docpref/`, `/eleicao/`): levam `noindex` na própria página e ficam fora do sitemap. Não as liste no `robots.txt`.
- **Fontes e logos:** as fontes ficam em `public/fonts/` (sem Google Fonts) e o site usa os logos `.webp`; os `.png` continuam para os PDFs.
- **Conferência:** `tests/paginasServico.test.mjs` confere tamanho de título e descrição e os links internos.

## Hospedagem

O arquivo `vercel.json` configura a Vercel para executar o build e servir `dist/`, com as funções da pasta `api/`. Publicar exige acesso à conta de hospedagem; salvar os arquivos no GitHub não publica automaticamente sem uma integração de deploy configurada.

Hospedagens exclusivamente estáticas não executam `/api/*`; nesse caso, as consultas de licitações dependem da alternativa de acesso direto ao PNCP e das permissões CORS desse serviço.

## Dados (simuladores internos)

`/dados/` não tem link no site nem aparece em buscadores. Abas: **Simulador de RH** (custo de um funcionário), **Simples, pró-labore e regime** (pró-labore sempre; marcando "Calcular sobre o faturamento", a projeção do Simples em 12 meses com RBT12 móvel, empresa nova e faturamento mês a mês, Fator R e a conta para conferir; marcando "Comparar regime", Simples × Lucro Presumido com alíquotas padrão editáveis; exporta Excel), **Hora** (escala por mês e cidade, conferida em 40, 42 ou 44 horas) e **Dona Euzébia**. Os parâmetros de cada ano ficam em `src/data/parametrosFiscais.js` e as atividades em `src/data/atividadesFiscais.js`.

## Painel de licitações (`/licitacoes/`)

- **Abas na ordem do trabalho:** 1 Encontrar (Editais abertos), 2 Filtrar pelo ramo (Ágil CNAE), 3 Analisar (Raio-X), 4 Pesquisar preços (Contratos) e 5 Acompanhar (Meus editais).
- **Lista ou cartões:** os editais aparecem em lista compacta (padrão em tela larga) ou em cartões (padrão no celular); a escolha fica guardada no navegador (`agilcm:editais:visao`).
- **Seu acompanhamento:** com editais salvos em disputa, uma faixa abaixo das abas mostra quantos são, quantos encerram em até 3 dias e o próximo prazo.
- **Privado → editais do órgão:** em `/privado/`, "O que fazer agora" lista os registros que vencem em até 60 dias ou venceram há até 30 (`providenciasGanhas` em `src/lib/privado/relatorios.js`), com o atalho "Editais abertos do órgão", que abre `/licitacoes/?busca=<órgão>`.

## DocPref (fiscalização documental de contratos)

`/docpref/` é a ferramenta do órgão público que contrata serviços com mão de obra: o órgão (contratante) confere todo mês os documentos trabalhistas, previdenciários e do FGTS de cada contratada (Lei nº 14.133/2021, arts. 50, 117 e 121).

- **Painel do órgão** (abre primeiro): contratos acompanhados, meses com pagamento liberado, condicionado e aguardando documentos, certidões vencidas, a lista "O que fazer agora" (`providencias` em `src/lib/docpref.js`), o farol dos contratos e os vencimentos.
- **Contratos e meses:** a análise de cada mês começa pelo quadro "Parecer do mês", com as ações: parecer para o processo de pagamento (`blocosParecer`), notificação à contratada, relatório completo e Excel. A conferência dos documentos tem filtro (tudo, falta, recebido).
- **Órgão e contratos:** dados do órgão contratante (nome, CNPJ, secretaria, gestor, município) e de cada contrato (contratada, objeto, fiscal, prazo, início). Ficam no navegador; "Baixar cópia" leva a outro computador. As contratadas lidas na pasta e ainda sem cadastro aparecem com o botão "Completar cadastro"; as conferências já feitas passam para o cadastro novo. O município do órgão vai na linha de data dos PDFs. O parecer e a notificação (assinados pelo fiscal) saem no papel do órgão, com o nome dele no cabeçalho e sem o timbre da Ágil CM, quando o nome do órgão está preenchido; a opção "Papel do parecer e da notificação" volta ao timbre da Ágil. Os relatórios de análise ficam no papel da Ágil (`timbre` em `buildPdf`, `src/lib/pdfBuild.ts`).
- **Orientações à contratada, Manual do fiscal e Base legal e funcionamento:** a cartilha e os modelos para a contratada, o manual de quem fiscaliza e o resumo dos artigos da lei.
- **Semáforo:** Pagamento liberado, Aguardando documentos (prazo aberto) e Pagamento condicionado (prazo encerrado com pendência; art. 121, § 3º, II, quando previsto no edital ou no contrato).
- **Planilha do órgão (opcional):** sem ela, cadastro e conferências ficam só no navegador de cada fiscal. Com ela, ficam numa planilha Google do órgão e todos os fiscais veem as mesmas marcações. Para criar: uma planilha nova → Extensões → Apps Script → colar `scripts/apps-script/docpref.gs` → trocar a `SENHA` → Implantar como App da Web (executar como "Eu", acesso "Qualquer pessoa"). Cada fiscal cola o endereço `/exec` e a senha em Órgão e contratos → Conectar a planilha. Para o endereço já vir preenchido para todos, coloque-o em `DOCPREF_URL` (`src/lib/docprefStore.ts`); a senha nunca vai para o repositório. Cada parte dos dados é uma linha da planilha (órgão, contrato, conferência do mês, ajuste) e vale sempre a mudança mais recente (`src/lib/docprefSinc.js`, `tests/docprefSinc.test.mjs`).
- **Aviso no Telegram** (`.github/workflows/docpref-alerta.yml`, `scripts/docpref-alerta.mjs`): toda manhã, 5 dias antes, 2 dias antes e no dia do prazo, lista as contratadas que ainda não enviaram tudo do mês; no dia seguinte ao prazo, os meses que passaram a "Pagamento condicionado". Usa os segredos `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` (ou `DOCPREF_TELEGRAM_CHAT_ID`, para mandar a outra conversa). Com os segredos `DOCPREF_PLANILHA_URL` e `DOCPREF_PLANILHA_SENHA`, o aviso também usa o cadastro (dia do prazo, início do contrato) e as conferências da planilha do órgão; sem eles, vale o prazo padrão (último dia do mês seguinte). Em Actions → Aviso do DocPref → Run workflow, a opção "teste" manda uma prévia da situação de hoje.
- A leitura da pasta do Drive vem de `docpref/leitura.json`, gerado no GitHub Actions (`scripts/docpref-dados.mjs`); o ID da pasta fica só no segredo `DOCPREF_PASTA_ID`.

## Eleições em dados

`/eleicao/` não aparece em nenhum menu: abre só pelo endereço direto (o antigo `/dados/eleicao/` redireciona para lá). Mostra os dados do TSE (1º turno de 2020, 2022, 2024 e 2026) de Astolfo Dutra, Dona Euzébia e Cataguases: resultado por cargo (votos válidos, legenda, brancos e nulos), partidos, votos por local e por seção com o local onde cada candidato é mais forte, comparecimento (sem as seções agregadas, que votam junto com outra), perfil do eleitorado e histórico do candidato entre eleições. Relatórios: Excel completo, PDF do resultado (por ano ou todos os anos) e Excel dos candidatos escolhidos por seção.

Os dados ficam em `public/dados-eleicao/eleicoes-mg.dat` (JSON em gzip). Para atualizar ou incluir municípios, recorte os CSVs do TSE (perfil_eleitor_secao, detalhe_votacao_secao e bweb_1t de cada ano) e rode `python3 scripts/eleicoes/gerar-dados.py --input-dir <pasta>`; os municípios ficam em `CITY_NAMES` no script.

## Contador de visitas

O build inclui o Cloudflare Web Analytics (sem cookies) quando a variável `CF_WEB_ANALYTICS_TOKEN` está definida em **Settings → Secrets and variables → Actions → Variables**. Ele entra na página inicial e em Licitações; a área Privado fica de fora. Sem a variável, nada é incluído.

## Monitor de pregões (Telegram)

O workflow `.github/workflows/monitor-pregoes.yml` roda `scripts/monitor-pregoes.mjs` a cada 5 minutos e avisa no Telegram quando, num pregão acompanhado, a situação da compra muda (suspensa, revogada…), um item muda de situação ou ganha resultado (destacando quando a AGIL vence) ou sai documento novo (esclarecimento, impugnação, ata…). Os dados vêm da API pública do PNCP. O chat do pregoeiro não entra: no Compras.gov.br ele só existe para o fornecedor logado, e o acompanhamento público exige hCaptcha.

Configuração em **Settings → Secrets and variables → Actions**:

- variável `MONITOR_PREGOES`: um pregão por linha (link do PNCP, número de controle ou CNPJ/ANO/SEQ), com apelido opcional depois;
- segredos `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`.

Em **Actions → Monitorar pregões → Run workflow**, marque "teste" para mandar uma mensagem de teste. O GitHub pode atrasar execuções agendadas e as pausa após 60 dias sem commits no repositório.

## Filtro por CNAE

Em Editais abertos, o botão **CNAE** permite escolher qualquer CNAE do catálogo (`src/lib/catalogoCnae.js`): os 19 CNAEs da Ágil CM e cerca de 80 grupos de CNAE de `src/lib/sugestoes.js`, buscando pelo código (com ou sem pontuação) ou pela atividade. Só aparecem os editais cujo objeto tem os termos desses CNAEs. A escolha fica salva no navegador.

## Local do pregão

Cada edital mostra o **local do pregão**, a plataforma onde acontece a disputa (BNC, Licitanet, Portal de Compras Públicas, AMM Licita…), tirada do link da plataforma informado no PNCP; quando a modalidade é presencial, aparece "Presencial (no órgão)". Sem link, usa a plataforma que publicou o edital. O botão **Local do pregão** filtra por ela.

## Exportar Excel

Em Editais abertos e em AGIL CNAE, o botão **Exportar Excel** baixa um .xlsx com os editais da lista (com os filtros atuais, não só os que já apareceram na tela). A aba **Editais** tem as informações básicas; a aba **Itens** tem uma linha por item de cada pregão (número, órgão, data, item, quantidade, valor unitário e total estimados), repetindo os dados do pregão em cada linha, sem células mescladas. Os itens são consultados no PNCP na hora: com muitos editais, leva alguns minutos.

## Super Sugestão

Na aba AGIL CNAE, o botão **Super Sugestão** cruza os editais abertos de MG com o histórico do que a AGIL já ganhou: mesma cidade e mesmo produto (alerta vermelho), mesma cidade e mesma categoria (amarelo) e mesmo produto em outra cidade. O Excel da Super Sugestão tem duas abas: **Mesma cidade** (mesmo produto e mesma categoria) e **Outras cidades** (mesmo produto). O histórico é gravado neste navegador quando a área Privado lê a pasta do Drive; ele nunca vai para o código do site. As categorias ficam em `src/data/categoriasProdutos.js`. Para não depender do login Google em outro computador, baixe o cache na área Privado (**Baixar cache**) e use **Importar cache** na Super Sugestão.

## AGIL CNAE

A aba AGIL CNAE mostra os mesmos editais abertos, mas só os ligados aos CNAEs da Ágil CM. Os CNAEs e os termos procurados no objeto de cada edital ficam em `src/data/agilCnaes.js`; para incluir um CNAE ou ajustar um termo, edite esse arquivo.

## Privado

A página `/privado/` pede o login da tela e depois o login Google da conta dona da pasta `Licitacoes - Agil`. Tudo roda no navegador: os PDFs são baixados do Drive e lidos com pdf.js, sem servidor.

- **Organizar pastas** cria `Órgão/Processo NNN-AAAA - Modalidade NNN-AAAA/`, renomeia os termos de homologação e adjudicação para `Processo NNN-AAAA - Termo de Homologação.pdf` e leva o resto da pasta original para `Outros` dentro do processo. Arquivos soltos que não são termos vão para `Outros` na raiz. Nada é apagado, e **Desfazer a última organização** devolve tudo ao lugar.
- Pastas sem termo de homologação ou adjudicação ficam onde estão e aparecem em vermelho.
- Validade: a homologação vale 1 ano. Processos que vencem nos próximos 60 dias aparecem em amarelo, e os vencidos em vermelho (também nos produtos e nas planilhas).
- Relatórios: PDF consolidado e planilhas (CSV para Excel) de processos, itens ganhos e produtos somados.
- A leitura de cada PDF fica guardada em `_agil-dados.json` na pasta, junto com o histórico para desfazer.

Configuração em `src/data/privadoConfig.ts`: `GOOGLE_CLIENT_ID` (ID do cliente OAuth "Aplicativo da Web" com a origem do site autorizada e a Google Drive API ativada) e o ID da pasta. O login da tela guarda só o hash PBKDF2 de e-mail e senha; num site estático ele apenas esconde a tela, e quem protege os documentos é a permissão da conta Google na pasta. Para trocar a senha, gere um novo hash:

```sh
node -e "const c=require('crypto'),s=c.randomBytes(16).toString('hex');console.log(s,c.pbkdf2Sync('EMAIL\nSENHA',Buffer.from(s,'hex'),210000,32,'sha256').toString('hex'))"
```

O leitor de termos está em `src/lib/privado/termo.js` (formato AMM Licita / Licitar Digital); o planejamento das pastas, em `src/lib/privado/plano.js`.

Histórico e detalhes: [documentação original do site recebido](docs/Site-original.md).

## Publicar pelo GitHub Pages

1. No GitHub, abra **Settings → Pages** e selecione **GitHub Actions** em **Source**.
2. Abra **Actions → Publicar site no GitHub Pages → Run workflow** e execute na branch `main`.
3. Aguarde o job `deploy` concluir e use o endereço exibido no ambiente `github-pages`.

O workflow `.github/workflows/pages.yml` também publica novos pushes em `main`. Ele obtém o caminho configurado pelo Pages, portanto suporta renomear o repositório e hospedar em um subdiretório sem quebrar os links de Licitações ou imagens. O endereço padrão depende do nome atual do repositório; não é confirmado até o deploy terminar.

No Pages, `VITE_STATIC_HOST=true` ignora as funções `/api/` inexistentes nessa hospedagem e usa o acesso direto ao PNCP. A disponibilidade dessas consultas depende do PNCP e de CORS.
