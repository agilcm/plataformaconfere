export interface OperationalServiceItem {
  id: string;
  category: 'facilities' | 'seguranca' | 'urbana' | 'paisagismo' | 'suprimentos';
  number: string;
  title: string;
  subtitle: string;
  shortDescription: string;
  fullDescription: string;
  image?: string;
  badges: string[];
  pillars: { title: string; desc: string }[];
  idealFor: string[];
}

export interface ConsultingServiceItem {
  id: string;
  audience: 'publico' | 'empresas';
  number: string;
  title: string;
  subtitle: string;
  highlight: string;
  pricing?: string; // como cobramos (mostrado no card)
  shortDescription: string;
  fullDescription: string;
  benefits: { title: string; desc: string }[];
  simulationData?: {
    avgSaving: string;
    timeline: string;
    impact: string;
  };
}

export const COMPANY_PROFILE = {
  name: 'Ágil CM',
  brandName: 'ÁGIL CM',
  tagline: 'SOLUÇÕES INTEGRADAS',
  subtagline: 'Terceirização · Facilities · Suprimentos · Apoio Operacional',
  consultingTagline: 'Estratégia em RH, Folha de Pagamento, Compliance Trabalhista e Inteligência Tributária para órgãos públicos e empresas',
  email: 'contato@agilcm.com.br',
  phoneDisplay: '(32) 9 9921-7912',
  phoneRaw: '5532999217912',
  city: 'Astolfo Dutra, MG',
  region: 'Zona da Mata mineira',
  cityShort: 'Astolfo Dutra',
  cnpj: '51.328.978/0001-18',
  inscricaoEstadual: '0046589030065',
  representative: 'Elizangela Y Pinho Correa',
  representativeRole: 'Representante legal da empresa',
  coverage: 'Atendimento a órgãos públicos e empresas privadas em Minas Gerais, Rio de Janeiro, São Paulo e todo o território nacional.',
  domain: 'agilcm.com.br',
};

