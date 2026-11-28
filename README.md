# Ágil CM — site principal e Licitações

O site institucional ocupa a raiz. O botão **Licitações** no cabeçalho abre a consulta de editais e contratos do PNCP.

| Caminho                        | Conteúdo                                                                                                                                                                                                                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                            | Site principal da Ágil CM                                                                                                                                                                                                                                                                                        |
| `/licitacoes/`                 | Painel de licitações, com as abas na ordem do trabalho: Editais abertos, Ágil CNAE (`#agil-cnae`), Raio-X (`#raio-x`), Contratos (`#contratos`), Meus editais (`#meus-editais`), Possíveis clientes (`#possiveis-clientes`) e Campeões (`#campeoes`). `?busca=texto` abre com a busca feita em toda Minas Gerais |
| `/terceirizacao/`, `/gilrat/`… | Uma página por serviço (9 páginas), geradas no build a partir de `src/data/paginasServico.ts`                                                                                                                                                                                                                    |
| `/onde-atuamos/`               | Onde já atuamos: órgãos públicos em que a Ágil venceu pregão ou dispensa e o tipo de material fornecido (sem valores)                                                                                                                                                                                            |
| `/dados/`                      | Simuladores internos (sem link no site): RH e Simples, pró-labore e regime (Simples × Lucro Presumido)                                                                                                                                                                                                           |
| `/docpref/`                    | DocPref: fiscalização documental dos contratos de um órgão público (painel do órgão, análise mês a mês, parecer e notificação)                                                                                                                                                                                   |
| `/privado/`                    | Área restrita: organiza no Google Drive os termos de homologação/adjudicação e gera relatórios                                                                                                                                                                                                                   |
| `/api/*`                       | Funções de consulta ao PNCP, para hospedagem compatível                                                                                                                                                                                                                                                          |

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

### Possíveis clientes e Campeões

Duas abas do painel de licitações, montadas com as mesmas atas. Campeões é aberta a todos; **Possíveis clientes é só da equipe** (senha do Privado):

