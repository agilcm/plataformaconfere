// Manual do operador do DocPref: quem confere os documentos das empresas contratadas (fiscal do contrato, equipe da
// prefeitura ou da Ágil CM). O mesmo conteúdo aparece na aba "Manual do operador" e no PDF.
// As tabelas de situações vêm das próprias regras (lib/docpref.js): se o sistema mudar, o manual acompanha.
import { PAGAMENTO, STATUS, VENCIMENTO, nomeSinal } from './docpref.js';
import { PASTAS_DO_MES } from './docprefCartilha.js';

/** O que cada situação de uma exigência quer dizer e o que o operador faz */
const SIGNIFICADO_STATUS = {
  ok: ['Documento encontrado e com a competência certa escrita nele.', 'Nada, a não ser conferir por amostragem.'],
  conferir: [
    'Documento encontrado, mas a leitura não confirma o período ou o conteúdo (digitalização, foto, OCR).',
    'Abrir no Drive e marcar "Conferido: recebido" ou "Recusado".',
  ],
  divergencia: [
    'Documento com outro mês, valor diferente da guia, pagamento incompleto ou declaração sem escolher "houve / não houve".',
    'Pedir a correção; se a explicação for aceita, marcar "Conferido: recebido".',
  ],
  candidato: [
    'Há arquivo na pasta, mas ele não foi reconhecido como o documento pedido.',
    'Abrir no Drive; se for o documento certo, marcar "Conferido: recebido"; se não, pedir o correto.',
  ],
  ocorrencia: ['Não se sabe se houve o fato no mês (ex.: admissão sem declaração).', 'Confirmar com a empresa e marcar "Sim" ou "Não" em "No mês".'],
  faltando: ['Nenhum arquivo do documento na pasta do mês.', 'Cobrar (relatório rápido, mensagem ou notificação).'],
  vencida: ['A certidão apresentada já venceu na competência.', 'Pedir a certidão atualizada.'],
  renovar: ['A última certidão vence neste mês e não veio a nova.', 'Pedir a renovação neste mês, mesmo que seja ímpar.'],
  recusado: ['Recusado pela equipe, com o motivo escrito.', 'Aguardar o reenvio; o motivo vai na notificação.'],
  eventual: ['Só é exigido se o fato aconteceu (ex.: adiantamento, desconto parcelado).', 'Nada, salvo se a empresa disser que houve.'],
  na: ['Não se aplica neste mês ou nesta empresa (declarado, sem saldo de DARF, ou marcado pela equipe).', 'Nada.'],
};

const SIGNIFICADO_PAGAMENTO = {
  pago: 'Comprovante do banco com o mesmo valor da guia (nos salários, a soma dos comprovantes cobre o líquido da folha).',
  'nao-devido': 'A DCTFWeb não tem saldo a pagar: não há DARF no mês (a retenção ou a compensação cobriu o INSS).',
  'sem-comprovante': 'Guia (ou folha) sem comprovante de pagamento: pedir o comprovante do banco.',
  falta: 'Os comprovantes de salário não cobrem o líquido da folha: pedir os que faltam.',
  diferente: 'Guia e comprovante com valores diferentes: pedir explicação ou o comprovante certo.',
  'sem-guia': 'Comprovante sem a guia correspondente: pedir a guia.',
  'sem-documentos': 'Nem guia nem comprovante: pedir os dois.',
  conferir: 'Documentos achados, mas sem valor legível: conferir no Drive.',
};

/**
 * Seções do manual. Cada seção pode ter: texto (parágrafos), passos (lista numerada), itens (lista), tabela, nota.
 * @type {{ id: string, titulo: string, texto?: string[], passos?: string[], itens?: string[], tabela?: { cabecalho: string[], larguras: number[], linhas: string[][] }, nota?: string }[]}
 */
