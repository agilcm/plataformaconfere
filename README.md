# Ágil CM — site principal e Documentos

O site institucional ocupa a raiz. O botão **Documentos**, ao lado de **Licitações** no cabeçalho, abre a plataforma Documentos no mesmo domínio.

| Caminho | Conteúdo |
| --- | --- |
| `/` | Site principal da Ágil CM |
| `/licitacoes/` | Consulta de licitações |
| `/documentos/` | Documentos / Gestão de Terceiros, sem login administrativo |
| `/api/*` | Funções de consulta ao PNCP, para hospedagem compatível |

## Desenvolvimento

Requer Node.js 22.12+ (validado com Node.js 24).

```sh
npm ci
npm run dev
```

O código editável do site fica em `src/`; imagens e outros arquivos públicos em `public/`. O Documentos fica em `public/documentos/` e é copiado para `dist/documentos/` durante o build. Edite essa origem, não os arquivos gerados.

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

## Google Drive e documentos

A conexão ao Drive continua pelo OAuth no navegador. Cadastre no Google Cloud a origem exata da hospedagem, sem caminhos, e informe o Client ID em Configurações do Documentos. O sistema mostra a origem atual nessa tela. A autorização feita no domínio antigo não é transferida automaticamente para o novo domínio.

Não há login administrativo, backend documental ou OCR nesta etapa. A leitura de valores, validade e presença de assinatura continua manual. Os relatórios usam os campos conferidos. Os dados demonstrativos aparecem antes de conectar ao Drive; nenhum dado real foi incluído no site.

O envio administrativo pelo Documentos usa a pasta central de dados. As empresas continuam enviando arquivos pelos links das suas pastas no Drive.

Histórico e detalhes: [Documentos](docs/Documentos.md) e [documentação original do site recebido](docs/Site-original.md).

O nome visível da plataforma é **Documentos**. O arquivo `bancodoc-dados.json` e a chave OAuth legada continuam com seus identificadores anteriores para reutilizar os cadastros. Pastas existentes no Google Drive não são renomeadas automaticamente. Novas bases usam a pasta “Documentos”.
