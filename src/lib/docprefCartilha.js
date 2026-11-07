// Cartilha do fornecedor (DocPref): o que cada prestadora envia todo mês, como organizar as pastas, prazos,
// certidões, modelos de declaração e a planilha de força de trabalho. Mesmo roteiro das cartilhas de grandes
// tomadoras, no padrão Ágil CM. Gera os blocos do PDF (lib/pdfReport.ts) e as abas do modelo em Excel (lib/xlsx.js).

/** Pastas de cada competência (MM-AAAA), na ordem em que aparecem no Drive */
export const PASTAS_DO_MES = [
  ['Acordo Coletivo', 'Acordo ou convenção coletiva da categoria vigente (sempre a última versão).'],
  ['Admissão-alocação', 'Documentos de quem foi admitido ou alocado no contrato no mês, numa subpasta por pessoa. Se não houve, não criar a pasta.'],
  ['CAT', 'Comunicação de acidente de trabalho, quando houver acidente no mês.'],
  ['Certidões', 'CRF todo mês; federal, estadual, municipal, trabalhista (CNDT) e de falência e concordata nos meses pares.'],
  ['Declarações', 'As seis declarações mensais assinadas, em PDF (modelos nesta cartilha).'],
  ['Demissão-transferência', 'Documentos de quem foi demitido ou transferido no mês, numa subpasta por pessoa. Se não houve, não criar a pasta.'],
  ['FGTS', 'Guia FGTS Digital, detalhamento da guia e comprovante de pagamento.'],
  ['FOPAG e Comp. de Pgto', 'Folha analítica com resumo por rubrica e os comprovantes de pagamento dos salários.'],
  ['Férias', 'Aviso de férias assinado, recibo e comprovante de pagamento. Se não houve, não criar a pasta.'],
  ['INSS', 'DCTFWeb (declaração completa, recibo, resumo de débitos e de créditos), DARF e comprovante ou PER/DCOMP.'],
  ['Parcelamentos', 'Requerimento do parcelamento e guia e comprovante da parcela do mês. Se não houver, não criar a pasta.'],
  ['Ponto', 'Folhas de ponto de todos os empregados do contrato (ou declaração de que não se aplica).'],
  ['VA e VR', 'Relação nominal, nota fiscal ou guia e comprovante de pagamento (ou declaração de que não se aplica).'],
  ['VT', 'Relação dos optantes, nota fiscal, recibo ou guia e comprovante de pagamento (ou declaração de que não se aplica).'],
];

/** Colunas da planilha de força de trabalho: [título, orientação, largura] */
export const COLUNAS_FORCA = [
  ['Empresa', 'Razão social da sua empresa (prestadora).', 34],
  ['Nº do contrato', 'Número do contrato com a tomadora, só números.', 16],
  ['Ano competência', 'Só o ano (ex.: 2026).', 11],
  ['Mês competência', 'Só o número do mês (ex.: março = 3).', 11],
  ['Razão social da tomadora', 'Nome da tomadora do serviço.', 26],
  ['CNPJ da tomadora', 'CNPJ da tomadora do serviço.', 20],
  ['Nome do colaborador', 'Nome completo do empregado.', 34],
  [
    'Situação',
    '"A" para ativo e "I" para inativo (demitido ou afastado). Quem trabalhou no contrato ao menos um dia no mês, mesmo demitido no mês, fica "A".',
    10,
  ],
  ['Vínculo do colaborador', 'Celetista, temporário, aprendiz, estagiário etc.', 16],
  ['Função', 'Função atual do empregado no mês.', 22],
  ['CPF do colaborador', 'CPF do empregado.', 16],
  ['Data nasc.', 'Data de nascimento.', 12],
  ['Gênero', 'Feminino ou Masculino.', 11],
  ['Estado', 'UF onde o empregado presta o serviço.', 8],
  ['Relação contratual', 'Tempo integral ou parcial.', 14],
  ['Data admissão', 'Data de admissão na empresa.', 13],
  ['Data alocação', 'Data em que começou a trabalhar neste contrato.', 13],
  ['Data demissão', 'Data da demissão, quando houver.', 13],
  ['Data da desvinculação', 'Data em que saiu deste contrato (transferência), quando houver.', 15],
  ['Motivo do afastamento', 'Licença-maternidade, auxílio-doença, acidente etc., quando afastado.', 22],
  ['Salário', 'Salário bruto do mês, sem descontos.', 12],
];