export const MANUAL_OPERADOR = [
  {
    id: 'objetivo',
    titulo: '1. Para que serve o DocPref',
    texto: [
      'O DocPref verifica, todo mês, se cada empresa contratada entregou as obrigações trabalhistas, previdenciárias e do FGTS do contrato, aponta o que está pendente e gera relatórios para cobrar e para liberar (ou travar) o pagamento.',
      'Nos contratos públicos com dedicação de mão de obra, a contratada deve comprovar essas obrigações (art. 50 da Lei 14.133/2021) e o contratante responde junto se falhar na fiscalização; por isso o pagamento pode ficar condicionado aos documentos (art. 121).',
    ],
  },
  {
    id: 'como-funciona',
    titulo: '2. Como o sistema funciona',
    itens: [
      'Fonte única: a pasta compartilhada no Google Drive. Nada é enviado pelo site; cada empresa coloca os documentos na pasta dela.',
      'A cada 3 horas o sistema lê a pasta inteira: identifica cada documento, a competência escrita nele, valores, datas e pessoas. PDFs digitalizados e fotos passam por OCR.',
      'Com isso monta, para cada empresa e cada mês, o que foi entregue, o que falta, as divergências, os prazos legais, as guias pagas e o semáforo do pagamento.',
      'O operador confere o que precisa de olho humano, marca o que for necessário e gera as cobranças e os relatórios.',
      'As marcações do operador (conferido, recusado, não se aplica) e o cadastro ficam guardados no navegador de quem usa. Use "Baixar cópia" e "Importar cópia" para levar a outro computador.',
    ],
  },
  {
    id: 'primeiro-acesso',
    titulo: '3. Configuração inicial (uma vez)',
    passos: [
      'Abra www.agilcm.com.br/docpref/ e vá na aba "Cadastro".',
      'No cartão "Contratante", escreva o nome da prefeitura (ou do órgão) e o prazo para regularizar depois da notificação, em dias úteis (padrão: 5).',
      'Para cada empresa: as empresas da pasta do Drive aparecem sozinhas em "Prestadoras e meses". Cadastre a empresa (mesma razão social ou CNPJ) para completar: e-mail de cobrança, nº do contrato, objeto, fiscal do contrato, dia do prazo (vazio = último dia do mês seguinte) e início do contrato.',
      'Se a empresa não casar sozinha com a pasta do Drive, escreva em "Nome da pasta na leitura do Drive" o nome exato da pasta dela.',
      'Envie a cada empresa a cartilha do fornecedor e os modelos (aba "Cartilha do fornecedor") e o acesso à pasta dela no Drive.',
    ],
    nota: 'O responsável técnico configura uma vez o segredo DOCPREF_PASTA_ID no GitHub (Settings → Secrets and variables → Actions). Sem ele, a leitura do Drive não acontece.',
  },
  {
    id: 'pasta',
    titulo: '4. Como a pasta do Drive deve estar organizada',
    itens: [
      'Pasta principal → uma pasta para cada empresa → uma pasta para cada mês (MM-AAAA, por exemplo 03-2026; também servem 2026/03 ou "Março 2026") → as subpastas abaixo.',
      'A planilha FORÇA DE TRABALHO fica solta na pasta do mês. Documentos que valem para vários meses (PGR, PCMSO, contrato social) podem ficar na pasta da empresa, fora dos meses.',
      'Pastas chamadas "Modelos", "Manuais" ou "Relatórios" na pasta principal são ignoradas.',
      'A pasta principal fica como "qualquer pessoa com o link" (leitor), para o sistema ler; cada empresa recebe acesso de editor só à pasta dela.',
    ],
    tabela: { cabecalho: ['Subpasta do mês', 'O que vai nela'], larguras: [1.6, 5], linhas: PASTAS_DO_MES.map(([p, d]) => [p, d]) },
  },
  {
    id: 'rotina',
    titulo: '5. Rotina mensal do operador',
    texto: [
      'Os documentos de uma competência vencem no último dia do mês seguinte (ou no dia combinado). Exemplo: março vence em 30 de abril. Em abril, o operador cobra e confere março.',
    ],
    passos: [
      'No começo do mês, abra "Farol e vencimentos" e veja quem está atrasado ou aguardando. Use "Relatório rápido de todas" → "Copiar texto" para lembrar as empresas do prazo.',
      'Quando uma empresa avisar que enviou, abra "Prestadoras e meses", escolha a empresa e clique no mês. (A leitura roda a cada 3 horas; para ver na hora, peça ao responsável técnico para rodar a leitura.)',
      'Leia o mês nesta ordem: semáforo; achados (os alertas laranja primeiro); guias e pagamentos; prazos legais; pessoas do mês; exigências por pasta, começando pelas vermelhas.',
      'Abra no Drive os arquivos em "Conferir" (digitalizações, fotos, lidos por OCR) e confira conteúdo, período e assinatura. Marque "Conferido: recebido" ou "Recusado" com o motivo.',
      'Para o que faltar: copie a mensagem de cobrança (WhatsApp) ou use "Enviar por e-mail"; para cobrança formal, gere a "Notificação de pendências (PDF)", que leva o prazo para regularizar e o fundamento legal, e colha a assinatura do fiscal.',
      'Encerrado o prazo de envio, mês com pendência fica "Travar pagamento": avise o gestor do contrato e o setor de pagamento. Libere o pagamento só com o mês em "Pode pagar" (ou com as pendências resolvidas e marcadas).',
      'Arquive no processo de pagamento o "Relatório do mês (PDF)" do mês liberado e, se houve, a notificação.',
      'Uma vez por mês: baixe o "Relatório geral" de cada empresa e o "Excel do farol" para o gestor, e veja os vencimentos (certidões a vencer em 30 dias).',
      'Ao terminar, faça "Baixar cópia" no Cadastro: é a cópia de segurança das suas marcações.',
    ],
  },
  {
    id: 'tela-mes',
    titulo: '6. Como ler a tela de um mês',
    itens: [
      `Semáforo: "${nomeSinal('pagar')}" (tudo recebido), "${nomeSinal('aguardando')}" (há pendência, mas o prazo não venceu), "${nomeSinal('travar')}" (prazo encerrado com pendência), "${nomeSinal('futuro')}" (o mês ainda não acabou) e "${nomeSinal('fora')}" (antes do início do contrato).`,
      'Indicadores e Pessoas do mês: empregados ativos da planilha, pagamentos de salário, arquivos de ponto, admissões e desligamentos pela planilha, pela declaração e pelas subpastas. Número em vermelho = não bate.',
      'Guias e pagamentos: cada guia com o comprovante do banco; salários pela soma dos comprovantes × líquido da folha (veja a seção 8).',
      'Prazos legais: salários até o 5º dia útil; DCTFWeb até o dia 15; FGTS e INSS até o dia 20 (antecipados quando não há expediente bancário).',
      'Achados da leitura: o que a leitura encontrou de diferente (declaração com outro mês, salário pago a outra pessoa, FGTS com encargos, retenção de 11% do INSS, declaração do banco de outro mês...). Laranja = atenção.',
      'No mês: as perguntas "houve admissão? demissão? férias? acidente?..." respondidas pelas declarações, pastas e planilha. "Não / Auto / Sim" deixa a equipe corrigir a resposta.',
      'Exigências por pasta e certidões: cada documento pedido, com a situação, a evidência e o seletor de conferência.',
      'Arquivos localizados: tudo o que veio na pasta do mês, com a competência lida (nomes de empregados aparecem como "Tipo · código").',
    ],
  },
  {
    id: 'situacoes',
    titulo: '7. O que cada situação quer dizer',
    tabela: {
      cabecalho: ['Situação', 'O que é', 'O que fazer'],
      larguras: [1.4, 3, 2.6],
      linhas: Object.entries(STATUS).map(([id, s]) => [s.nome, ...(SIGNIFICADO_STATUS[id] || ['', ''])]),
    },
    nota: 'Travam o pagamento: Divergência, Arquivo a classificar, Definir ocorrência, Não localizado, Certidão vencida, Renovação no mês e Recusado.',
  },
  {
    id: 'pagamentos',
    titulo: '8. Guias e pagamentos',
    texto: [
      'O sistema confere se cada guia foi paga: o comprovante do banco precisa ter o mesmo valor da guia (FGTS, DARF, VA/VR, VT). Nos salários, soma os comprovantes (Pix, transferências e o lote da conta salário) e compara com o total líquido de todos os departamentos da folha. Rescisões e férias pedem o comprovante quando houve.',
    ],
    tabela: {
      cabecalho: ['Situação', 'O que quer dizer'],
      larguras: [1.6, 5],
      linhas: Object.entries(PAGAMENTO).map(([id, p]) => [p.nome, SIGNIFICADO_PAGAMENTO[id] || '']),
    },
  },
  {
    id: 'conferencia',
    titulo: '9. Conferência manual (o seletor de cada exigência)',
    itens: [
      'Automático: segue a leitura do Drive. É o padrão.',
      'Conferido: recebido: você abriu o documento e está certo (digitalização legível, assinatura, período), ou aceitou a explicação de uma divergência.',
      'Recusado: documento errado, ilegível, de outro mês ou sem assinatura. Escreva o motivo: ele vai na notificação e na mensagem de cobrança.',
      'Não se aplica neste mês: a exigência não vale só neste mês (com justificativa da empresa).',
      'Não se aplica nesta prestadora (todos os meses): a exigência nunca vale para esta empresa (ex.: contrato sem vale-transporte). Para voltar a cobrar, escolha outra opção no seletor.',
      'Toda marcação guarda a data ("marcado em") e fica neste navegador. Para passar a outro operador, use "Baixar cópia" e "Importar cópia" no Cadastro.',
    ],
  },
  {
    id: 'relatorios',
    titulo: '10. Relatórios e quando usar cada um',
    tabela: {
      cabecalho: ['Relatório', 'Onde fica', 'Para quê'],
      larguras: [1.8, 2, 3.2],
      linhas: [
        [
          'Relatório do mês (PDF)',
          'No mês aberto, ou "PDF" na linha do mês',
          'Arquivar no processo de pagamento: exigências, guias e pagamentos, prazos, pessoas, certidões, achados e arquivos.',
        ],
        ['Excel do mês', 'No mês aberto', 'Trabalhar a lista de exigências, prazos, pessoas e arquivos em planilha.'],
        ['Relatório geral (PDF) e Excel do ano', 'No cartão da empresa', 'Visão do ano para o gestor do contrato, com a regularidade de cada mês.'],
        [
          'Relatório rápido',
          'No cartão da empresa; "de todas" no Farol',
          'O que falta em cada mês, em a), b), c): copiar para WhatsApp/e-mail ou baixar em PDF.',
        ],
        ['Notificação de pendências (PDF)', 'No mês com pendência', 'Cobrança formal, com prazo para regularizar, fundamento legal e assinatura do fiscal.'],
        ['Mensagem de cobrança / e-mail', 'No mês com pendência', 'Cobrança rápida, com a lista de pendências pronta.'],
        ['Excel do farol', 'Farol e vencimentos', 'Todas as empresas × meses e os vencimentos, para o gestor.'],
        [
          'Cartilha e modelos',
          'Cartilha do fornecedor',
          'Enviar a cada empresa nova: regras, pastas, prazos, declarações em Word e planilha de força de trabalho.',
        ],
      ],
    },
  },
  {
    id: 'farol',
    titulo: '11. Farol e vencimentos',
    itens: [
      'Farol: uma linha por empresa e uma coluna por mês, com a cor do semáforo e a % de regularidade (exigências recebidas ÷ exigidas). Clique num mês para abrir o detalhe.',
      'Performance por empresa: a regularidade do ano nos meses com prazo encerrado, as piores primeiro.',
      `Vencimentos: a última certidão (e PGR, PCMSO, LTCAT, alvará) de cada empresa: ${Object.values(VENCIMENTO)
        .map((v) => v.nome)
        .join(', ')}. "A vencer" = até 30 dias.`,
      'Relatório rápido de todas: a lista do que falta de cada empresa, para mandar de uma vez.',
    ],
  },
  {
    id: 'regras',
    titulo: '12. Regras que o sistema aplica',
    tabela: {
      cabecalho: ['Regra', 'Como funciona'],
      larguras: [1.8, 5],
      linhas: [
        ['Prazo de envio', 'Último dia do mês seguinte à competência (ou o dia combinado no Cadastro).'],
        ['Competência', 'A do período de apuração escrito no documento; data de pagamento e de transmissão não mudam a competência.'],
        [
          'Declarações',
          'Vão todo mês, tenha havido ou não o fato; precisam dizer o mês. Mês diferente da pasta ou "houve / não houve" sem escolher = divergência.',
        ],
        ['Admissão, demissão, férias, acidente', 'Quando houve (pela declaração, pela planilha ou pela pasta), os documentos do caso passam a ser cobrados.'],
        ['DARF do INSS', 'Só é cobrado se a DCTFWeb tiver saldo a pagar.'],
        ['VA/VR e VT', 'Cobrados todo mês, salvo declaração de que não se aplica (ou ajuste "não se aplica nesta prestadora").'],
        ['Certidões', 'CRF todo mês; federal, estadual, municipal, CNDT e falência nos meses pares; a que vence num mês é cobrada nesse mês.'],
        ['Prazos legais', 'Salário até o 5º dia útil; DCTFWeb até o dia 15; FGTS e INSS até o dia 20 do mês seguinte, antecipados sem expediente bancário.'],
        ['Pagamentos', 'Comprovante com o mesmo valor da guia; salários pela soma dos comprovantes × líquido da folha.'],
        ['Retenção de 11%', 'O INSS retido nas notas fiscais (Lei 9.711/98) aparece para conferir com o que o contratante reteve.'],
        ['Pessoas', 'Ativos da planilha × pagamentos de salário × folhas de ponto; admissões e desligamentos pela planilha, declaração e subpastas.'],
        ['Início do contrato', 'Meses antes do primeiro mês com arquivos (ou do início cadastrado) não são cobrados.'],
      ],
    },
  },
  {
    id: 'limites',
    titulo: '13. Limites e cuidados',
    itens: [
      'O sistema lê e organiza; a decisão de pagar é do fiscal e do gestor do contrato.',
      '"Conferir" quer dizer que o arquivo foi achado, mas o conteúdo precisa de olho humano.',
      'Valores e datas lidos por OCR podem ter erro de leitura: confira no documento antes de cobrar ou liberar.',
      'Folhas de ponto escritas à mão não são lidas; contam só pela quantidade de arquivos.',
      'A leitura usa só o que está na pasta do Drive e acontece a cada 3 horas; veja a data em "Fonte: ... lida em".',
      'O link da pasta principal dá acesso a todos os documentos (CPF, salários, exames): não divulgue; cada empresa recebe acesso só à pasta dela.',
      'O site publica só o resultado da leitura (tipos, competências, valores das guias, achados), sem nomes de empregados, CPF ou links dos arquivos.',
    ],
  },
  {
    id: 'problemas',
    titulo: '14. Problemas comuns',
    tabela: {
      cabecalho: ['Problema', 'O que fazer'],
      larguras: [2.2, 4.8],
      linhas: [
        [
          'A empresa não aparece',
          'A pasta dela precisa estar dentro da pasta principal. Espere a próxima leitura (até 3 horas) ou peça para rodar a leitura na hora.',
        ],
        ['Um mês não aparece', 'O nome da pasta do mês precisa ter mês e ano (03-2026, 2026/03, "Março 2026") e os arquivos precisam estar dentro dela.'],
        ['Meses antigos travados sem arquivos', 'Preencha "Início do contrato" no Cadastro: os meses anteriores deixam de ser cobrados.'],
        [
          '"Arquivo a classificar"',
          'Abra o arquivo no Drive. Se for o documento certo, marque "Conferido: recebido"; se for digitalização ruim, peça o PDF original.',
        ],
        ['Declaração em divergência', 'Mês diferente da pasta ou "houve / não houve" sem escolher: peça a declaração corrigida.'],
        ['Salários com pagamento incompleto', 'Peça os comprovantes que faltam: a soma precisa cobrir o líquido da folha.'],
        ['Leitura desatualizada', 'Para ler na hora: GitHub → Actions → "Publicar site no GitHub Pages" → Run workflow (responsável técnico).'],
        ['Minhas marcações sumiram', 'Estão em outro navegador ou computador: use "Importar cópia" com o arquivo de "Baixar cópia".'],
        ['Notificação sem prefeitura ou fiscal', 'Preencha o Contratante e o Fiscal do contrato no Cadastro.'],
      ],
    },
  },
  {
    id: 'glossario',
    titulo: '15. Glossário',
    tabela: {
      cabecalho: ['Termo', 'O que é'],
      larguras: [1.6, 5],
      linhas: [
        ['Competência', 'O mês a que os documentos se referem (pasta 03-2026 = competência março/2026).'],
        ['DCTFWeb', 'Declaração mensal dos tributos previdenciários à Receita; o "saldo a pagar" vira o DARF.'],
        ['DARF', 'Guia de pagamento do INSS (contribuição previdenciária).'],
        ['PER/DCOMP', 'Pedido de compensação ou de restituição (por exemplo, da retenção de 11%).'],
        ['GFD / FGTS Digital', 'Guia mensal do FGTS; o detalhamento lista os empregados.'],
        ['CRF', 'Certificado de Regularidade do FGTS, emitido pela Caixa.'],
        ['CNDT', 'Certidão Negativa de Débitos Trabalhistas, do TST.'],
        ['TRCT', 'Termo de rescisão do contrato de trabalho.'],
        ['ASO', 'Atestado de saúde ocupacional (admissional, periódico, demissional).'],
        ['CAT', 'Comunicação de acidente de trabalho.'],
        ['Força de trabalho', 'Planilha com todos os empregados do contrato no mês.'],
        ['Retenção de 11%', 'INSS retido pelo contratante na nota fiscal de serviço (art. 31 da Lei 8.212/91), usado pela empresa na DCTFWeb.'],
        ['Semáforo', 'Pode pagar, Aguardando ou Travar pagamento, conforme as pendências e o prazo.'],
      ],
    },
  },
];