// Services from Presentation 1 (Terceirização, Facilities, Suprimentos)
export const OPERATIONAL_SERVICES: OperationalServiceItem[] = [
  {
    id: 'limpeza-conservacao',
    category: 'facilities',
    number: '01',
    title: 'Limpeza e Conservação',
    subtitle: 'Zeladoria profissional, sanitização técnica e conservação contínua',
    shortDescription: 'Padrão de qualidade com checklists periódicos e supervisão técnica rigorosa em todas as etapas, com equipe capacitada e uso consciente de maquinário de ponta.',
    fullDescription: 'Atuamos na limpeza e conservação profissional com metodologia padronizada. Garantimos supervisão técnica ativa, treinamento focado na padronização de procedimentos e controle estrito no uso de materiais ecológicos e equipamentos modernos.',
    badges: ['Padrão de Qualidade Rigoroso', 'Supervisão Técnica', 'Equipamentos de Ponta'],
    pillars: [
      { title: 'Padrão de Qualidade', desc: 'Checklists periódicos e supervisão técnica rigorosa em todas as etapas operacionais.' },
      { title: 'Capacitação Contínua', desc: 'Treinamento de equipe focado na padronização de procedimentos e segurança.' },
      { title: 'Uso Consciente', desc: 'Utilização adequada de insumos ecológicos e equipamentos industriais de ponta.' }
    ],
    idealFor: ['Indústrias', 'Condomínios corporativos', 'Grandes usinas', 'Órgãos e repartições públicas']
  },
  {
    id: 'portaria-controle',
    category: 'seguranca',
    number: '02',
    title: 'Portaria e Controle de Acesso',
    subtitle: 'Rigor e segurança absoluta com atendimento de excelência',
    shortDescription: 'Equipes rigorosamente selecionadas com investigação social profunda e treinadas para garantir a tranquilidade do patrimônio e cordialidade no atendimento.',
    fullDescription: 'Portaria e controle de fluxo com foco em segurança patrimonial e postura exemplar. Seguimento estrito de normas e protocolos elaborados pela nossa equipe técnica de segurança, assegurando perfil ideal e comunicação assertiva.',
    badges: ['Investigação Social', 'Protocolos Rígidos', 'Postura Exemplar'],
    pillars: [
      { title: 'Seleção Estratégica', desc: 'Investigação social profunda e entrevistas técnicas criteriosas para assegurar o perfil ideal.' },
      { title: 'Conformidade e Normas', desc: 'Seguimento rigoroso das normas e protocolos elaborados pela equipe técnica de segurança.' },
      { title: 'Postura Exemplar', desc: 'Comunicação assertiva, conduta ética e inteligência operacional em todos os pontos de contato.' }
    ],
    idealFor: ['Edifícios comerciais', 'Sedes governamentais', 'Indústrias e galpões', 'Condomínios residenciais de alto padrão']
  },
  {
    id: 'manutencao-limpeza-urbana',
    category: 'urbana',
    number: '03',
    title: 'Manutenção e Limpeza Urbana',
    subtitle: 'Infraestrutura urbana de alta performance para espaços públicos',
    shortDescription: 'Conservação e sustentabilidade de espaços públicos e privados, com capina mecanizada, roçada de logradouros e limpeza técnica de terrenos.',
    fullDescription: 'Operações de infraestrutura urbana com maquinário mecanizado de alta produtividade. Atendemos prefeituras, autarquias, consórcios intermunicipais e empresas com demandas de roçada em grande escala, remoção de entulhos e revitalização de espaços.',
    badges: ['Capina Mecanizada', 'Limpeza de Terrenos', 'Sustentabilidade Urbana'],
    pillars: [
      { title: 'Capina e Roçada', desc: 'Limpeza mecanizada de ruas, praças e logradouros com tecnologia moderna para resultados precisos e duradouros.' },
      { title: 'Limpeza de Terrenos', desc: 'Remoção técnica de entulhos, desobstrução e preparação estratégica de áreas para novos projetos urbanos.' },
      { title: 'Equipamentos Pesados', desc: 'Operadores habilitados com roçadeiras, tratores e caminhões de suporte com manutenção preventiva diária.' }
    ],
    idealFor: ['Prefeituras e Secretarias de Obras', 'Consórcios intermunicipais', 'Distritos industriais', 'Grandes áreas de expansão urbana']
  },
  {
    id: 'jardinagem-paisagismo',
    category: 'paisagismo',
    number: '04',
    title: 'Jardinagem e Paisagismo',
    subtitle: 'Solução integral para áreas verdes e manutenção paisagística',
    shortDescription: 'Poda técnica de árvores para saúde e estética, formação de jardins, plantio de grama, controle de vegetação e manutenção diária para áreas verdes impecáveis.',
    fullDescription: 'Equipe especializada em manejo arbóreo e conservação de canteiros, praças e jardins corporativos. Combinamos sensibilidade estética com rigor técnico de segurança para podas de médio e grande porte com equipamentos adequados.',
    badges: ['Poda Técnica', 'Plantio de Grama', 'Áreas Harmoniosas'],
    pillars: [
      { title: 'Poda de Árvores', desc: 'Manutenção técnica preventiva para preservar a saúde biológica e estética arbórea.' },
      { title: 'Formação de Jardins', desc: 'Criação e revitalização de áreas verdes harmoniosas e sustentáveis.' },
      { title: 'Roçagem & Manutenção Diária', desc: 'Controle contínuo de vegetação e plantio de grama para relvados saudáveis.' }
    ],
    idealFor: ['Parques municipais e praças', 'Centros empresariais', 'Condomínios horizontais', 'Instituições de ensino e hospitais']
  },
  {
    id: 'suprimentos-backoffice',
    category: 'suprimentos',
    number: '05',
    title: 'Portfólio de Suprimentos & Back Office',
    subtitle: 'Logística integrada com procedência garantida para demandas estratégicas',
    shortDescription: 'Fornecimento ágil para Nutrição (merenda/higiene), Educação (papelaria/pedagógico), Tecnologia (eletrônicos/periféricos) e Utilidades industriais.',
    fullDescription: 'Hub completo de suprimentos para atender demandas rotineiras e emergenciais do setor público e privado. Gestão de entrega pontual com rigor fiscal e garantia de qualidade em cada lote entregue.',
    badges: ['Logística Integrada', 'Procedência Garantida', 'Amplo Catálogo'],
    pillars: [
      { title: 'Nutrição & Higiene', desc: 'Alimentos e materiais de higiene para merenda escolar, unidades de saúde e assistência social.' },
      { title: 'Educação & Pedagógico', desc: 'Papelaria técnica, brinquedos educativos e materiais para programas pedagógicos.' },
      { title: 'Tecnologia & Informática', desc: 'Equipamentos eletrônicos, computadores, cabos e periféricos de informática.' },
      { title: 'Utilidades & Organização', desc: 'Utensílios domésticos, ferramentas e produtos para organização industrial e predial.' }
    ],
    idealFor: ['Secretarias de Educação e Saúde', 'Almoxarifados públicos e privados', 'Bancos e redes corporativas', 'Centros de assistência social']
  }
];

