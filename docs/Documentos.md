# Documentos

> Cópia do pacote estático do Documentos publicado na versão 4. Este repositório contém o frontend em `dist/`; não contém backend nem OCR, e alterações aqui não atualizam automaticamente o site publicado. Site atual: https://gestao-de-terceiros.elizangelay2.chatgpt.site.

Portal para o administrador acompanhar documentos recebidos diretamente nas pastas das empresas no Google Drive.

## Fluxo

1. Configure um projeto OAuth da Google Drive API, com a origem autorizada `https://gestao-de-terceiros.elizangelay2.chatgpt.site`.
2. Informe o Client ID em Configurações e conecte a conta proprietária do Drive.
3. Compartilhe uma pasta separada com cada empresa, com permissão para adicionar arquivos. Não compartilhe a pasta de dados do Documentos com as empresas.
4. Cole o link de cada pasta no Documentos. O nome da pasta cria o registro da empresa.
5. O Documentos sincroniza nomes, links, datas de postagem no Drive e sugere categorias pelo nome do arquivo, incluindo guias, comprovantes de pagamento, certidões e fichas de EPI.
6. Em Notificações, escolha um modelo, informe o e-mail do cliente e prepare a mensagem com o link da pasta. O botão abre um rascunho para revisão e envio pelo aplicativo de e-mail.
7. Em Documentos, use “Conferir” para registrar competência, valor, vencimento, pagamento, validade e situação da assinatura da ficha de EPI. Vincule cada comprovante à guia correspondente.

## Limites da versão

Os relatórios também listam guias sem comprovante vinculado, diferenças entre o valor da guia e a soma dos pagamentos registrados, certidões vencidas e fichas de EPI sem assinatura confirmada. A ausência de comprovante vinculado não prova que a guia está sem pagamento; ela sinaliza que o recibo ainda não foi relacionado no sistema. A comparação aceita diferença de até R$ 0,01.

O OCR ainda não está conectado. Nomes e metadados dos arquivos são sincronizados, mas valores, datas internas e presença de assinatura precisam ser conferidos e registrados manualmente. Para automatizar a extração, será necessário autorizar a leitura do conteúdo dos arquivos nas pastas vinculadas e integrar OCR com uma camada segura de processamento. A análise da ficha registra presença de assinatura, não sua autenticidade.

O escopo `drive.metadata.readonly` permite consultar metadados do Drive da conta, embora o Documentos liste apenas as pastas vinculadas; `drive.file` mantém os dados do portal no Drive. Esta versão ainda não lê o conteúdo de PDFs nem extrai CNPJ, datas de validade ou outros campos internos. A tela de Documentos permite registrar a validade manualmente; o relatório separa arquivos vencidos, a vencer e sem validade identificada, mostrando também a data de criação no Drive e os dias desde a postagem. A sincronização acontece ao conectar, ao solicitar sincronização e a cada dois minutos enquanto o painel está aberto. Para leitura de PDFs e sincronização contínua com o painel fechado, será necessário adicionar OCR e um backend seguro com autorização Google de servidor.

Os modelos de notificação são preparados no navegador e abrem um rascunho via mailto; não há envio automático de e-mail. O Site está público no estado atual e ainda não possui login administrativo. Os tokens Google ficam apenas em memória no navegador. As empresas usam links separados de pasta no Drive e não precisam acessar o portal. A audiência do site é controlada pelas configurações do Site.

## Desenvolvimento e verificações locais

O frontend é estático e não exige instalação de pacotes. Para servi-lo localmente:

```sh
python3 -m http.server 8000 --directory dist
```

A conexão real ao Google exige configurar a origem local no cliente OAuth. O envio pelo botão do portal é administrativo e grava na pasta central “Documentos”; o envio das empresas continua sendo feito pelos links de suas pastas no Drive. As permissões atuais não garantem gravação nas pastas vinculadas pelo portal.

Execute os testes de regressão com Node.js 18 ou superior:

```sh
node --test tests/frontend.test.cjs
```

Os testes cobrem geração das telas com DOM simulado, indicadores de conferência, soma e tolerância de pagamentos, pendências sem valores e alinhamento do CSV. Não substituem testes de navegador ou integração real com o Google Drive.

Guias com comprovantes vinculados e valores ausentes aparecem em “Valores não conferidos” e na exportação de conferências. Isso não indica pagamento confirmado nem divergência comprovada.