/** Modelos de declaração: [título, orientação, texto, colunas da tabela] */
export const DECLARACOES = [
  [
    'Declaração de registro de acidente de trabalho',
    'Preencher com os dados da empresa e assinar pelo representante legal. Se houve acidente, enviar a CAT junto (pasta CAT). Acidente grave ou fatal deve ser comunicado imediatamente à Ágil CM, sem esperar o prazo do mês.',
    'declara, para os devidos fins, que houve / não houve acidente de trabalho no mês de ____________ de 20____ (competência ____/20____), no contrato nº ______________.',
    ['Nome do empregado', 'CPF', 'Data do acidente', 'Nº da CAT'],
  ],
  [
    'Declaração/relação de admissão e alocação no contrato',
    'Preencher com os dados da empresa e assinar. Se houve admissão ou alocação, relacionar os empregados e enviar os documentos admissionais na pasta Admissão-alocação.',
    'declara, para os devidos fins, que houve / não houve admissão ou alocação de empregados no mês de ____________ de 20____ (competência ____/20____), no contrato nº ______________, conforme a relação abaixo.',
    ['Nome do empregado', 'CPF', 'Função', 'Data de admissão/alocação'],
  ],
  [
    'Declaração/relação de demissão',
    'Preencher com os dados da empresa e assinar. Se houve demissão, relacionar os empregados e enviar os documentos demissionais na pasta Demissão-transferência.',
    'declara, para os devidos fins, que houve / não houve demissão de empregados no mês de ____________ de 20____ (competência ____/20____), no contrato nº ______________, conforme a relação abaixo.',
    ['Nome do empregado', 'CPF', 'Data da demissão', 'Motivo'],
  ],
  [
    'Declaração/relação de transferência',
    'Preencher com os dados da empresa e assinar. Se algum empregado saiu deste contrato para outro serviço (sem ser demitido), relacioná-lo.',
    'declara, para os devidos fins, que houve / não houve transferência de empregados deste contrato para outros serviços no mês de ____________ de 20____ (competência ____/20____), no contrato nº ______________.',
    ['Nome do empregado', 'CPF', 'Data da transferência', 'Destino'],
  ],
  [
    'Declaração/relação de férias',
    'Preencher com os dados da empresa e assinar. O período aquisitivo vai com dia, mês e ano (dd/mm/aaaa a dd/mm/aaaa). Se houve férias, enviar os documentos na pasta Férias.',
    'declara, para os devidos fins, que houve / não houve empregados em gozo de férias no mês de ____________ de 20____ (competência ____/20____), no contrato nº ______________.',
    ['Nome do empregado', 'CPF', 'Período aquisitivo', 'Início', 'Término'],
  ],
  [
    'Declaração de subcontratação',
    'Preencher com os dados da empresa e assinar. Se houver subcontratada, informar e enviar todos os documentos dela, numa pasta para cada empresa.',
    'declara, para os devidos fins, que houve / não houve subcontratação de empresas na prestação do serviço no mês de ____________ de 20____ (competência ____/20____), no contrato nº ______________.',
    ['Razão social da subcontratada', 'CNPJ', 'Serviço', 'Nº de empregados'],
  ],
  [
    'Declaração de mobilização',
    'Enviar no início do contrato, com a data (ou previsão) da mobilização e os empregados admitidos ou alocados, junto com os documentos admissionais.',
    'declara, para os devidos fins, que a mobilização do contrato nº ______________ ocorreu (ou ocorrerá) em ____/____/20____, com os empregados relacionados abaixo.',
    ['Nome do empregado', 'CPF', 'Função', 'Data de alocação'],
  ],
  [
    'Declaração de desmobilização',
    'Enviar no fim do contrato (ou quando o serviço terminar antes), com a data efetiva da desmobilização. Demitidos e transferidos vão em duas tabelas separadas, junto com os documentos demissionais.',
    'declara, para os devidos fins, que a prestação de serviço do contrato nº ______________ terminou em ____/____/20____ e que os empregados abaixo foram (ou serão) demitidos ou transferidos para outros contratos.',
    ['Nome do empregado', 'CPF', 'Demitido ou transferido', 'Data'],
  ],
];