- **Possíveis clientes** (`/licitacoes/#possiveis-clientes`): empresas das cidades vizinhas (`src/data/clientesConfig.js`: Cataguases, Miraí, Astolfo Dutra, Dona Euzébia, Leopoldina, Rodeiro, Ubá, Muriaé, Visconde do Rio Branco e Além Paraíba) que disputaram licitações de **Minas Gerais** e ficaram **do 2º ao 5º lugar**, com a licitação, o CNPJ, a cidade da licitação, o item e a colocação. A aba tem **duas listas separadas**: **Licitações na Zona da Mata** e **Licitações em Minas Gerais** (a Zona da Mata incluída, com a opção "Só licitações fora da Zona da Mata"); cada uma tem os próprios números, planilha Excel, diagnóstico e mensagem (que dizem "da Zona da Mata" ou "de Minas Gerais"). O arquivo traz o andamento da leitura das duas (`zonaDaMata`). "Melhor preço, não levou" é quem ofertou menos que a vencedora e perdeu o item (desclassificação, inabilitação ou desistência). Serve para oferecer a assessoria em licitações a quem já participa e perde.
- **Diagnóstico para o primeiro contato:** cada empresa de Possíveis clientes tem o botão **Gerar diagnóstico (PDF)**, no papel da Ágil CM, com o resumo dos últimos 12 meses (itens sem vencer, 2º lugar, perto da vencedora, melhor preço sem levar e quanto as vencedoras levaram nesses itens), os 10 itens em que ela chegou mais perto, o que os números sugerem e como a assessoria ajuda; e o botão **Copiar mensagem para o WhatsApp**, com um texto curto para oferecer o diagnóstico (`src/lib/diagnostico.js`, `tests/diagnostico.test.mjs`).
- **Funil de prospecção:** em cada empresa de Possíveis clientes, a etapa (Mensagem enviada, Respondeu, Diagnóstico enviado, Reunião marcada, Fechou, Não quis), a data para retornar e uma anotação; o filtro "Prospecção" mostra quem está sem contato, em andamento, para retornar hoje, quem fechou e quem não quis. Copiar a mensagem do WhatsApp já põe a empresa em "Mensagem enviada", com retorno em 3 dias. Fica guardado junto com Meus editais (registros `funil:<CNPJ>`, que as telas de editais não mostram), então vai para a planilha da equipe e para a cópia de segurança; a planilha Excel da aba traz as colunas do funil.
- **Aviso de oportunidade no Telegram:** a cada leitura da Prospecção, as empresas das cidades escolhidas que acabaram de perder um item por pouco (até 5% no preço ou 2 pontos no desconto, incluindo empate) ou com o melhor preço, em licitações publicadas há até 60 dias, chegam numa mensagem, separada em "Licitações na Zona da Mata" e "Licitações no resto de Minas Gerais", uma vez por empresa e licitação (`src/lib/oportunidades.js`). Usa os segredos do alerta de editais (`TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`, ou `PROSPECCAO_TELEGRAM_CHAT_ID` para outra conversa).
- **Só para a equipe:** a lista vai para o site cifrada (AES-GCM) em `prospeccao/clientes.bin`, com uma chave tirada da senha do Privado (PBKDF2; `src/lib/cofre.js`). Quem cifra é a publicação do site, com o segredo `PRIVADO_SENHA` (a mesma senha de entrar no Privado); sem ele, a lista não é publicada. Na aba, a equipe digita a senha do Privado (quem já entrou no Privado na mesma aba do navegador abre direto) e "Fechar a lista" tranca de novo. O diagnóstico por CNPJ, que é público, não leva cidade, porte nem atividade, para não dar para remontar a lista por cidade.
- **Quem ligar primeiro:** cada empresa tem uma **nota de 0 a 100** (`notaOportunidade` em `src/lib/diagnostico.js`): itens perdidos por pouco, no empate ou com o melhor preço (até 40), quão recente foi a última disputa (até 25), quanto as vencedoras levaram nesses itens (até 20) e quantas licitações disputou (até 15). Quente: 60 ou mais; morna: 35 a 59. A lista abre em ordem de nota (dá para ordenar por colocações, disputa mais recente ou nome), tem o filtro "Temperatura" e a planilha traz a nota.
- **Motivo para ligar hoje:** o botão "Buscar editais abertos para todas" carrega os editais abertos de Minas (a mesma lista de Editais abertos, guardada por 30 minutos) e cada empresa mostra os que combinam com o que ela disputou (`src/lib/editaisParaEmpresa.js`: palavras frequentes nas licitações da empresa e raras nos editais; na lista da Zona da Mata, só editais da Zona da Mata), com o botão "Copiar mensagem sobre este edital" (`mensagemEdital`).
- **Contato com um clique:** "Buscar telefone e e-mail" consulta o cadastro do CNPJ na Receita na hora, pelo navegador (BrasilAPI e, se falhar, minhareceita.org; `src/lib/contatoCnpj.js`). Celular abre o WhatsApp já com a mensagem. Nada fica gravado no site: a lista publicada continua sem telefone e e-mail.
- **Lembrete da prospecção no Telegram:** de segunda a sexta às 7h23, o workflow **Lembrete da prospecção** (`.github/workflows/funil-retorno.yml`, `scripts/funil-retorno.mjs`, `src/lib/funilAviso.js`) lê o funil na planilha da equipe e manda quem retornar hoje, os retornos atrasados e as 3 empresas mais quentes ainda sem contato. Precisa do segredo `MEUS_EDITAIS_SENHA` (a senha da equipe definida no Apps Script de Meus editais) e, para as mais quentes, de `PRIVADO_SENHA`; usa o mesmo bot e grupo do alerta de editais.
- **Diagnóstico grátis por CNPJ** (`/diagnostico-licitacoes/`, `src/pages/DiagnosticoPage.tsx`): página pública em que qualquer empresa digita o CNPJ e vê, na hora, em quais licitações de Minas dos últimos 12 meses ficou do 2º ao 5º lugar, por quanto perdeu e o que os números sugerem, baixa o PDF e chama a Ágil no WhatsApp. Aceita `?cnpj=` no endereço: a mensagem do WhatsApp de Possíveis clientes já leva o link do diagnóstico da empresa. Os dados vão em `prospeccao/cnpj/<3 primeiros dígitos>.json` (`montarDiagnosticos`/`expandirDiagnostico` em `src/lib/possiveisClientes.js`), de qualquer cidade, em formato enxuto; a página baixa só a parte do CNPJ digitado.
- **Campeões** (`/licitacoes/#campeoes`): quem ganhou e levou cada item nas licitações da **Zona da Mata** (Minas inteira deixaria a lista pesada demais para o celular), de **qualquer cidade**, em ordem de itens ganhos, com o valor levado segundo a ata, os órgãos atendidos e o filtro para ver só as empresas das cidades escolhidas.
- **De onde vem:** o PNCP só registra a vencedora de cada item. A colocação das outras e o valor ganho saem da **Ata Final** que o Portal de Compras Públicas anexa no PNCP depois da sessão, com todas as propostas e lances (`src/lib/ataPcp.js`, que lê também o julgamento por lote). `scripts/possiveis-clientes.mjs` procura as licitações eletrônicas (pregão, concorrência e dispensa) desse portal em Minas Gerais nos últimos 12 meses (consulta oficial do PNCP, por modalidade e quinzena, com até 3 pedidos ao mesmo tempo e 1,5 s entre eles), lê a ata de cada uma começando pelas licitações das cidades escolhidas, depois o resto da Zona da Mata e então o resto de Minas, da mais perto para a mais longe, calcula a colocação por item e consulta a cidade de cada CNPJ que ficou até o 5º lugar no cadastro público da Receita (BrasilAPI e minhareceita.org, duas consultas ao mesmo tempo, e, por último, publica.cnpj.ws, que aceita poucas consultas por minuto); as três partes andam juntas e grava `prospeccao/clientes.bin` (cifrado), `prospeccao/campeoes.json` e as partes do diagnóstico por CNPJ (`src/lib/possiveisClientes.js`).
- **O que fica de fora:** licitações feitas no Compras.gov.br, na Licitar Digital e em outros portais, que não anexam a ata com os lances no PNCP. Pessoas físicas (CPF) não entram e nomes de MEI saem sem os números do CPF.
- **Atualização:** as atas são lidas pelo workflow **Prospecção** (`.github/workflows/prospeccao.yml`), 8 vezes por dia, até 50 minutos por vez, cobrindo os **últimos 12 meses** (`MESES_CLIENTES` em `src/data/clientesConfig.js`); ao terminar, ele publica o site. O que já foi lido fica no cache do Actions (`clientes-cache.json`, gravado também a cada 10 minutos de leitura) e cada leitura continua de onde a anterior parou. A primeira volta por Minas inteira leva alguns dias; depois, cada leitura só pega as quinzenas que ainda estão correndo e as atas novas. Uma licitação sem ata ainda volta a ser procurada no dia seguinte (cidades escolhidas e Zona da Mata) ou em 3 dias (resto de Minas). A publicação do site (de 3 em 3 horas) só remonta as listas a partir desse cache (`CLIENTES_SO_MONTAR=1`). As duas abas mostram o período e quanto já foi lido (atas lidas, fila e quanto da busca no PNCP já foi feito). Para ler na hora: Actions → Prospecção (atas do PNCP) → Run workflow.
- Testes: `tests/possiveisClientes.test.mjs` e `tests/vendas.test.mjs` (nota, editais que combinam, contato, lembrete e diagnóstico por CNPJ).

