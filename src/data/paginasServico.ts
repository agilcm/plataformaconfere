// Páginas próprias de cada serviço (/terceirizacao/, /gilrat/…): uma página por assunto, com título, descrição e
// conteúdo próprios, para o Google e os assistentes de IA lerem cada serviço em separado.
// Os textos repetem o que a Ágil CM já afirma na página inicial (servicesData.ts e seções); nada novo é prometido aqui.
// O HTML de cada página é gerado no build (scripts/prerender.mjs) a partir do modelo servico/index.html.
import { CONSULTING_SERVICES, OPERATIONAL_SERVICES } from './servicesData.ts';
import { FAQ_ITEMS } from './faq.ts';

/** Links internos: 'servico:<slug>', 'rota:licitacoes' ou 'home:#ancora' (resolvidos em ServicoPage) */
export type Link = string;
export interface Item {
  titulo: string;
  texto?: string;
  href?: Link;
}
export type Bloco =
  | { tipo: 'texto'; titulo: string; paragrafos: string[] }
  | { tipo: 'cards'; titulo: string; intro?: string; itens: Item[] }
  | { tipo: 'lista'; titulo: string; intro?: string; itens: (string | { texto: string; href: Link })[] }
  | { tipo: 'passos'; titulo: string; itens: Item[] }
  | { tipo: 'destaque'; titulo: string; texto: string; link?: { rotulo: string; href: Link } };

export interface PaginaServico {
  slug: string;
  /** Nome curto para menus, rodapé e "veja também" */
  nav: string;
  /** <title>: até 60 caracteres */
  title: string;
  /** meta description: até 155 caracteres */
  description: string;
  eyebrow: string;
  h1: string;
  lead: string;
  /** Opção do formulário de contato já escolhida nesta página */
  contato: string;
  /** Mensagem inicial do botão de WhatsApp */
  whatsapp: string;
  /** Segundo botão do topo (opcional) */
  acao?: { rotulo: string; href: Link };
  blocos: Bloco[];
  faq: { q: string; a: string }[];
  relacionados: string[];
  /** Data da última revisão do conteúdo (vai para o sitemap) */
  atualizado: string;
}

const faq = (inicio: string) => {
  const f = FAQ_ITEMS.find((x) => x.q.startsWith(inicio));
  if (!f) throw new Error(`Pergunta não encontrada no FAQ: ${inicio}`);
  return f;
};
const consultoria = (id: string) => CONSULTING_SERVICES.find((s) => s.id === id)!;
const operacional = (id: string) => OPERATIONAL_SERVICES.find((s) => s.id === id)!;
// Só a primeira letra maiúscula (mantém siglas como GILRAT, INSS e RH e nomes como eSocial)
const frase = (t: string) =>
  t
    .split(' ')
    .map((w, i) => (i === 0 || /^[A-ZÁÉÍÓÚ]{2,}$/.test(w) || /[a-z][A-Z]/.test(w) ? w : w.toLowerCase()))
    .join(' ');
const beneficios = (id: string): Item[] => consultoria(id).benefits.map((b) => ({ titulo: frase(b.title), texto: b.desc }));

const POR_QUE_AGIL: Bloco = {
  tipo: 'cards',
  titulo: 'Por que contratar a Ágil CM',
  itens: [
    { titulo: 'Equipe própria e treinada', texto: 'Seleção criteriosa, treinamento contínuo e NRs em dia.' },
    { titulo: 'Supervisão e reposição rápida', texto: 'Gestor dedicado em cada contrato e substituição imediata.' },
    { titulo: 'Documentação sem pendências', texto: 'NFS-e com certidões negativas todo mês, sem glosas.' },
    { titulo: 'Segurança jurídica', texto: 'Seguro garantia e conformidade com eSocial e CLT.' },
  ],
};

const COMO_PEDIR_ORCAMENTO: Bloco = {
  tipo: 'passos',
  titulo: 'Como pedir o orçamento',
  itens: [
    { titulo: 'Você conta como é o serviço', texto: 'Área, equipe, frequência e o e-mail para receber a proposta.' },
    { titulo: 'Analisamos as informações', texto: 'Nossa equipe estuda o pedido e faz a vistoria quando necessário.' },
    { titulo: 'Você recebe a proposta', texto: 'Proposta personalizada para o seu prédio, a sua cidade ou o seu contrato.' },
  ],
};