/**
 * Blocos do PDF da cartilha.
 * @param {{ nome: string, email: string, phoneDisplay?: string, domain?: string }} tomadora
 */
export function blocosCartilha(tomadora, { atualizada = '', contratante = '' } = {}) {
  const T = tomadora.nome;
  const b = [
    { type: 'title', text: 'Cartilha do fornecedor' },
    ...(contratante ? [{ type: 'para', text: `Contratante: ${contratante} · conferência dos documentos: ${T}`, bold: true }] : []),
    {
      type: 'para',
      text: `Documentos trabalhistas e previdenciários mensais · DocPref ${T}${atualizada ? ` · atualizada em ${atualizada}` : ''}`,
      color: 'muted',
    },
    { type: 'heading', text: 'Para que serve' },
    {
      type: 'para',
      text: `Esta cartilha orienta o envio dos documentos trabalhistas e previdenciários pedidos todo mês. O envio regular e correto garante o cumprimento das obrigações legais, a segurança jurídica das partes e uma relação transparente, e evita notificações administrativas e o bloqueio dos pagamentos. Aqui estão os documentos, o prazo, a forma de envio e os modelos.`,
    },
    { type: 'para', text: `Em caso de dúvida, fale com a equipe ${T}: ${tomadora.email}${tomadora.phoneDisplay ? ` · ${tomadora.phoneDisplay}` : ''}.` },
    { type: 'heading', text: 'Base legal nos contratos públicos' },
    {
      type: 'para',
      text: 'Nos serviços com dedicação exclusiva de mão de obra, o art. 50 da Lei nº 14.133/2021 obriga a contratada a comprovar, quando solicitado, o cumprimento das obrigações trabalhistas e com o FGTS dos empregados do contrato: registro de ponto; recibos de salários, adicionais, horas extras, repouso semanal remunerado e 13º; depósito do FGTS; concessão e pagamento de férias; quitação das verbas dos dispensados; e pagamento de vale-transporte e vale-alimentação.',
    },
    {
      type: 'para',
      text: 'O art. 121 da mesma lei faz a Administração responder solidariamente pelos encargos previdenciários e subsidiariamente pelos trabalhistas se falhar na fiscalização, e permite condicionar o pagamento à comprovação de quitação das obrigações trabalhistas vencidas, quando previsto no edital ou no contrato. Por isso a conferência é mensal e o pagamento fica condicionado aos documentos.',
    },
    { type: 'heading', text: 'Prazo e forma de envio' },
    {
      type: 'bullets',
      items: [
        'Os documentos de cada competência devem estar na pasta compartilhada até o último dia do mês seguinte. Exemplo: os documentos de março vão até 30 de abril.',
        'Sem os documentos no prazo, a prestadora recebe notificação administrativa e o pagamento fica bloqueado até a regularização.',
        'Documentos incompletos ou incorretos geram notificação de pendências; depois de corrigidos, voltam para a fila de conferência, atrás de quem enviou no prazo.',
        `Forma de envio: pasta no Google Drive compartilhada pela ${T} (o link vai no e-mail de solicitação). Uma pasta por mês, no formato MM-AAAA (ex.: 03-2026).`,
        `Sempre que terminar de postar, mande um e-mail para ${tomadora.email} avisando que os documentos estão na pasta.`,
      ],
    },
    { type: 'heading', text: 'Como a conferência é feita' },
    {
      type: 'bullets',
      items: [
        'O DocPref lê a pasta automaticamente: identifica cada documento, a competência escrita nele e o que falta em cada mês.',
        'A competência é a do Período de apuração escrito no documento (DCTFWeb, guias, folha). Datas de transmissão e de pagamento não mudam a competência: a guia de março pode ser paga em abril, mas continua sendo de março.',
        'As declarações precisam dizer o mês da competência no texto. Declaração na pasta de abril falando de março é tratada como divergência.',
        'Arquivos digitalizados ou fotos são conferidos visualmente. Prefira PDF gerado pelo sistema (DCTFWeb, FGTS Digital, folha) e comprovantes bancários em PDF.',
        'O nome do arquivo de comprovante de salário deve ser o nome do empregado. Pagamento em conta de outra pessoa precisa de justificativa.',
      ],
    },
    { type: 'heading', text: 'Pastas de cada competência' },
    {
      type: 'para',
      text: 'Dentro da pasta do mês (MM-AAAA), crie as subpastas abaixo e coloque a planilha FORÇA DE TRABALHO na própria pasta do mês.',
      size: 9.5,
    },
    { type: 'table', widths: [1.6, 5], header: ['Pasta', 'O que vai nela'], rows: PASTAS_DO_MES, size: 8.5 },
    { type: 'note', text: 'Havendo subcontratação, crie uma pasta para cada subcontratada, com as mesmas subpastas.' },
    { type: 'heading', text: 'Lista de documentos do mês' },
    {
      type: 'table',
      widths: [0.4, 5.6],
      header: ['', 'Documento'],
      rows: [
        ['1', 'Declarações do mês: acidente de trabalho, admissão/alocação, demissão, transferência, férias e subcontratação (assinadas, em PDF).'],
        ['2', 'Folha de pagamento analítica com resumo por rubrica.'],
        ['3', 'Comprovantes de pagamento dos salários (transferência bancária, de preferência; holerite assinado só com declaração de pagamento em espécie).'],
        ['4', 'Folhas de ponto de todos os empregados (ou declaração de que não se aplica).'],
        ['5', 'DCTFWeb: declaração completa, recibo de entrega, resumo de débitos e resumo de créditos.'],
        ['6', 'DARF previdenciário e comprovante de pagamento; se compensado, o PER/DCOMP; se parcelado, os documentos do parcelamento.'],
        ['7', 'Guia do FGTS Digital, detalhamento da guia e comprovante de pagamento.'],
        ['8', 'Certificado de Regularidade do FGTS (CRF), todo mês.'],
        ['9', 'Certidões federal, estadual, municipal, trabalhista (CNDT) e de falência e concordata, nos meses pares e sempre que vencerem.'],
        ['10', 'VA/VR e cesta: relação nominal, nota fiscal ou guia e comprovante de pagamento (ou declaração de que não se aplica).'],
        ['11', 'Vale-transporte: relação dos optantes, nota fiscal, recibo ou guia e comprovante (ou declaração de que não se aplica).'],
        ['12', 'Acordo ou convenção coletiva vigente da categoria.'],
        ['13', 'Documentos de admissão, demissão e férias do mês, quando houver.'],
        ['14', 'Planilha de força de trabalho atualizada (modelo nesta cartilha).'],
      ],
      size: 8.5,
    },
    { type: 'heading', text: 'Admissão ou alocação no mês' },
    {
      type: 'bullets',
      items: [
        'Contrato de trabalho;',
        'Ficha de registro;',
        'Carteira de trabalho (CTPS Digital) ou registro no eSocial;',
        'ASO admissional;',
        'Ficha de entrega dos EPIs assinada pelo empregado;',
        'Comprovante de entrega e devolução da CTPS física, quando houver;',
        'Declaração de opção (ou não) pelo vale-transporte.',
      ],
    },
    { type: 'heading', text: 'Demissão no mês' },
    {
      type: 'bullets',
      items: [
        'TRCT (rescisão) assinado e datado;',
        'Comprovante de pagamento da rescisão;',
        'Aviso de dispensa ou pedido de demissão;',
        'Guia e comprovante da multa do FGTS (GRRF/FGTS Digital rescisório) e demonstrativo por trabalhador;',
        'Baixa na CTPS ou evento de desligamento no eSocial;',
        'ASO demissional;',
        'Protocolo do seguro-desemprego, quando aplicável.',
      ],
    },
    { type: 'heading', text: 'Férias no mês' },
    { type: 'bullets', items: ['Aviso de férias assinado;', 'Recibo de férias e comprovante de pagamento.'] },
    { type: 'heading', text: 'Folha, salários e ponto' },
    {
      type: 'bullets',
      items: [
        'Folha analítica de pagamento (extrato analítico / FOPAG) com o resumo por rubrica.',
        'Comprovação do pagamento: comprovante de depósito ou transferência (preferencial) ou holerites datados e assinados, com a Declaração de pagamento em espécie.',
        'Folha de ponto dos empregados; se não se aplica, declaração assinada em PDF.',
      ],
    },
    { type: 'heading', text: 'INSS' },
    {
      type: 'bullets',
      items: [
        'DCTFWeb: declaração completa, recibo de entrega, resumo de débitos e resumo de créditos;',
        'Guia DARF previdenciária e comprovante de pagamento;',
        'DARF compensado: PER/DCOMP e recibo;',
        'DARF parcelado: requerimento do parcelamento, guia e comprovante da primeira parcela e, todo mês, a tela do parcelamento (e-CAC) e as guias e comprovantes das parcelas seguintes.',
      ],
    },
    { type: 'heading', text: 'FGTS' },
    {
      type: 'bullets',
      items: [
        'Guia do FGTS Digital, comprovante de pagamento e detalhamento da guia;',
        'FGTS parcelado: termo de confissão de dívida/parcelamento (Caixa), comprovante de adesão e simulação, guias pagas das parcelas, extrato do parcelamento e relatório do eSocial com os débitos.',
      ],
    },
    { type: 'heading', text: 'Certidões' },
    {
      type: 'bullets',
      items: [
        'CRF (FGTS): todo mês.',
        'Certidões federal, estadual, municipal, trabalhista (CNDT) e de falência e concordata: nos meses pares (fevereiro, abril, junho, agosto, outubro e dezembro).',
        'Certidão que vence num mês deve ser renovada nesse mês, mesmo que seja ímpar. Uma certidão ainda válida pode ser reapresentada.',
      ],
    },
    { type: 'heading', text: 'Outros documentos' },
    {
      type: 'bullets',
      items: [
        'Vale-alimentação, refeição e cesta: relatório ou extrato com os nomes, nota fiscal ou guia e comprovante de pagamento; se não se aplica, declaração assinada.',
        'Vale-transporte: relatório ou extrato com os nomes, nota fiscal, recibo ou guia e comprovante; se não se aplica, declaração assinada.',
        'Acordo ou convenção coletiva vigente da categoria (a última versão). Sem acordo, a convenção da categoria dos empregados do contrato.',
        'Declaração de mobilização no início do contrato e de desmobilização no fim, com os documentos admissionais ou demissionais.',
        'Outros documentos pedidos em auditoria.',
      ],
    },
    { type: 'heading', text: 'Planilha de força de trabalho' },
    {
      type: 'para',
      text: 'Envie todo mês, atualizando a competência e as admissões, alocações, demissões, transferências e afastamentos do mês. Quem foi demitido nunca sai da planilha: preencha a data de demissão e mantenha a linha, para guardar o histórico.',
    },
    {
      type: 'table',
      widths: [0.4, 1.8, 4.2],
      header: ['Col.', 'Campo', 'Como preencher'],
      rows: COLUNAS_FORCA.map(([t, o], i) => [String.fromCharCode(65 + i), t, o]),
      size: 8,
    },
    { type: 'heading', text: 'Modelos em Word e Excel' },
    {
      type: 'para',
      text: 'Os modelos editáveis estão no DocPref, em Cartilha do fornecedor (ou com a equipe de conferência). As declarações mensais vão todo mês, tenha havido ou não o fato.',
      size: 9.5,
    },
    { type: 'table', widths: [3, 1.6, 2], header: ['Modelo', 'Quando', 'Pasta'], rows: MODELOS.map((m) => [m.nome, m.quando, m.pasta]), size: 8.5 },
    { type: 'pagebreak' },
    { type: 'title', text: 'Modelos de declaração' },
    {
      type: 'para',
      text: 'Imprima em papel timbrado da sua empresa, preencha, assine e salve em PDF na pasta Declarações do mês. Apague a opção que não vale (houve ou não houve) e escreva sempre o mês da competência. As declarações vão todo mês, mesmo quando não houve o fato.',
      color: 'muted',
    },
  ];
  DECLARACOES.forEach(([titulo, orientacao, texto, colunas], i) => {
    if (i > 0) b.push({ type: 'pagebreak' });
    b.push(
      { type: 'note', text: `Orientação: ${orientacao}` },
      { type: 'para', text: '[PAPEL TIMBRADO DA EMPRESA]', color: 'muted', size: 9 },
      { type: 'heading', text: titulo.toUpperCase() },
      {
        type: 'para',
        text: `A empresa ______________________________________________, inscrita no CNPJ ____.____.____/____-____, com sede em ______________________________________________, ${texto}`,
      },
      { type: 'table', widths: colunas.map(() => 1), header: colunas, rows: [0, 1, 2, 3].map(() => colunas.map(() => ' ')), size: 9 },
      { type: 'para', text: 'Afirmo a veracidade das informações prestadas nesta declaração.' },
      { type: 'para', text: '______________________, ____ de ______________ de 20____.', gapAfter: 28 },
      { type: 'para', text: '__________________________________________' },
      { type: 'para', text: 'Representante legal da empresa', bold: true },
      { type: 'para', text: 'Nome, cargo e assinatura', color: 'muted', size: 9 },
    );
  });
  b.push(
    { type: 'pagebreak' },
    { type: 'title', text: 'Contato' },
    {
      type: 'para',
      text: `Dúvidas sobre documentos, prazos ou a pasta compartilhada: ${tomadora.email}${tomadora.phoneDisplay ? ` · ${tomadora.phoneDisplay}` : ''}${tomadora.domain ? ` · ${tomadora.domain}` : ''}.`,
    },
  );
  return b;
}