/** Blocos do PDF do manual (lib/pdfReport.ts) */
export function blocosManualOperador({ contratante = '' } = {}) {
  const b = [
    { type: 'title', text: 'Manual do operador - DocPref' },
    ...(contratante ? [{ type: 'para', text: `Contratante: ${contratante}`, bold: true }] : []),
    {
      type: 'para',
      text: 'Para quem opera o sistema: fiscal do contrato, equipe da prefeitura ou da Ágil CM. Como configurar, a rotina do mês, como ler cada tela, como conferir e quais relatórios usar.',
      color: 'muted',
    },
    { type: 'heading', text: 'Sumário' },
    { type: 'bullets', items: MANUAL_OPERADOR.map((s) => s.titulo) },
  ];
  for (const s of MANUAL_OPERADOR) {
    b.push({ type: 'heading', text: s.titulo });
    for (const t of s.texto || []) b.push({ type: 'para', text: t });
    if (s.passos?.length) s.passos.forEach((p, i) => b.push({ type: 'para', text: `${i + 1}. ${p}`, indent: true, gapAfter: 3 }));
    if (s.itens?.length) b.push({ type: 'bullets', items: s.itens });
    if (s.tabela) b.push({ type: 'table', widths: s.tabela.larguras, header: s.tabela.cabecalho, rows: s.tabela.linhas, size: 8.5 });
    if (s.nota) b.push({ type: 'note', text: s.nota });
  }
  return b;
}