// Opções do formulário de contato; os cards de consultoria pré-selecionam a opção correspondente
export const CONTACT_OPTIONS: { value: string; label: string }[] = [
  { value: 'Terceirização & Facilities', label: 'Terceirização & Facilities (Limpeza / Portaria)' },
  { value: 'Limpeza Urbana & Jardinagem', label: 'Limpeza Urbana, Capina Mecanizada & Jardinagem' },
  { value: 'Fornecimento de Suprimentos', label: 'Fornecimento de Suprimentos & Merenda / Educação' },
  { value: 'Readequação do GILRAT', label: 'Estudo de Readequação do GILRAT' },
  { value: 'Reparcelamento Previdenciário', label: 'Reparcelamento de Débitos Previdenciários do Município' },
  { value: 'Gestão de RH & Compliance', label: 'Consultoria de Folha, RH & Compliance (Órgãos Públicos)' },
  { value: 'Consultoria de RH para Empresas', label: 'Consultoria de RH para Empresas' },
  { value: 'Folha de Pagamento & DP', label: 'Folha de Pagamento & Departamento Pessoal' },
  { value: 'Auditoria de Folha & Recuperação Tributária', label: 'Auditoria de Folha & Recuperação Tributária' },
  { value: 'Assessoria em Licitações', label: 'Assessoria em Licitações Públicas' },
];

export const CONSULTING_TO_CONTACT: Record<string, string> = {
  'readequacao-gilrat': 'Readequação do GILRAT',
  'reparcelamento-previdenciario': 'Reparcelamento Previdenciário',
  'gestao-rh-compliance': 'Gestão de RH & Compliance',
  'consultoria-rh-empresas': 'Consultoria de RH para Empresas',
  'folha-pagamento': 'Folha de Pagamento & DP',
  'auditoria-folha-recuperacao': 'Auditoria de Folha & Recuperação Tributária',
  'assessoria-licitacoes': 'Assessoria em Licitações',
};


export const whatsappLink = (text: string) =>
  `https://wa.me/${COMPANY_PROFILE.phoneRaw}?text=${encodeURIComponent(text)}`;

export const formatBRL = (value: number, fractionDigits = 0) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

// Consultoria: GILRAT, reparcelamento previdenciário, RH, folha e IR
// Terceirização resumida em 3 grupos (seção principal do site)
export interface OperationalGroup {
  id: string;
  title: string;
  description: string;
  items: string[];
  quoteServiceId: string; // serviço pré-selecionado no simulador de orçamento
  icon: 'building' | 'tree' | 'box';
}