### Consulta CNPJ

Área própria do site (`/consulta-cnpj/`, botão **Consulta CNPJ** no menu de cima; `src/pages/ConsultaCnpjPage.tsx`), fora dos buscadores, em quatro partes:

- **Consultar um CNPJ:** qualquer empresa do Brasil, na hora, pelo cadastro da Receita (BrasilAPI ou minhareceita.org): situação, abertura, natureza jurídica, porte (MEI e Simples), capital social, todas as atividades, endereço, telefone (WhatsApp no celular) e e-mail, mais o histórico nas atas lidas (as partes públicas do diagnóstico por CNPJ) com o link do diagnóstico; "Copiar os dados" e a etapa do funil de prospecção. Aceita `?cnpj=` no endereço. Os sócios não aparecem.
- **Vários CNPJs:** cola uma lista (de uma planilha, de um e-mail…), até 100 por vez, consultados um a um com uma pausa curta, e baixa em Excel (`cnpjsDoTexto`, `cadastroDaReceita`, `linhasPlanilhaReceita` em `src/lib/consultaCnpj.js`).
- **Empresas da região** (só da equipe, senha do Privado; `src/pages/EmpresasRegiao.tsx`): o cadastro das **empresas ativas das cidades escolhidas** (`src/data/clientesConfig.js`), com telefone, e-mail, endereço, porte, ramo (atividade principal e secundárias) e o que cada uma já disputou nas atas lidas. Busca por CNPJ, nome ou ramo; filtros de cidade, porte, licitações (já disputou / nunca disputou), com telefone e com e-mail; planilha Excel; mensagem pronta (quem já disputa recebe o link do diagnóstico; quem nunca disputou, o convite para vender a prefeituras); etapa do funil.

