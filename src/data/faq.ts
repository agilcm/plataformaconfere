import { COMPANY_PROFILE } from './servicesData.ts';

// Perguntas exibidas no site e usadas nos dados estruturados (FAQPage) para o Google
export const FAQ_ITEMS = [
  {
    q: 'A Ágil CM atende empresas e prefeituras?',
    a: 'Sim. Atendemos empresas privadas, prefeituras, secretarias, autarquias e consórcios, com documentação pronta para licitações e contratações diretas.',
  },
  {
    q: 'Em quais cidades vocês atuam?',
    a: `Nossa sede fica em ${COMPANY_PROFILE.city}, na Zona da Mata. Atendemos Minas Gerais, Rio de Janeiro, São Paulo e outros estados, conforme o contrato.`,
  },
  {
    q: 'Quanto custa um funcionário para a minha empresa?',
    a: 'Depende do regime tributário. No Lucro Presumido ou Real, os encargos somam cerca de 36,8% sobre a folha, além de férias, 13º e multa do FGTS.',
  },
  {
    q: 'Vocês fazem a folha de pagamento da minha empresa?',
    a: 'Sim. Assumimos todo o Departamento Pessoal: admissões, férias, 13º, rescisões, eSocial, FGTS Digital e DCTFWeb.',
  },
  {
    q: 'Minha empresa pode estar pagando imposto a mais na folha?',
    a: 'É comum. Erros de enquadramento e de base de cálculo geram pagamentos a maior todo mês. O diagnóstico é sem custo e só cobramos sobre o valor recuperado.',
  },
  {
    q: 'Nunca vendi para prefeitura. Vocês ajudam?',
    a: 'Sim. Preparamos a documentação, acompanhamos os editais, montamos a proposta e operamos o pregão eletrônico até o contrato.',
  },
  {
    q: 'Como funciona o estudo do GILRAT para prefeituras?',
    a: 'Analisamos a folha do município para ver se a atividade preponderante permite reduzir a alíquota de 2% para 1%. O resultado depende do estudo, por isso não prometemos a redução antes.',
  },
  {
    q: 'O PEM acabou. Ainda dá para reparcelar a dívida do município?',
    a: 'Sim. Analisamos a dívida previdenciária e as opções de parcelamento disponíveis para encontrar a melhor condição e dar fôlego ao caixa mensal.',
  },
  {
    q: 'Como recebo o orçamento de terceirização?',
    a: 'Você conta como é o serviço (área, equipe, frequência) e deixa seu e-mail. Nossa equipe analisa as informações, faz a vistoria quando necessário e envia a proposta personalizada.',
  },
];
