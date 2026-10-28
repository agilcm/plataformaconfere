// CNAEs da Ágil CM (cartão CNPJ) e os termos que indicam, no objeto do edital, uma compra ligada a cada atividade.
// Termos sem acento e em minúsculas; valem como palavra ou expressão inteira ("toner" não casa com "tonerx").
export const AGIL_CNAES = [
  {
    codigo: '81.21-4-00', descricao: 'Limpeza em prédios e em domicílios', principal: true,
    termos: ['limpeza e conservacao', 'servicos de limpeza', 'servico de limpeza', 'limpeza predial', 'conservacao predial', 'limpeza de predios', 'limpeza hospitalar', 'limpeza de vidros', 'higienizacao de ambientes', 'auxiliar de limpeza', 'auxiliares de limpeza', 'servicos gerais'],
  },
  {
    codigo: '43.21-5-00', descricao: 'Instalação e manutenção elétrica',
    termos: ['instalacoes eletricas', 'instalacao eletrica', 'manutencao eletrica', 'iluminacao publica', 'rede eletrica', 'eletrica predial', 'subestacao', 'quadros eletricos', 'quadro eletrico', 'cabeamento estruturado'],
  },
  {
    codigo: '47.23-7-00', descricao: 'Comércio varejista de bebidas',
    termos: ['bebidas', 'agua mineral', 'galao de agua', 'galoes de agua', 'refrigerantes', 'refrigerante', 'sucos'],
  },
  {
    codigo: '47.29-6-99', descricao: 'Comércio varejista de produtos alimentícios em geral',
    termos: ['generos alimenticios', 'genero alimenticio', 'produtos alimenticios', 'cesta basica', 'cestas basicas', 'merenda escolar', 'alimentacao escolar', 'cafe', 'acucar', 'coffee break', 'kits lanche', 'lanches', 'biscoitos'],
  },
  {
    codigo: '47.51-2-01', descricao: 'Comércio varejista de equipamentos e suprimentos de informática',
    termos: ['equipamentos de informatica', 'suprimentos de informatica', 'material de informatica', 'materiais de informatica', 'computadores', 'computador', 'notebooks', 'notebook', 'impressoras', 'toner', 'toners', 'cartuchos', 'perifericos', 'monitores', 'nobreak', 'nobreaks'],
  },
  {
    codigo: '47.52-1-00', descricao: 'Comércio varejista de equipamentos de telefonia e comunicação',
    termos: ['telefonia', 'aparelhos celulares', 'aparelho celular', 'smartphones', 'aparelhos telefonicos', 'radios comunicadores', 'radio comunicador', 'equipamentos de comunicacao', 'centrais telefonicas', 'central telefonica'],
  },
  {
    codigo: '47.53-9-00', descricao: 'Comércio varejista de eletrodomésticos e equipamentos de áudio e vídeo',
    termos: ['eletrodomesticos', 'eletroportateis', 'eletroeletronicos', 'geladeira', 'geladeiras', 'refrigerador', 'refrigeradores', 'freezer', 'freezers', 'fogao', 'fogoes', 'micro ondas', 'bebedouro', 'bebedouros', 'televisor', 'televisores', 'smart tv', 'projetor', 'projetores', 'caixa de som', 'equipamentos de audio', 'audio e video', 'ar condicionado', 'ventiladores'],
  },
  {
    codigo: '47.55-5-03', descricao: 'Comércio varejista de artigos de cama, mesa e banho',
    termos: ['cama mesa e banho', 'roupas de cama', 'roupa de cama', 'lencois', 'lencol', 'toalhas', 'fronhas', 'cobertores', 'travesseiros', 'colchoes', 'enxoval'],
  },
  {
    codigo: '47.59-8-01', descricao: 'Comércio varejista de artigos de tapeçaria, cortinas e persianas',
    termos: ['cortinas', 'cortina', 'persianas', 'persiana', 'tapetes', 'carpetes', 'tapecaria'],
  },
  {
    codigo: '47.61-0-03', descricao: 'Comércio varejista de artigos de papelaria',
    termos: ['papelaria', 'material de expediente', 'materiais de expediente', 'material escolar', 'materiais escolares', 'papel a4', 'papel sulfite', 'folha sulfite', 'kits escolares', 'material de escritorio', 'materiais de escritorio'],
  },
  {
    codigo: '47.72-5-00', descricao: 'Comércio varejista de cosméticos, produtos de perfumaria e de higiene pessoal',
    termos: ['higiene pessoal', 'kits de higiene', 'kit de higiene', 'cosmeticos', 'perfumaria', 'sabonete', 'sabonetes', 'shampoo', 'creme dental', 'papel higienico', 'fraldas', 'absorventes'],
  },
  {
    codigo: '47.89-0-05', descricao: 'Comércio varejista de produtos saneantes domissanitários',
    termos: ['material de limpeza', 'materiais de limpeza', 'produtos de limpeza', 'saneantes', 'domissanitarios', 'higiene e limpeza', 'desinfetante', 'agua sanitaria', 'detergente', 'alcool em gel', 'sacos de lixo', 'saco de lixo'],
  },
  {
    codigo: '47.89-0-99', descricao: 'Comércio varejista de outros produtos não especificados anteriormente',
    termos: ['utensilios de copa e cozinha', 'copa e cozinha', 'utensilios domesticos', 'descartaveis', 'copos descartaveis', 'utilidades domesticas'],
  },
  {
    codigo: '70.20-4-00', descricao: 'Consultoria em gestão empresarial',
    termos: ['consultoria em gestao', 'assessoria em gestao', 'consultoria administrativa', 'gestao empresarial', 'planejamento estrategico', 'consultoria e assessoria administrativa'],
  },
  {
    codigo: '81.11-7-00', descricao: 'Serviços combinados para apoio a edifícios, exceto condomínios prediais',
    termos: ['facilities', 'apoio predial', 'manutencao predial', 'zeladoria', 'servicos de portaria', 'portaria', 'recepcionista', 'recepcionistas', 'copeira', 'copeiras', 'mao de obra terceirizada', 'cessao de mao de obra', 'postos de trabalho', 'terceirizacao', 'servicos continuados'],
  },
  {
    codigo: '81.30-3-00', descricao: 'Atividades paisagísticas',
    termos: ['paisagismo', 'jardinagem', 'rocada', 'capina', 'poda de arvores', 'areas verdes', 'jardins', 'corte de grama', 'plantio de mudas', 'arborizacao'],
  },
  {
    codigo: '82.11-3-00', descricao: 'Serviços combinados de escritório e apoio administrativo',
    termos: ['apoio administrativo', 'servicos administrativos', 'auxiliar administrativo', 'auxiliares administrativos', 'assistente administrativo', 'recepcao', 'digitacao', 'digitalizacao', 'gestao documental', 'servicos de escritorio'],
  },
  {
    codigo: '85.99-6-04', descricao: 'Treinamento em desenvolvimento profissional e gerencial',
    termos: ['treinamento', 'treinamentos', 'capacitacao', 'capacitacao de servidores', 'qualificacao profissional', 'cursos de capacitacao', 'palestras', 'desenvolvimento profissional', 'formacao continuada'],
  },
  {
    codigo: '95.11-8-00', descricao: 'Reparação e manutenção de computadores e periféricos',
    termos: ['manutencao de computadores', 'manutencao de impressoras', 'manutencao de equipamentos de informatica', 'assistencia tecnica em informatica', 'reparo de computadores', 'suporte tecnico em informatica', 'manutencao preventiva e corretiva de computadores'],
  },
];