const COMO_TRABALHAMOS_MUNICIPIO: Bloco = {
  tipo: 'passos',
  titulo: 'Como trabalhamos com o município',
  itens: [
    { titulo: 'Reunião com a gestão', texto: 'Entendemos a realidade do município com prefeito e secretários.' },
    { titulo: 'Coleta de dados', texto: 'Folha, guias do INSS, parcelamentos e certidões.' },
    { titulo: 'Estudo e parecer', texto: 'Análise técnica e jurídica com riscos e resultado esperado.' },
    { titulo: 'Implantação', texto: 'Executamos a solução e acompanhamos mês a mês.' },
  ],
};

const gilrat = consultoria('readequacao-gilrat');
const reparcelamento = consultoria('reparcelamento-previdenciario');
const folhaPublica = consultoria('gestao-rh-compliance');
const rhEmpresas = consultoria('consultoria-rh-empresas');
const folha = consultoria('folha-pagamento');
const auditoria = consultoria('auditoria-folha-recuperacao');
const licitacoes = consultoria('assessoria-licitacoes');
const suprimentos = operacional('suprimentos-backoffice');

export const PAGINAS_SERVICO: PaginaServico[] = [
  {
    slug: 'terceirizacao',
    nav: 'Limpeza, conservação e portaria',
    title: 'Terceirização de limpeza e portaria em MG | Ágil CM',
    description:
      'Terceirização de limpeza, conservação, portaria e recepção para empresas e órgãos públicos em Minas Gerais. Equipe própria e documentação em dia.',
    eyebrow: 'Terceirização e facilities',
    h1: 'Terceirização de limpeza, conservação e portaria',
    lead: 'Equipes treinadas e supervisionadas para manter seu prédio limpo, seguro e funcionando. Atendemos empresas, condomínios, indústrias e órgãos públicos.',
    contato: 'Terceirização & Facilities',
    whatsapp: 'Olá! Quero um orçamento de terceirização de limpeza ou portaria.',
    acao: { rotulo: 'Simular o orçamento', href: 'home:#simular-orcamento' },
    blocos: [
      {
        tipo: 'cards',
        titulo: 'O que fazemos',
        itens: [
          {
            titulo: 'Limpeza e conservação predial',
            texto: 'Limpeza e conservação profissional com metodologia padronizada, checklists periódicos e supervisão técnica em todas as etapas.',
          },
          {
            titulo: 'Portaria e controle de acesso',
            texto:
              'Portaria e controle de fluxo com foco na segurança do patrimônio e na cordialidade do atendimento, seguindo os protocolos da nossa equipe técnica.',
          },
          { titulo: 'Recepção e apoio administrativo', texto: 'Profissionais para a recepção e o apoio administrativo do dia a dia do prédio.' },
          { titulo: 'Supervisão com checklist digital', texto: 'Cada posto de trabalho é acompanhado pela supervisão, com checklist digital.' },
        ],
      },
      {
        tipo: 'cards',
        titulo: 'Como cuidamos da qualidade',
        itens: [
          { titulo: 'Padrão de qualidade', texto: 'Checklists periódicos e supervisão técnica em todas as etapas da operação.' },
          { titulo: 'Capacitação contínua', texto: 'Treinamento da equipe com foco na padronização dos procedimentos e na segurança.' },
          { titulo: 'Uso consciente de materiais', texto: 'Insumos ecológicos e equipamentos adequados a cada tipo de limpeza.' },
          { titulo: 'Seleção criteriosa', texto: 'Investigação social e entrevistas técnicas para escolher o perfil certo para cada posto.' },
          { titulo: 'Normas e protocolos', texto: 'Seguimos as normas e os protocolos elaborados pela nossa equipe técnica de segurança.' },
          { titulo: 'Postura no atendimento', texto: 'Comunicação clara e conduta ética em todos os pontos de contato.' },
        ],
      },
      {
        tipo: 'lista',
        titulo: 'Para quem é',
        itens: [
          'Indústrias e galpões',
          'Edifícios comerciais e condomínios corporativos',
          'Condomínios residenciais',
          'Prefeituras, secretarias e repartições públicas',
        ],
      },
      POR_QUE_AGIL,
      COMO_PEDIR_ORCAMENTO,
    ],
    faq: [faq('Como recebo o orçamento'), faq('A Ágil CM atende empresas e prefeituras'), faq('Em quais cidades')],
    relacionados: ['limpeza-urbana', 'suprimentos', 'folha-de-pagamento'],
    atualizado: '2026-11-12',
  },
  {
    slug: 'limpeza-urbana',
    nav: 'Limpeza urbana e jardinagem',
    title: 'Capina, roçada e limpeza urbana em MG | Ágil CM',
    description: 'Capina e roçada mecanizada, limpeza de terrenos e logradouros, poda de árvores e jardinagem para prefeituras e empresas de Minas Gerais.',
    eyebrow: 'Manutenção urbana e áreas verdes',
    h1: 'Capina, roçada, limpeza urbana e jardinagem',
    lead: 'Cidades e áreas verdes bem cuidadas, com equipe própria e maquinário moderno. Atendemos prefeituras, autarquias, consórcios intermunicipais e empresas.',
    contato: 'Limpeza Urbana & Jardinagem',
    whatsapp: 'Olá! Quero um orçamento de capina, roçada, limpeza urbana ou jardinagem.',
    acao: { rotulo: 'Simular o orçamento', href: 'home:#simular-orcamento' },
    blocos: [
      {
        tipo: 'cards',
        titulo: 'O que fazemos',
        itens: [
          { titulo: 'Capina e roçada mecanizada', texto: 'Limpeza mecanizada de ruas, praças e logradouros, também em grande escala.' },
          { titulo: 'Limpeza de terrenos', texto: 'Remoção de entulhos, desobstrução e preparação de áreas para novos projetos.' },
          {
            titulo: 'Poda de árvores',
            texto: 'Manutenção preventiva para preservar a saúde e a estética das árvores, com equipamentos adequados para podas de médio e grande porte.',
          },
          {
            titulo: 'Jardinagem e áreas verdes',
            texto: 'Formação e revitalização de jardins, plantio de grama e manutenção diária de canteiros, praças e jardins corporativos.',
          },
        ],
      },
      {
        tipo: 'cards',
        titulo: 'Equipe e equipamentos',
        itens: [
          { titulo: 'Operadores habilitados', texto: 'Equipe treinada para operar roçadeiras, tratores e caminhões de apoio.' },
          { titulo: 'Manutenção preventiva diária', texto: 'Os equipamentos passam por manutenção preventiva todos os dias.' },
          { titulo: 'Segurança nas podas', texto: 'Rigor técnico de segurança nos trabalhos com árvores de médio e grande porte.' },
        ],
      },
      {
        tipo: 'lista',
        titulo: 'Para quem é',
        itens: [
          'Prefeituras e secretarias de obras',
          'Consórcios intermunicipais e autarquias',
          'Distritos industriais e áreas de expansão urbana',
          'Parques, praças e condomínios',
          'Instituições de ensino, hospitais e centros empresariais',
        ],
      },
      POR_QUE_AGIL,
      COMO_PEDIR_ORCAMENTO,
    ],
    faq: [faq('Como recebo o orçamento'), faq('A Ágil CM atende empresas e prefeituras'), faq('Em quais cidades')],
    relacionados: ['terceirizacao', 'suprimentos', 'prefeituras'],
    atualizado: '2026-11-12',
  },
  {
    slug: 'suprimentos',
    nav: 'Fornecimento de suprimentos',
    title: 'Fornecimento de suprimentos para prefeituras | Ágil CM',
    description:
      'Merenda escolar, material escolar e pedagógico, informática, limpeza e utilidades para prefeituras e empresas, com nota fiscal e entrega pontual.',
    eyebrow: 'Suprimentos',
    h1: 'Fornecimento de suprimentos para prefeituras e empresas',
    lead: 'Entrega pontual de materiais com nota fiscal e procedência garantida, para as demandas de rotina e as emergenciais do setor público e privado.',
    contato: 'Fornecimento de Suprimentos',
    whatsapp: 'Olá! Quero um orçamento de fornecimento de suprimentos.',
    blocos: [
      {
        tipo: 'cards',
        titulo: 'O que fornecemos',
        itens: [
          {
            titulo: 'Alimentação e merenda escolar',
            texto: 'Alimentos e materiais de higiene para merenda escolar, unidades de saúde e assistência social.',
          },
          { titulo: 'Material escolar e pedagógico', texto: 'Papelaria, brinquedos educativos e materiais para programas pedagógicos.' },
          { titulo: 'Informática e eletrônicos', texto: 'Computadores, equipamentos eletrônicos, cabos e periféricos.' },
          { titulo: 'Limpeza, higiene e utilidades', texto: 'Utensílios, ferramentas e produtos para organização predial e industrial.' },
        ],
      },
      { tipo: 'texto', titulo: 'Como entregamos', paragrafos: [suprimentos.fullDescription] },
      {
        tipo: 'lista',
        titulo: 'Para quem é',
        itens: ['Secretarias de Educação e de Saúde', 'Almoxarifados públicos e privados', 'Centros de assistência social', 'Bancos e redes corporativas'],
      },
      {
        tipo: 'destaque',
        titulo: 'Fornecedor do poder público',
        texto: 'A Ágil CM também vende para prefeituras e órgãos públicos, com documentação pronta para licitações e contratações diretas.',
        link: { rotulo: 'Ver os editais abertos em Minas Gerais', href: 'rota:licitacoes' },
      },
    ],
    faq: [faq('A Ágil CM atende empresas e prefeituras'), faq('Em quais cidades')],
    relacionados: ['terceirizacao', 'limpeza-urbana', 'assessoria-licitacoes'],
    atualizado: '2026-11-12',
  },
  {
    slug: 'prefeituras',
    nav: 'Consultoria para prefeituras',
    title: 'Consultoria para prefeituras: GILRAT, INSS e folha | Ágil CM',
    description:
      'Estudo do GILRAT, reparcelamento de débitos previdenciários e consultoria de folha e RH para prefeituras. Mais fôlego para o caixa do município.',
    eyebrow: 'Para prefeituras e órgãos públicos',
    h1: 'Consultoria para prefeituras e órgãos públicos',
    lead: 'Estudos tributários, reparcelamento de dívidas e gestão de RH para o município investir mais em saúde, educação e obras.',
    contato: 'Gestão de RH & Compliance',
    whatsapp: 'Olá! Sou de uma prefeitura e quero falar sobre a consultoria da Ágil CM.',
    blocos: [
      {
        tipo: 'cards',
        titulo: 'Três frentes de trabalho',
        itens: [
          { titulo: frase(gilrat.title), texto: gilrat.shortDescription, href: 'servico:gilrat' },
          { titulo: frase(reparcelamento.title), texto: reparcelamento.shortDescription, href: 'servico:reparcelamento-previdenciario' },
          { titulo: 'Consultoria de folha, RH e compliance', texto: folhaPublica.shortDescription },
        ],
      },
      { tipo: 'texto', titulo: 'Consultoria de folha, RH e compliance', paragrafos: [folhaPublica.fullDescription] },
      { tipo: 'cards', titulo: 'O que a consultoria de folha revisa', itens: beneficios('gestao-rh-compliance') },
      COMO_TRABALHAMOS_MUNICIPIO,
      {
        tipo: 'lista',
        titulo: 'Também atendemos o município com',
        itens: [
          { texto: 'Limpeza e portaria de prédios públicos', href: 'servico:terceirizacao' },
          { texto: 'Capina, roçada e jardinagem urbana', href: 'servico:limpeza-urbana' },
          { texto: 'Merenda, material escolar e suprimentos', href: 'servico:suprimentos' },
        ],
      },
    ],
    faq: [faq('Como funciona o estudo do GILRAT'), faq('O PEM acabou'), faq('A Ágil CM atende empresas e prefeituras')],
    relacionados: ['gilrat', 'reparcelamento-previdenciario', 'limpeza-urbana'],
    atualizado: '2026-11-12',
  },
  {
    slug: 'gilrat',
    nav: 'Estudo do GILRAT',
    title: 'Estudo de readequação do GILRAT para prefeituras | Ágil CM',
    description:
      'Estudo técnico da folha do município para verificar se o GILRAT pode ser readequado de 2% para 1%, com compensação no INSS mensal e seguro garantia.',
    eyebrow: 'Para prefeituras e órgãos públicos',
    h1: 'Estudo de readequação do GILRAT para prefeituras',
    lead: 'Estudamos a folha do município para verificar se a alíquota do GILRAT pode cair de 2% para 1%. O resultado depende da realidade de cada folha, e apresentamos a conclusão com total transparência.',
    contato: 'Readequação do GILRAT',
    whatsapp: 'Olá! Quero saber mais sobre o estudo de readequação do GILRAT para o meu município.',
    blocos: [
      {
        tipo: 'texto',
        titulo: 'O que é o GILRAT',
        paragrafos: [
          'O GILRAT é a contribuição previdenciária que financia os benefícios por acidente de trabalho e a aposentadoria especial. Ele é calculado sobre a folha de pagamento, com alíquota de 1%, 2% ou 3%, conforme o grau de risco da atividade preponderante (Lei 8.212/1991, art. 22, II).',
          gilrat.fullDescription,
        ],
      },
      { tipo: 'cards', titulo: 'O que o estudo entrega', itens: beneficios('readequacao-gilrat') },
      {
        tipo: 'lista',
        titulo: 'O que pode mudar para o município',
        itens: [gilrat.simulationData!.avgSaving, gilrat.simulationData!.impact, gilrat.simulationData!.timeline],
      },
      COMO_TRABALHAMOS_MUNICIPIO,
    ],
    faq: [
      faq('Como funciona o estudo do GILRAT'),
      {
        q: 'A redução do GILRAT é garantida?',
        a: 'Não. O resultado depende do estudo da folha de cada município, por isso não prometemos a redução antes. Apresentamos o resultado real do estudo, com matriz de riscos fundamentada.',
      },
      {
        q: 'Como o município aproveita a diferença?',
        a: 'Se a readequação for viável, a diferença pode ser compensada diretamente no recolhimento mensal do INSS. Quando a readequação é aplicada, oferecemos apólice de seguro garantia para dar segurança ao gestor e ao município.',
      },
    ],
    relacionados: ['prefeituras', 'reparcelamento-previdenciario'],
    atualizado: '2026-11-12',
  },
  {
    slug: 'reparcelamento-previdenciario',
    nav: 'Reparcelamento previdenciário',
    title: 'Reparcelamento da dívida do INSS do município | Ágil CM',
    description:
      'Diagnóstico da dívida previdenciária do município e comparação das modalidades de parcelamento para chegar a uma parcela que cabe no orçamento.',
    eyebrow: 'Para prefeituras e órgãos públicos',
    h1: 'Reparcelamento de débitos previdenciários do município',
    lead: 'Encontramos a melhor forma de reparcelar a dívida do município com o INSS, com uma parcela que cabe no orçamento e mais fôlego no caixa mensal.',
    contato: 'Reparcelamento Previdenciário',
    whatsapp: 'Olá! Quero falar sobre o reparcelamento dos débitos previdenciários do meu município.',
    blocos: [
      { tipo: 'texto', titulo: 'Como funciona', paragrafos: [reparcelamento.fullDescription] },
      { tipo: 'cards', titulo: 'O que fazemos', itens: beneficios('reparcelamento-previdenciario') },
      COMO_TRABALHAMOS_MUNICIPIO,
    ],
    faq: [faq('O PEM acabou'), faq('A Ágil CM atende empresas e prefeituras')],
    relacionados: ['prefeituras', 'gilrat'],
    atualizado: '2026-11-12',
  },
  {
    slug: 'folha-de-pagamento',
    nav: 'Folha de pagamento, DP e RH',
    title: 'Folha de pagamento, DP e RH para empresas | Ágil CM',
    description:
      'Folha de pagamento e Departamento Pessoal terceirizados, consultoria de RH e revisão de cálculos e encargos, com eSocial, FGTS Digital e DCTFWeb em dia.',
    eyebrow: 'Departamento Pessoal e RH',
    h1: 'Folha de pagamento, Departamento Pessoal e consultoria de RH',
    lead: 'Cuidamos da folha e do Departamento Pessoal da sua empresa, revisamos cálculos e encargos e estruturamos o RH para crescer com segurança trabalhista.',
    contato: 'Folha de Pagamento & DP',
    whatsapp: 'Olá! Quero falar sobre folha de pagamento, Departamento Pessoal ou RH.',
    blocos: [
      { tipo: 'texto', titulo: 'Folha de pagamento e Departamento Pessoal', paragrafos: [folha.fullDescription] },
      { tipo: 'cards', titulo: 'O que assumimos no Departamento Pessoal', itens: beneficios('folha-pagamento') },
      {
        tipo: 'lista',
        titulo: 'O que revisamos na folha',
        itens: [
          'Revisão e ajuste de cálculos da folha',
          'Incidências de INSS, FGTS e IRRF nas verbas',
          'Insalubridade e periculosidade no grau certo',
          'Horas extras, adicionais e médias',
          'Conferência de férias, 13º e rescisões',
          'Regras de ponto e banco de horas',
          'Conferência de eSocial, FGTS Digital e DCTFWeb',
          'Encargos certos, sem pagar a mais',
        ],
      },
      { tipo: 'texto', titulo: 'Consultoria de RH para empresas', paragrafos: [rhEmpresas.fullDescription] },
      {
        tipo: 'cards',
        titulo: 'O que a consultoria de RH inclui',
        itens: [
          ...beneficios('consultoria-rh-empresas'),
          { titulo: 'Políticas internas e regulamentos', texto: 'Regras claras para a equipe e para a empresa.' },
          { titulo: 'Avaliação de desempenho', texto: 'Acompanhamento estruturado do desempenho dos colaboradores.' },
        ],
      },
    ],
    faq: [faq('Vocês fazem a folha de pagamento'), faq('Quanto custa um funcionário'), faq('Minha empresa pode estar pagando imposto a mais')],
    relacionados: ['recuperacao-tributaria', 'assessoria-licitacoes', 'terceirizacao'],
    atualizado: '2026-11-12',
  },
  {
    slug: 'recuperacao-tributaria',
    nav: 'Recuperação tributária',
    title: 'Recuperação tributária e auditoria de folha | Ágil CM',
    description:
      'Auditoria de até 5 anos de folha, eSocial e DCTFWeb para encontrar INSS e FGTS pagos a mais. Diagnóstico sem custo: você só paga se recuperar.',
    eyebrow: 'Auditoria de folha e recuperação tributária',
    h1: 'Auditoria de folha e recuperação tributária',
    lead: 'Erros de enquadramento e de base de cálculo são comuns e se repetem todo mês. Encontramos o imposto pago a mais na folha e buscamos a devolução dos últimos 5 anos.',
    contato: 'Auditoria de Folha & Recuperação Tributária',
    whatsapp: 'Olá! Quero o diagnóstico gratuito de recuperação tributária da folha.',
    blocos: [
      {
        tipo: 'passos',
        titulo: 'Como funciona',
        itens: [
          { titulo: 'Diagnóstico sem custo', texto: 'Você nos envia folhas e guias dos últimos 5 anos.' },
          { titulo: 'Cruzamento de dados', texto: 'Comparamos folha, eSocial, DCTFWeb e contabilidade em busca de diferenças.' },
          { titulo: 'Validação técnica', texto: 'Cada oportunidade é conferida e só seguimos com teses consolidadas.' },
          { titulo: 'Recuperação', texto: 'Compensamos com tributos futuros ou pedimos a restituição à Receita.' },
        ],
      },
      { tipo: 'texto', titulo: 'Como é a análise', paragrafos: [auditoria.fullDescription] },
      { tipo: 'cards', titulo: 'O que revisamos', itens: beneficios('auditoria-folha-recuperacao') },
      { tipo: 'destaque', titulo: 'Você só paga se recuperar', texto: auditoria.pricing! },
    ],
    faq: [faq('Minha empresa pode estar pagando imposto a mais'), faq('Quanto custa um funcionário')],
    relacionados: ['folha-de-pagamento', 'assessoria-licitacoes'],
    atualizado: '2026-11-12',
  },
  {
    slug: 'assessoria-licitacoes',
    nav: 'Assessoria em licitações',
    title: 'Assessoria em licitações públicas para empresas | Ágil CM',
    description:
      'Monitoramento de editais, habilitação, proposta e pregão eletrônico até o empenho. Assessoria para empresas venderem a prefeituras e órgãos públicos.',
    eyebrow: 'Licitações públicas',
    h1: 'Assessoria em licitações públicas',
    lead: 'Prefeituras e órgãos públicos compram de tudo, o ano inteiro. Cuidamos da burocracia, dos documentos e do pregão para sua empresa disputar e vencer com segurança, dentro da Lei 14.133/2021.',
    contato: 'Assessoria em Licitações',
    whatsapp: 'Olá! Quero vender para prefeituras e órgãos públicos com a assessoria da Ágil CM.',
    acao: { rotulo: 'Ver editais abertos em MG', href: 'rota:licitacoes' },
    blocos: [
      {
        tipo: 'passos',
        titulo: 'Cuidamos de tudo, do edital ao empenho',
        itens: [
          { titulo: 'Monitoramos os editais', texto: 'Buscamos todos os dias as licitações compatíveis com o que sua empresa vende.' },
          { titulo: 'Analisamos o edital', texto: 'Lemos as exigências, apontamos riscos e fazemos pedidos de esclarecimento ou impugnação.' },
          { titulo: 'Preparamos a habilitação', texto: 'Certidões, balanço, atestados técnicos e cadastro no SICAF, sempre em dia.' },
          { titulo: 'Montamos a proposta', texto: 'Planilha de custos, proposta comercial e documentos no formato que o edital pede.' },
          { titulo: 'Disputamos o pregão', texto: 'Operamos a sala de lances com estratégia de preço e acompanhamos cada fase.' },
          { titulo: 'Acompanhamos até o empenho', texto: 'Recursos, homologação, assinatura do contrato e emissão da nota de empenho.' },
        ],
      },
      {
        tipo: 'destaque',
        titulo: 'Por que com a Ágil CM?',
        texto: 'Nós também vendemos para o poder público. Conhecemos na prática os editais, os portais e o que derruba uma proposta.',
      },
      {
        tipo: 'lista',
        titulo: 'Segmentos que atendemos',
        itens: [
          'Alimentação e merenda',
          'Material escolar e de escritório',
          'Informática e tecnologia',
          'Limpeza e higiene',
          'Serviços terceirizados',
          'Saúde e hospitalar',
          'Obras e manutenção',
          'Veículos e combustíveis',
        ],
      },
      {
        tipo: 'lista',
        titulo: 'Portais que operamos',
        itens: ['Compras.gov.br', 'BLL Compras', 'Licitanet', 'Portal de Compras Públicas', 'BNC Compras'],
      },
      { tipo: 'destaque', titulo: 'Como cobramos', texto: licitacoes.pricing! },
      {
        tipo: 'destaque',
        titulo: 'Painel de licitações gratuito',
        texto:
          'No painel de licitações do site você consulta os editais abertos e o histórico de compras das prefeituras de Minas Gerais, com dados oficiais do PNCP e foco na Zona da Mata.',
        link: { rotulo: 'Abrir o painel de licitações', href: 'rota:licitacoes' },
      },
    ],
    faq: [faq('Nunca vendi para prefeitura'), faq('A Ágil CM atende empresas e prefeituras'), faq('Em quais cidades')],
    relacionados: ['folha-de-pagamento', 'recuperacao-tributaria', 'suprimentos'],
    atualizado: '2026-11-12',
  },
];

export const paginaServico = (slug: string) => PAGINAS_SERVICO.find((p) => p.slug === slug);