/** Abas do modelo de força de trabalho (.xlsx): planilha em branco com uma linha de exemplo e as orientações */
export function abasForcaDeTrabalho(tomadora) {
  return [
    {
      nome: 'Força de Trabalho',
      colunas: COLUNAS_FORCA.map(([titulo, , largura]) => ({ titulo, largura, tipo: titulo === 'Salário' ? 'moeda' : 'texto' })),
      linhas: [
        [
          'EMPRESA EXEMPLO LTDA (apague esta linha)',
          '0000000',
          '2026',
          '3',
          tomadora.razao || tomadora.nome,
          tomadora.cnpj || '',
          'NOME COMPLETO DO EMPREGADO',
          'A',
          'Celetista',
          'Servente de limpeza',
          '000.000.000-00',
          '01/01/1990',
          'Feminino',
          'MG',
          'Integral',
          '01/02/2026',
          '01/02/2026',
          '',
          '',
          '',
          0,
        ],
      ],
    },
    {
      nome: 'Como preencher',
      colunas: [
        { titulo: 'Coluna', largura: 8 },
        { titulo: 'Campo', largura: 26 },
        { titulo: 'Como preencher', largura: 90 },
      ],
      linhas: [
        ...COLUNAS_FORCA.map(([t, o], i) => [String.fromCharCode(65 + i), t, o]),
        ['', '', ''],
        ['', 'Atenção', 'Quem foi demitido nunca sai da planilha: preencha a data de demissão e mantenha a linha. Atualize a competência todo mês.'],
      ],
    },
  ];
}

