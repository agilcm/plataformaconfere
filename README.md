# Ágil CM — site principal e Licitações

O site institucional ocupa a raiz. O botão **Licitações** no cabeçalho abre a consulta de editais e contratos do PNCP.

| Caminho | Conteúdo |
| --- | --- |
| `/` | Site principal da Ágil CM |
| `/licitacoes/` | Consulta de licitações: Editais abertos, Contratos e AGIL CNAE (`#agil-cnae`) |
| `/privado/` | Área restrita: organiza no Google Drive os termos de homologação/adjudicação e gera relatórios |
| `/api/*` | Funções de consulta ao PNCP, para hospedagem compatível |

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

## Hospedagem

O arquivo `vercel.json` configura a Vercel para executar o build e servir `dist/`, com as funções da pasta `api/`. Publicar exige acesso à conta de hospedagem; salvar os arquivos no GitHub não publica automaticamente sem uma integração de deploy configurada.

Hospedagens exclusivamente estáticas não executam `/api/*`; nesse caso, as consultas de licitações dependem da alternativa de acesso direto ao PNCP e das permissões CORS desse serviço.

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