- **De onde vem:** o `cnpj.db` (cadastro de CNPJ da Receita em SQLite, ~28 GB) no Google Drive, compartilhado por link. O workflow **Cadastro CNPJ** (`.github/workflows/cadastro-cnpj.yml`, `scripts/cadastro-cnpj.mjs`) não baixa o arquivo inteiro: lê em sequência pelo link do Drive, página por página (`src/lib/sqliteFolhas.js`, que entende o formato do SQLite sem o SQLite), acha onde começam os estabelecimentos e os índices sondando algumas páginas, guarda os estabelecimentos ativos das cidades (e o Simples/MEI) e depois as empresas deles. Sócios não são lidos. O resultado (`cadastro-cnpj.json.gz`) fica no cache do Actions; a publicação do site junta o histórico em licitações (`clientes-cache.json`) e grava `prospeccao/cadastro.bin`, cifrado com `PRIVADO_SENHA`.
- **Atualizar:** a Receita publica o cadastro todo mês. Suba o `cnpj.db` novo no Drive, compartilhe por link e rode Actions → **Cadastro CNPJ (Consulta CNPJ)** → Run workflow, com o id do arquivo novo (o trecho entre `/d/` e `/view` do link). Leva uns 20 a 30 minutos e publica o site no fim.
- Testes: `tests/sqliteFolhas.test.mjs` (confere a leitura contra um banco criado pelo SQLite do Node) e `tests/consultaCnpj.test.mjs`.

**CNPJ problemático** (só da equipe, senha do Privado; `src/pages/CnpjProblematico.tsx`): empresas das cidades de `src/data/problematicosConfig.js` (Cataguases, Dona Euzébia, Leopoldina, Astolfo Dutra, Recreio, Ubá, Miraí e Santana de Cataguases) com o **CNPJ inapto** ou **excluídas do Simples ou do MEI** no ano da base da Receita ou no anterior, para oferecer a regularização.