export const OPERATIONAL_GROUPS: OperationalGroup[] = [
  {
    id: 'facilities',
    title: 'Limpeza, Conservação e Portaria',
    description: 'Equipes treinadas e supervisionadas para manter seu prédio limpo, seguro e funcionando.',
    items: ['Limpeza e conservação predial', 'Portaria e controle de acesso', 'Recepção e apoio administrativo', 'Supervisão com checklist digital'],
    quoteServiceId: 'limpeza-conservacao',
    icon: 'building',
  },
  {
    id: 'urbana',
    title: 'Manutenção Urbana e Jardinagem',
    description: 'Cidades e áreas verdes bem cuidadas, com equipe própria e maquinário moderno.',
    items: ['Capina e roçada mecanizada', 'Limpeza de terrenos e logradouros', 'Poda de árvores e jardinagem', 'Plantio e manutenção de áreas verdes'],
    quoteServiceId: 'manutencao-limpeza-urbana',
    icon: 'tree',
  },
  {
    id: 'suprimentos',
    title: 'Fornecimento de Suprimentos',
    description: 'Entrega pontual de materiais com nota fiscal e procedência garantida.',
    items: ['Alimentação e merenda escolar', 'Material escolar e pedagógico', 'Informática e eletrônicos', 'Limpeza, higiene e utilidades'],
    quoteServiceId: 'suprimentos-backoffice',
    icon: 'box',
  },
];