/**
 * Modelos para baixar (public/docpref/modelos, gerados por scripts/docpref-modelos.py).
 * `quando`: todo mês | início | fim | não se aplica | se houver.
 */
export const MODELOS = [
  {
    arquivo: 'declaracao-acidente-de-trabalho.docx',
    nome: 'Declaração de acidente de trabalho',
    quando: 'Todo mês',
    pasta: 'Declarações',
    paraQue: 'Diz se houve ou não acidente de trabalho no mês do contrato.',
    como: [
      'Apague "houve" ou "não houve" (deixe só a opção certa) e escreva o mês por extenso.',
      'Se houve acidente, envie também a CAT na pasta CAT. Acidente grave ou fatal: avisar na hora, sem esperar o prazo.',
    ],
    docpref: 'Confere o mês escrito e se houve acidente. "Houve" passa a cobrar a CAT.',
  },
  {
    arquivo: 'declaracao-admissao-alocacao.docx',
    nome: 'Declaração de admissão-alocação',
    quando: 'Todo mês',
    pasta: 'Declarações',
    paraQue: 'Lista quem foi admitido ou passou a trabalhar no contrato no mês.',
    como: [
      'Apague "houve" ou "não houve" e escreva o mês.',
      'Se houve, preencha nome, CPF e data de cada pessoa e envie os documentos admissionais na pasta Admissão-alocação (uma subpasta por pessoa).',
    ],
    docpref:
      'Compara a quantidade de pessoas com a planilha de força de trabalho e com as subpastas; "houve" cobra contrato, ficha, CTPS/eSocial, ASO, EPI e opção de VT.',
  },
  {
    arquivo: 'declaracao-demissao.docx',
    nome: 'Declaração de demissão',
    quando: 'Todo mês',
    pasta: 'Declarações',
    paraQue: 'Lista quem foi demitido no mês.',
    como: [
      'Apague "houve" ou "não houve" e escreva o mês.',
      'Se houve, preencha nome, CPF e data e envie TRCT, comprovante da rescisão, aviso, guia e comprovante da multa, baixa e ASO demissional na pasta Demissão-transferência.',
    ],
    docpref: 'Compara com a planilha e as subpastas; "houve" cobra os documentos demissionais e o comprovante de pagamento da rescisão.',
  },
  {
    arquivo: 'declaracao-transferencia.docx',
    nome: 'Declaração de transferência',
    quando: 'Todo mês',
    pasta: 'Declarações',
    paraQue: 'Lista quem saiu deste contrato para outro serviço sem ser demitido.',
    como: ['Apague "houve" ou "não houve", escreva o mês e, se houve, preencha nome, CPF, data e destino.'],
    docpref: 'Confere o mês escrito; na planilha, a pessoa transferida leva a data da desvinculação.',
  },
  {
    arquivo: 'declaracao-ferias.docx',
    nome: 'Declaração de férias',
    quando: 'Todo mês',
    pasta: 'Declarações',
    paraQue: 'Lista quem esteve de férias no mês.',
    como: [
      'Apague "houve" ou "não houve" e escreva o mês.',
      'Se houve, preencha o período aquisitivo com dia, mês e ano e envie aviso, recibo e comprovante de pagamento das férias na pasta Férias.',
    ],
    docpref: '"Houve" cobra aviso, recibo e comprovante de pagamento das férias.',
  },
  {
    arquivo: 'declaracao-subcontratacao.docx',
    nome: 'Declaração de subcontratação',
    quando: 'Todo mês',
    pasta: 'Declarações',
    paraQue: 'Diz se há empresa subcontratada trabalhando no contrato.',
    como: [
      'Escreva a competência (ex.: 07/2026), apague "houve" ou "não houve" e preencha o contrato e o contratante.',
      'Se houve, liste as subcontratadas e envie os documentos de cada uma numa pasta própria, com as mesmas subpastas.',
    ],
    docpref: '"Houve" cobra a pasta de cada subcontratada.',
  },
  {
    arquivo: 'declaracao-mobilizacao.docx',
    nome: 'Declaração de mobilização',
    quando: 'Só no início do contrato',
    pasta: 'Mobilização',
    paraQue: 'Informa a data em que o contrato começou (ou vai começar) e quem foi alocado.',
    como: ['Preencha o nº do contrato, a data de início e a relação de funcionários.', 'Envie junto os documentos admissionais de cada funcionário.'],
    docpref: 'Com a pasta Mobilização, o mês passa a cobrar a declaração e os documentos de quem entrou.',
  },
  {
    arquivo: 'declaracao-desmobilizacao.docx',
    nome: 'Declaração de desmobilização',
    quando: 'Só no fim do contrato',
    pasta: 'Desmobilização',
    paraQue: 'Informa a data efetiva em que o serviço terminou e o destino de cada funcionário.',
    como: [
      'Preencha a data efetiva do fim do serviço e as duas tabelas: demitidos e transferidos para outros contratos.',
      'Envie junto os documentos demissionais.',
    ],
    docpref: 'Com a pasta Desmobilização, o mês passa a cobrar a declaração e os documentos de quem saiu.',
  },
  {
    arquivo: 'declaracao-nao-aplicacao-ponto.docx',
    nome: 'Declaração de não aplicação de ponto',
    quando: 'Só se não houver ponto',
    pasta: 'Ponto',
    paraQue: 'Substitui as folhas de ponto quando o controle não se aplica.',
    como: ['Escreva o mês e o motivo (trabalho externo, cargo de confiança, teletrabalho...).'],
    docpref: 'Conta como o documento de ponto do mês.',
  },
  {
    arquivo: 'declaracao-nao-aplicacao-va-vr.docx',
    nome: 'Declaração de não fornecimento de VA/VR',
    quando: 'Só se não houver VA/VR',
    pasta: 'VA e VR',
    paraQue: 'Explica por que não há vale-alimentação, refeição ou cesta no contrato.',
    como: ['Escreva o mês e o motivo (ex.: não previsto na convenção; refeição no local).'],
    docpref: 'Deixa de cobrar relação, nota e comprovante de VA/VR no mês.',
  },
  {
    arquivo: 'declaracao-nao-aplicacao-vt.docx',
    nome: 'Declaração de não fornecimento de VT',
    quando: 'Só se não houver VT',
    pasta: 'VT',
    paraQue: 'Explica por que não há vale-transporte no contrato.',
    como: ['Escreva o mês e o motivo (ex.: ninguém optou, com as declarações de opção; transporte da empresa).'],
    docpref: 'Deixa de cobrar relação, recibo e comprovante de VT no mês.',
  },
  {
    arquivo: 'declaracao-pagamento-em-especie.docx',
    nome: 'Declaração de pagamento em espécie',
    quando: 'Só se pagar em dinheiro',
    pasta: 'FOPAG e Comp. de Pgto',
    paraQue: 'Acompanha os holerites assinados quando o salário é pago em dinheiro.',
    como: ['Liste quem recebeu em dinheiro, o valor líquido e a data, e anexe os holerites datados e assinados.'],
    docpref: 'Conta como comprovação do salário de quem recebeu em espécie.',
  },
  {
    arquivo: 'forca-de-trabalho-modelo.xlsx',
    nome: 'Planilha de força de trabalho',
    quando: 'Todo mês',
    pasta: 'Pasta do mês (fora das subpastas)',
    paraQue: 'Lista todos os empregados do contrato no mês: ativos, admitidos, demitidos, transferidos e afastados.',
    como: [
      'Atualize a competência (ano e mês) e o movimento do mês; as listas de opção (situação, gênero, vínculo, motivo do afastamento) já estão na planilha.',
      'Nunca apague quem foi demitido: preencha a data e mantenha a linha. A aba "Como preencher" explica cada coluna.',
    ],
    docpref:
      'Lê ativos, admissões, desligamentos e afastados e confere com as declarações, as subpastas de pessoas, os comprovantes de salário e as folhas de ponto.',
  },
];
