# Ágil CM — site principal e Licitações

O site institucional ocupa a raiz. O botão **Licitações** no cabeçalho abre a consulta de editais e contratos do PNCP.

| Caminho | Conteúdo |
| --- | --- |
| `/` | Site principal da Ágil CM |
| `/licitacoes/` | Consulta de licitações: Editais abertos, Contratos e AGIL CNAE (`#agil-cnae`) |
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

## AGIL CNAE

A aba AGIL CNAE mostra os mesmos editais abertos, mas só os ligados aos CNAEs da Ágil CM. Os CNAEs e os termos procurados no objeto de cada edital ficam em `src/data/agilCnaes.js`; para incluir um CNAE ou ajustar um termo, edite esse arquivo.

Histórico e detalhes: [documentação original do site recebido](docs/Site-original.md).

## Publicar pelo GitHub Pages

1. No GitHub, abra **Settings → Pages** e selecione **GitHub Actions** em **Source**.
2. Abra **Actions → Publicar site no GitHub Pages → Run workflow** e execute na branch `main`.
3. Aguarde o job `deploy` concluir e use o endereço exibido no ambiente `github-pages`.

O workflow `.github/workflows/pages.yml` também publica novos pushes em `main`. Ele obtém o caminho configurado pelo Pages, portanto suporta renomear o repositório e hospedar em um subdiretório sem quebrar os links de Licitações ou imagens. O endereço padrão depende do nome atual do repositório; não é confirmado até o deploy terminar.

No Pages, `VITE_STATIC_HOST=true` ignora as funções `/api/` inexistentes nessa hospedagem e usa o acesso direto ao PNCP. A disponibilidade dessas consultas depende do PNCP e de CORS.