export const CONSULTING_SERVICES: ConsultingServiceItem[] = [
  {
    id: 'readequacao-gilrat',
    audience: 'publico',
    number: '01',
    title: 'Estudo de Readequação do GILRAT',
    subtitle: 'Estudo técnico da folha para verificar a possibilidade de reduzir a alíquota de 2% para 1%',
    highlight: 'Estudo técnico da folha',
    shortDescription: 'Estudamos a folha do município para verificar se o GILRAT pode cair de 2% para 1%.',
    fullDescription: 'O estudo da Ágil CM analisa os dados da folha do município para identificar a atividade preponderante, como a Educação, enquadrada como risco leve. Se o estudo confirmar esse enquadramento, a alíquota pode ser readequada de 2% para 1%, com compensação no recolhimento mensal do INSS. O resultado depende da realidade de cada folha, e apresentamos a conclusão com total transparência.',
    benefits: [
      { title: 'Estudo Técnico e Jurídico da Folha', desc: 'Levantamento da distribuição de servidores por atividade para fundamentar, ou não, o enquadramento em risco leve.' },
      { title: 'Possível Compensação no INSS do Mês', desc: 'Se a readequação for viável, a diferença pode ser compensada diretamente no recolhimento mensal do INSS.' },
      { title: 'Seguro Garantia da Operação', desc: 'Quando a readequação é aplicada, oferecemos apólice de seguro garantia para dar segurança ao gestor e ao município.' },
      { title: 'Trabalho Pautado na Sinceridade', desc: 'Apresentamos o resultado real do estudo, com matriz de riscos fundamentada e sem promessas.' }
    ],
    simulationData: {
      avgSaving: 'Potencial de 1% da folha, se o estudo confirmar',
      timeline: 'Aplicação após conclusão do estudo técnico',
      impact: 'Possível redução de 50% na carga de GILRAT'
    }
  },
  {
    id: 'reparcelamento-previdenciario',
    audience: 'publico',
    number: '02',
    title: 'Reparcelamento de Débitos Previdenciários',
    subtitle: 'A melhor forma de reparcelar a dívida do município, com mais fôlego no caixa mensal',
    highlight: 'Mais fôlego no caixa mensal',
    shortDescription: 'Encontramos a melhor forma de reparcelar a dívida do INSS, com parcela que cabe no orçamento.',
    fullDescription: 'Fazemos o diagnóstico completo dos débitos previdenciários do município, comparamos as modalidades de parcelamento e renegociação disponíveis e estruturamos a opção com as melhores condições, para que a parcela caiba no orçamento e a prefeitura ganhe fôlego mensal para investir em saúde, educação e obras.',
    benefits: [
      { title: 'Diagnóstico Completo do Passivo', desc: 'Levantamento dos débitos previdenciários, parcelamentos em andamento, multas e juros incidentes.' },
      { title: 'Melhor Modalidade Disponível', desc: 'Comparação das opções de parcelamento e renegociação para escolher a de melhores condições para o município.' },
      { title: 'Parcela que Cabe no Orçamento', desc: 'Estruturação do reparcelamento com foco em reduzir o peso mensal sobre a Receita Corrente Líquida.' },
      { title: 'Acompanhamento Contínuo', desc: 'Monitoramento das parcelas e das certidões para manter a regularidade previdenciária do município.' }
    ]
  },
  {
    id: 'gestao-rh-compliance',
    audience: 'publico',
    number: '03',
    title: 'Consultoria de Folha, RH & Compliance',
    subtitle: 'Cálculos e encargos da folha revisados, rotinas de RH seguras',
    highlight: 'Encargos certos, sem passivos',
    shortDescription: 'Consultoria para a folha pagar e recolher certo: incidências de INSS, adicionais e rotinas alinhadas ao eSocial e ao Tribunal de Contas.',
    fullDescription: 'Revisamos os cálculos da folha do município e orientamos a equipe de RH: quais verbas têm incidência de INSS, FGTS e IRRF, se insalubridade e periculosidade estão sendo pagas a quem tem direito e no grau certo, e se as rotinas atendem ao eSocial e ao Tribunal de Contas. Adicional ou encargo pago errado aumenta o risco de passivo e o custo da folha.',
    benefits: [
      { title: 'Incidências de INSS na folha', desc: 'Conferência das verbas com e sem incidência de INSS, FGTS e IRRF, para não recolher a mais nem a menos.' },
      { title: 'Insalubridade e periculosidade corretas', desc: 'Revisão de laudos, graus e base de cálculo: adicional pago sem fundamento aumenta encargos e risco; pago a menos gera ação.' },
      { title: 'Horas extras, adicionais e médias', desc: 'Cálculo e reflexos revisados em férias, 13º e rescisões.' },
      { title: 'Ajuste de cálculos e encargos', desc: 'Correção do que estiver errado e orientação para a equipe aplicar todo mês.' },
      { title: 'Compliance com eSocial e TCE', desc: 'Rotinas e informações alinhadas ao eSocial e às exigências do Tribunal de Contas.' }
    ]
  },
  {
    id: 'consultoria-rh-empresas',
    audience: 'empresas',
    number: '04',
    title: 'Consultoria de RH para Empresas',
    subtitle: 'Gestão de pessoas estruturada para crescer com segurança trabalhista',
    highlight: 'RH estratégico sob medida',
    shortDescription: 'Estruturamos o RH da sua empresa para crescer com segurança trabalhista.',
    fullDescription: 'Atuamos como o RH estratégico de pequenas, médias e grandes empresas, da implantação de processos à auditoria de rotinas já existentes, sempre alinhados à CLT, às convenções coletivas e ao eSocial.',
    benefits: [
      { title: 'Cargos, Salários e Benefícios', desc: 'Plano de cargos e salários, política de benefícios e enquadramento correto nas convenções coletivas.' },
      { title: 'Recrutamento e Seleção', desc: 'Definição de perfil, triagem, entrevistas técnicas e integração de novos colaboradores.' },
      { title: 'Prevenção de Passivos', desc: 'Auditoria trabalhista preventiva de jornadas, horas extras, adicionais e documentação de admissão e desligamento.' }
    ]
  },
  {
    id: 'folha-pagamento',
    audience: 'empresas',
    number: '05',
    title: 'Folha de Pagamento & Departamento Pessoal',
    subtitle: 'Terceirização completa do DP com precisão e prazos garantidos',
    highlight: 'Folha em dia, sem multas',
    shortDescription: 'Cuidamos de toda a folha e do Departamento Pessoal, no prazo e sem multas.',
    fullDescription: 'Assumimos as rotinas do Departamento Pessoal com conferência dupla e calendário de obrigações monitorado, para que sua empresa pague certo, no prazo e sem surpresas com o Fisco.',
    benefits: [
      { title: 'Rotinas Completas de DP', desc: 'Admissões, férias, 13º, afastamentos, rescisões e controle de ponto integrados à folha.' },
      { title: 'Obrigações Acessórias em Dia', desc: 'Envio de eventos do eSocial, FGTS Digital, DCTFWeb e guias de recolhimento dentro dos prazos legais.' },
      { title: 'Auditoria de Encargos', desc: 'Revisão de INSS, FGTS e IRRF retidos para eliminar pagamentos indevidos e identificar créditos a recuperar.' }
    ]
  },
  {
    id: 'auditoria-folha-recuperacao',
    audience: 'empresas',
    number: '07',
    title: 'Auditoria de Folha & Recuperação Tributária',
    subtitle: 'Encontramos o imposto pago a mais na sua folha e buscamos a devolução',
    highlight: 'Você só paga se recuperar',
    pricing: 'Diagnóstico inicial sem custo. Honorários apenas sobre o valor efetivamente recuperado ou economizado.',
    shortDescription: 'Encontramos impostos pagos a mais na folha e buscamos a devolução dos últimos 5 anos.',
    fullDescription: 'Analisamos até 5 anos de folhas, guias e declarações (eSocial, DCTFWeb, GFIP) com cruzamento automatizado de dados. Cada oportunidade é validada tecnicamente antes de qualquer pedido, e só trabalhamos com teses consolidadas, sem aventuras jurídicas.',
    benefits: [
      { title: 'Revisão de Bases de Cálculo', desc: 'Identificamos verbas indenizatórias que não deveriam sofrer incidência de INSS e FGTS e corrigimos o cálculo daqui para frente.' },
      { title: 'Enquadramento de RAT, FAP e CNAE', desc: 'Conferimos se a alíquota de risco e o FAP aplicados correspondem à atividade real da empresa.' },
      { title: 'Recuperação dos Últimos 5 Anos', desc: 'Valores pagos indevidamente podem ser compensados com tributos futuros ou restituídos pela Receita Federal.' },
      { title: 'Parcelamento de Dívidas Tributárias', desc: 'Se houver débitos, avaliamos parcelamentos e transações disponíveis para regularizar com a melhor condição.' }
    ]
  },
  {
    id: 'assessoria-licitacoes',
    audience: 'empresas',
    number: '08',
    title: 'Assessoria em Licitações Públicas',
    subtitle: 'Sua empresa vendendo para prefeituras e órgãos públicos, sem travar na burocracia',
    highlight: 'Do edital ao empenho',
    pricing: 'Mensalidade fixa pela operação, mais taxa de êxito sobre os contratos ganhos.',
    shortDescription: 'Sua empresa vendendo para prefeituras: documentação, propostas e pregão eletrônico.',
    fullDescription: 'Somos uma empresa que também fornece para o poder público, e levamos essa experiência para o seu negócio: monitoramos editais, preparamos a habilitação, montamos a proposta e operamos o pregão eletrônico até a homologação, o contrato e a nota de empenho.',
    benefits: [
      { title: 'Monitoramento de Editais', desc: 'Buscamos diariamente as licitações compatíveis com o que sua empresa vende e avisamos as oportunidades.' },
      { title: 'Habilitação Completa', desc: 'Certidões negativas, balanço, atestados de capacidade técnica e cadastros (SICAF e portais) sempre em dia.' },
      { title: 'Análise de Edital e Proposta', desc: 'Leitura das exigências, pedidos de esclarecimento ou impugnação, planilha de custos e proposta comercial.' },
      { title: 'Operação do Pregão Eletrônico', desc: 'Disputa de lances, recursos e acompanhamento até a homologação, o contrato e a nota de empenho.' }
    ]
  }
];