- **O que mostra:** situação encontrada, motivo provável, prioridade, sócios (nome, CPF mascarado como a Receita publica, qualificação, entrada, faixa etária, representante legal) ou o titular do MEI, telefone (WhatsApp com a mensagem pronta), e-mail, endereço, atividades, natureza, porte, capital e as datas do Simples e do MEI. Filtros de situação (inapta, Simples por ano, MEI por ano), cidade, tipo de caso, prioridade, com telefone, com e-mail e sem e-mail de contador; busca por CNPJ, nome, sócio, e-mail ou ramo; planilha Excel com todas as colunas; etapa do funil.
- **Envio pelo WhatsApp:** em cada empresa, "Enviar WhatsApp" para cada telefone (celular primeiro; fixo também, porque muita empresa usa o WhatsApp Business no fixo) abre a conversa com a mensagem pronta (`mensagemProblematico`): cumprimenta o primeiro sócio pessoa física ou o titular do MEI pelo nome, apresenta quem envia ("Seu nome na mensagem", guardado no navegador) como da Ágil CM, empresa de consultoria, diz o problema em negrito, avisa que multas e dívidas podem chegar ao CPF (no MEI e no empresário individual "caem direto no seu CPF"; na sociedade, "podem acabar no seu CPF", porque não é em todo caso) e que a pendência pode atrapalhar pedidos de auxílio ou de seguro-desemprego e a abertura de um MEI ou de outra empresa; para quem saiu do MEI, explica que passa a ter uma declaração por mês (12 por ano) e que, conforme o regime e o faturamento, a multa de cada uma em atraso pode chegar a R$ 500 (o mínimo da DCTFWeb fora do Simples; no Simples, o PGDAS-D tem mínimo de R$ 50); oferece a regularização e termina pedindo para desconsiderar se o número não for da pessoa ou da empresa. Abrir o WhatsApp (ou o e-mail) marca "Já enviei" com a data e põe a empresa no funil de prospecção como "Mensagem enviada", com retorno em 3 dias (vai para a planilha da equipe e para o lembrete do Telegram); dá para desmarcar enquanto estiver nessa etapa. O filtro "Mensagem" separa quem falta e quem já recebeu. A planilha Excel traz "Enviado em", o link "Abrir conversa" (clicável, `{ texto, link }` em `src/lib/xlsx.js`) e o texto da mensagem; marcar o envio na planilha não volta para o site.
- **Motivo provável** (`src/lib/cnpjProblematico.js`): a Receita não publica o motivo da exclusão na base aberta, então ele é deduzido. *Problema*: inapto, saída do MEI e do Simples na mesma data, exclusão do Simples com efeito em 1º de janeiro (exclusão anual de ofício por débitos) ou saída do MEI seguida de exclusão do Simples. *Crescimento*: saiu do MEI e continua no Simples (faturamento, sócio, filial ou atividade). *Verificar*: exclusão no meio do ano. Prioridade alta: problema com telefone ou e-mail que não é de contador.
- **De onde vem:** o workflow **CNPJ problemático** (`.github/workflows/cnpj-problematico.yml`, `scripts/cnpj-problematico.mjs`) tenta primeiro os Dados Abertos do CNPJ direto do servidor da Receita (`arquivos.receitafederal.gov.br`), sem guardar os zips: os 10 arquivos de estabelecimentos ao mesmo tempo, filtrados pelas cidades; depois o Simples; depois empresas e sócios só das empresas com algum caso. **O servidor da Receita não aceita conexões do GitHub**, então no Actions a lista sai do `cnpj.db` do Google Drive (o mesmo do Cadastro CNPJ, que tem as tabelas da Receita, inclusive sócios e Simples), lido em duas passadas pelo link. As duas fontes dão a mesma lista (conferido registro por registro com a base de 11/2026). Mantenha o `cnpj.db` do Drive atualizado todo mês. A lista sai **cifrada com `PRIVADO_SENHA` já na extração** (o repositório é público: nada vai em texto aberto para o cache nem para o log) e fica no cache do Actions; a publicação do site só confere se abre com a senha atual e copia para `prospeccao/problematicos.bin`.
- **Atualizar:** roda sozinho todo dia 22 (a Receita publica uma base por mês) e quando as regras, as cidades ou o workflow mudam no `main`, e pega a base mais recente completa; para rodar na hora, Actions → **CNPJ problemático (Consulta CNPJ)** → Run workflow (dá para escolher a base, `AAAA-MM`). Leva de 30 a 90 minutos e publica o site no fim. Se a senha do Privado mudar, rode de novo. Para testar sem a internet: `CNPJ_LOCAL=<pasta com os zips> CNPJ_BASE=2026-11 PRIVADO_SENHA=... node scripts/cnpj-problematico.mjs`.
- **LGPD:** dados públicos, mas com nomes de pessoas; usar só para oferecer o serviço e tirar da lista quem pedir. Testes: `tests/cnpjProblematico.test.mjs`.

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
