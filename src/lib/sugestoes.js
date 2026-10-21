// Sugestão de editais por empresa (CNAE x objeto do edital).
// Tudo roda no navegador: a planilha do cliente nunca é enviada nem armazenada.
import { microrregiaoDe, normalizeName } from '../data/zonaDaMata.js';

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/* ------------------------------------------------------------------ */
/* 1. Leitura do CSV (exportação "Cadastro geral" do Alterdata)         */
/* ------------------------------------------------------------------ */

function splitCsv(text, sep) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim()));
}

// ="12345" (formato Excel) -> 12345
const unwrap = (v) => String(v ?? '').replace(/^=?"?|"?$/g, '').replace(/^=/, '').trim();
const digits = (v) => unwrap(v).replace(/\D/g, '');

const COLS = {
  codigo: ['codigo da empresa'],
  razao: ['razao social'],
  fantasia: ['nome fantasia'],
  cnpj: ['cnpj cpf limpo', 'cnpj cpf', 'cnpj'],
  tributacao: ['tributacao'],
  status: ['status'],
  matriz: ['matriz filial'],
  atividade: ['descricao da atividade'],
  cidade: ['cidade'],
  uf: ['uf'],
  cnae: ['codigo cnae', 'cnae'],
  porte: ['porte da empresa'],
};

/**
 * Lê o CSV do Alterdata e devolve as empresas aptas a licitar:
 * ativas, com CNPJ, matriz e que não sejam empregador doméstico.
 */
export function parseAlterdataCsv(text) {
  const clean = String(text || '').replace(/^﻿/, '');
  const first = clean.split(/\r?\n/, 1)[0] || '';
  const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
  const rows = splitCsv(clean, sep);
  if (rows.length < 2) throw new Error('Arquivo vazio ou fora do formato esperado.');
  const head = rows[0].map(norm);
  const idx = {};
  for (const [k, names] of Object.entries(COLS)) idx[k] = head.findIndex((h) => names.includes(h));
  if (idx.razao < 0 || idx.cnae < 0) {
    throw new Error('Não encontrei as colunas "Razão Social" e "Código CNAE". Use a exportação "Cadastro geral" do Alterdata.');
  }
  const get = (r, k) => (idx[k] >= 0 ? unwrap(r[idx[k]]) : '');
  const todas = rows.slice(1).map((r) => ({
    codigo: get(r, 'codigo'),
    razao: get(r, 'razao'),
    fantasia: get(r, 'fantasia'),
    cnpj: digits(idx.cnpj >= 0 ? r[idx.cnpj] : ''),
    tributacao: get(r, 'tributacao').toUpperCase(),
    status: get(r, 'status').toUpperCase(),
    matriz: get(r, 'matriz').toUpperCase(),
    atividade: get(r, 'atividade'),
    cidade: get(r, 'cidade'),
    uf: get(r, 'uf').toUpperCase(),
    cnae: digits(get(r, 'cnae')).padStart(7, '0').slice(0, 7),
    porte: get(r, 'porte'),
  }));
  const vistos = new Set();
  const empresas = todas.filter((e) => {
    if (!e.razao || e.cnpj.length !== 14) return false;
    if (e.status && e.status !== 'ATIVO') return false;
    if (e.matriz && e.matriz !== 'MATRIZ') return false;
    if (/DOMEST|DOMÉST/.test(e.tributacao)) return false;
    if (vistos.has(e.cnpj)) return false;
    vistos.add(e.cnpj);
    return true;
  });
  return { empresas, totalLinhas: todas.length };
}

/* ------------------------------------------------------------------ */
/* 2. CNAE -> o que a empresa pode fornecer em licitação               */
/* ------------------------------------------------------------------ */
// p: prefixos de CNAE (o mais longo vence). kw: termos fortes. fraco: termos de apoio (meio peso).

export const CNAE_RULES = [
  { p: ['0810', '0210107'], area: 'Areia, brita e agregados', kw: ['areia', 'brita', 'cascalho', 'pedra britada', 'agregados', 'material de construcao bruto', 'materiais de construcao bruto'] },
  { p: ['0210108'], area: 'Carvão vegetal', kw: ['carvao vegetal'] },
  { p: ['0210106', '4789002'], area: 'Mudas e plantas', kw: ['mudas', 'plantas ornamentais', 'paisagismo', 'jardinagem', 'arborizacao'] },
  { p: ['0230'], area: 'Roçada e apoio florestal', kw: ['rocada', 'capina', 'poda de arvores', 'supressao vegetal'] },
  { p: ['1013', '1012', '1011'], area: 'Carnes e frios', kw: ['carnes', 'frango', 'carne bovina', 'proteina animal'], fraco: ['generos alimenticios', 'merenda'] },
  { p: ['1053'], area: 'Sorvetes e gelados', kw: ['sorvete', 'picole', 'gelados'] },
  { p: ['1064', '1061', '1062', '1063', '1069'], area: 'Farinhas e cereais', kw: ['fuba', 'farinha'], fraco: ['generos alimenticios', 'merenda', 'cesta basica', 'cestas basicas'] },
  { p: ['1091', '1092', '4721'], area: 'Panificação, biscoitos e doces', kw: ['panificacao', 'paes', 'pao frances', 'biscoito', 'biscoitos', 'bolos', 'quitandas', 'doces'], fraco: ['generos alimenticios', 'merenda', 'coffee break', 'lanches'] },
  { p: ['1096', '1099', '5620'], area: 'Alimentos preparados e refeições', kw: ['refeicoes', 'refeicao', 'marmitex', 'marmitas', 'alimentacao preparada', 'coffee break', 'lanches', 'buffet', 'kits lanche'] },
  { p: ['1111'], area: 'Bebidas', kw: [] },
  { p: ['1359', '1411', '1412', '1413', '1414', '4781', '4755503'], area: 'Uniformes e confecção', kw: ['uniforme', 'uniformes', 'fardamento', 'vestuario', 'camisetas', 'camisas', 'jalecos', 'confeccao de uniformes', 'bandeiras', 'enxoval'] },
  { p: ['4782'], area: 'Calçados', kw: ['calcados', 'tenis', 'botinas', 'botas'] },
  { p: ['1610', '1629'], area: 'Madeira', kw: ['madeira', 'madeiras', 'serrados', 'pallets'] },
  { p: ['1813', '1811', '1812', '1821'], area: 'Gráfica e impressos', kw: ['servicos graficos', 'grafica', 'graficos', 'impressos', 'impressao grafica', 'formularios', 'banner', 'materiais impressos', 'adesivos', 'panfletos'] },
  { p: ['2062', '4649408'], area: 'Produtos de limpeza', kw: ['material de limpeza', 'materiais de limpeza', 'produtos de limpeza', 'saneantes', 'higiene e limpeza', 'higienizacao'] },
  { p: ['2342', '2330'], area: 'Cerâmica e artefatos de concreto', kw: ['tijolo', 'tijolos', 'ceramica', 'artefatos de concreto', 'blocos de concreto', 'bloquetes', 'blocos sextavados', 'meio fio', 'manilhas', 'pre moldado', 'artefatos de concreto e barro'] },
  { p: ['2531', '2532', '2539', '2593', '3299003', '2512', '2511'], area: 'Metalurgia e serralheria', kw: ['serralheria', 'estruturas metalicas', 'grades', 'portoes', 'artefatos de metal', 'usinagem', 'caldeiraria', 'alambrado'] },
  { p: ['2829', '2862', '2866', '3321'], area: 'Máquinas e equipamentos', kw: ['equipamentos industriais', 'maquinas e equipamentos', 'instalacao de maquinas', 'equipamentos para cozinha industrial'] },
  { p: ['3101', '3102', '3103', '4754'], area: 'Móveis', kw: ['moveis', 'mobiliario', 'mobiliarios', 'mobiliario escolar', 'cadeiras', 'armarios', 'carteiras escolares', 'estofados'] },
  { p: ['3220'], area: 'Instrumentos musicais', kw: ['instrumentos musicais', 'banda de musica', 'fanfarra'] },
  { p: ['3250706'], area: 'Prótese dentária', kw: ['protese dentaria', 'proteses dentarias', 'laboratorio de protese'] },
  { p: ['3313', '3314', '3317', '3319'], area: 'Manutenção de máquinas e geradores', kw: ['manutencao de geradores', 'grupos geradores', 'grupo gerador', 'manutencao de maquinas', 'manutencao de equipamentos'] },
  { p: ['3811', '3812', '3821', '3822', '3831', '3832', '3839', '4687'], area: 'Resíduos e reciclagem', kw: ['residuos', 'coleta de lixo', 'reciclagem', 'sucata', 'sucatas', 'destinacao final', 'residuos solidos'] },
  { p: ['4120', '4211', '4212', '4213', '4221', '4222', '4291', '4292', '4299', '4311', '4312', '4319', '4322', '4329', '4330', '4391', '4399'], area: 'Obras e engenharia civil', kw: ['execucao de obra', 'obra publica', 'obra de', 'obras de', 'reforma', 'construcao de', 'construcao da', 'construcao do', 'construcao civil', 'pavimentacao', 'calcamento', 'recapeamento', 'tapa buracos', 'terraplenagem', 'drenagem', 'manutencao predial', 'engenharia civil', 'piso intertravado', 'quadra poliesportiva', 'ampliacao'] },
  { p: ['4313'], area: 'Terraplenagem e máquinas', kw: ['terraplenagem', 'estradas vicinais', 'estrada vicinal', 'patrolamento', 'cascalhamento', 'locacao de maquinas', 'horas maquina'], fraco: ['pavimentacao', 'obra de', 'obras de'] },
  { p: ['4321'], area: 'Instalações elétricas', kw: ['instalacoes eletricas', 'instalacao eletrica', 'manutencao eletrica', 'iluminacao publica', 'rede eletrica', 'subestacao', 'eletrica predial', 'usina fotovoltaica'] },
  { p: ['4329101'], area: 'Painéis e comunicação visual', kw: ['paineis publicitarios', 'placas', 'comunicacao visual', 'sinalizacao', 'letreiros', 'banner'] },
  { p: ['4511', '4512', '4541'], area: 'Veículos e motocicletas', kw: ['veiculo automotor', 'veiculos automotores', 'veiculo zero', 'veiculos zero', 'zero km', 'zero quilometro', '0 km', 'motocicletas', 'motocicleta', 'ambulancia', 'utilitario', 'sedan'] },
  { p: ['4520', '4530', '4543'], area: 'Peças e manutenção de veículos', kw: ['pecas automotivas', 'pecas de reposicao', 'manutencao preventiva e corretiva', 'manutencao de veiculos', 'mecanica', 'servicos mecanicos', 'funilaria', 'lanternagem', 'alinhamento', 'balanceamento', 'frota', 'lubrificantes', 'filtros'] },
  { p: ['4520005'], area: 'Lavagem e lubrificação', kw: ['lavagem de veiculos', 'lubrificacao', 'lubrificantes', 'oleos lubrificantes', 'graxas', 'filtros', 'higienizacao dos veiculos'] },
  { p: ['4520006'], area: 'Pneus e borracharia', kw: ['pneus', 'pneu', 'camaras de ar', 'borracharia', 'recapagem', 'reforma de pneus', 'protetores'] },
  { p: ['4633'], area: 'Hortifruti', kw: ['hortifrutigranjeiros', 'hortifruti', 'frutas', 'verduras', 'legumes', 'hortalicas', 'ovos'], fraco: ['generos alimenticios', 'merenda'] },
  { p: ['4635', '4723'], area: 'Bebidas e água mineral', kw: ['agua mineral', 'bebidas', 'refrigerantes', 'galao de agua', 'sucos'] },
  { p: ['4645', '4773', '4664'], area: 'Material médico-hospitalar', kw: ['material medico', 'materiais medicos', 'medico hospitalar', 'medico hospitalares', 'medicos hospitalares', 'insumos hospitalares', 'equipamentos medicos', 'odontologicos', 'odontologico', 'epi', 'equipamentos de protecao individual', 'fisioterapia'] },
  { p: ['4711', '4712'], area: 'Gêneros alimentícios (mercado)', kw: ['generos alimenticios', 'genero alimenticio', 'cesta basica', 'cestas basicas', 'merenda escolar', 'alimentacao escolar', 'kits natalinos', 'cestas'], fraco: ['material de limpeza', 'higiene', 'utensilios', 'copa e cozinha'] },
  { p: ['4731', '4732'], area: 'Combustíveis e lubrificantes', kw: ['combustivel', 'combustiveis', 'gasolina', 'etanol', 'oleo diesel', 'diesel', 'lubrificantes', 'arla 32'] },
  { p: ['4742', '6190699'], area: 'Material elétrico', kw: ['material eletrico', 'materiais eletricos', 'lampadas', 'luminarias', 'iluminacao', 'fios e cabos'] },
  { p: ['4743'], area: 'Vidros', kw: ['vidros', 'vidracaria', 'espelhos', 'box'] },
  { p: ['4744'], area: 'Material de construção e ferragens', kw: ['material de construcao', 'materiais de construcao', 'construcao civil', 'ferragens', 'ferramentas', 'tintas', 'materiais de pintura', 'material hidraulico', 'cimento', 'artefatos de concreto', 'madeiras', 'caixas d agua', 'caixa d agua'] },
  { p: ['4752', '6110', '6120', '6141', '6143'], area: 'Telefonia, TV e comunicação', kw: ['telefonia', 'smartphones', 'aparelhos celulares', 'internet', 'link de dados', 'tv por assinatura'] },
  { p: ['4753', '4759'], area: 'Eletrodomésticos', kw: ['eletrodomesticos', 'eletroportateis', 'climatizacao', 'ar condicionado', 'refrigeracao', 'geladeira'] },
  { p: ['4755501', '4755502'], area: 'Tecidos e cama, mesa e banho', kw: ['tecidos', 'cama mesa e banho', 'lencois', 'toalhas', 'enxoval', 'cortinas'] },
  { p: ['4761', '4762'], area: 'Papelaria e material escolar', kw: ['papelaria', 'material de expediente', 'materiais de expediente', 'material escolar', 'materiais escolares', 'papel a4', 'folha sulfite', 'materiais didaticos', 'kits escolares', 'acervo literario', 'livros'] },
  { p: ['4763'], area: 'Bicicletas e artigos esportivos', kw: ['materiais esportivos', 'artigos esportivos', 'material esportivo', 'bicicletas', 'bicicleta', 'setor esportivo'] },
  { p: ['4771', '4644'], area: 'Medicamentos', kw: ['medicamentos', 'farmacia basica', 'farmacos'] },
  { p: ['4772'], area: 'Cosméticos e higiene', kw: ['higiene pessoal', 'kits de higiene', 'cosmeticos', 'perfumaria'] },
  { p: ['4774'], area: 'Óculos', kw: ['oculos', 'armacoes', 'lentes de grau'] },
  { p: ['4789004'], area: 'Ração e produtos agropecuários', kw: ['racao', 'racoes', 'produtos veterinarios', 'insumos agropecuarios'] },
  { p: ['4921', '4922', '4923', '4924', '4929'], area: 'Transporte de passageiros', kw: ['transporte escolar', 'transporte de passageiros', 'transporte de alunos', 'transporte de pacientes', 'fretamento', 'locacao de veiculos com motorista', 'com fornecimento de motorista', 'servicos de transporte'] },
  { p: ['4930', '5250', '5229001'], area: 'Transporte de cargas e logística', kw: ['transporte de cargas', 'frete', 'fretes', 'mudancas', 'transporte de materiais', 'logistica'] },
  { p: ['5229002'], area: 'Reboque e guincho', kw: ['reboque', 'guincho', 'remocao de veiculos'] },
  { p: ['5510'], area: 'Hospedagem', kw: ['hospedagem', 'hotel', 'diarias de hotel'] },
  { p: ['5611'], area: 'Restaurante e refeições', kw: ['refeicoes', 'refeicao', 'marmitex', 'marmitas', 'self service', 'restaurante', 'coffee break', 'lanches', 'buffet'] },
  { p: ['5812', '5813', '5819'], area: 'Publicações', kw: ['publicacao', 'publicacoes', 'jornal de grande circulacao', 'publicidade legal'] },
  { p: ['5911', '5912', '7420'], area: 'Audiovisual e eventos', kw: ['filmagem', 'fotografia', 'audiovisual', 'sonorizacao', 'iluminacao de eventos', 'transmissao ao vivo', 'cobertura fotografica', 'eventos'] },
  { p: ['6201', '6202', '6203', '6204', '6209', '6311', '6319', '6399'], area: 'Software e tecnologia', kw: ['software', 'softwares', 'licenca de uso', 'licencas', 'sistema de gestao', 'sistemas de gestao', 'tecnologia da informacao', 'equipamentos de informatica', 'informatica', 'antivirus', 'suporte tecnico', 'locacao de softwares'] },
  { p: ['6622'], area: 'Seguros', kw: ['seguro', 'seguros', 'seguro de veiculos', 'seguro da frota'] },
  { p: ['6911'], area: 'Assessoria jurídica', kw: ['assessoria juridica', 'servicos advocaticios', 'consultoria juridica'] },
  { p: ['6920'], area: 'Assessoria contábil', kw: ['assessoria contabil', 'servicos contabeis', 'consultoria contabil', 'contabilidade publica'] },
  { p: ['7020'], area: 'Consultoria em gestão', kw: ['consultoria', 'assessoria tecnica', 'assessoria em gestao', 'planejamento estrategico', 'capacitacao'] },
  { p: ['7111', '7112', '7119'], area: 'Engenharia e projetos', kw: ['servicos de engenharia', 'projetos basicos', 'projetos executivos', 'projeto executivo', 'laudos', 'pericia', 'fiscalizacao de obras', 'topografia', 'engenharia', 'arquitetura'] },
  { p: ['7311', '7312', '7319', '7410'], area: 'Publicidade e comunicação', kw: ['publicidade', 'comunicacao visual', 'marketing', 'material promocional', 'brindes', 'design grafico', 'produtos personalizados'] },
  { p: ['7732', '7739'], area: 'Locação de máquinas e equipamentos', kw: ['locacao de maquinas', 'locacao de equipamentos', 'horas maquina', 'retroescavadeira', 'locacao montagem e desmontagem', 'estruturas para eventos'] },
  { p: ['7911', '7912'], area: 'Agência de viagens', kw: ['passagens aereas', 'passagens', 'agenciamento de viagens'] },
  { p: ['8011', '8012', '8020', '8030', '8111'], area: 'Vigilância e monitoramento', kw: ['vigilancia', 'seguranca privada', 'videomonitoramento', 'cameras de seguranca', 'monitoramento eletronico', 'alarme', 'controle de acesso'] },
  { p: ['8121', '8122', '8129'], area: 'Limpeza e conservação', kw: ['limpeza e conservacao', 'servicos de limpeza', 'conservacao predial', 'higienizacao', 'dedetizacao', 'copa'] },
  { p: ['8211', '8219', '8220'], area: 'Apoio administrativo', kw: ['apoio administrativo', 'digitalizacao', 'gestao documental', 'recepcao', 'servicos administrativos'], fraco: ['copa e apoio'] },
  { p: ['8291'], area: 'Cobrança e cadastro', kw: ['cobranca', 'recuperacao de credito', 'divida ativa', 'recadastramento'] },
  { p: ['8541', '8593', '8599'], area: 'Educação e treinamento', kw: ['cursos', 'cursos profissionalizantes', 'qualificacao profissional', 'formacao continuada', 'capacitacao de servidores', 'palestras', 'oficinas pedagogicas'], fraco: ['capacitacao', 'treinamento'] },
  { p: ['8610'], area: 'Serviços hospitalares', kw: ['servicos hospitalares', 'internacao', 'procedimentos cirurgicos', 'leitos'], fraco: ['servicos de saude', 'credenciamento'] },
  { p: ['8630501', '8630503'], area: 'Serviços médicos', kw: ['servicos medicos', 'consultas medicas', 'plantao medico', 'plantoes medicos', 'prestadores de servicos de saude', 'servicos de saude', 'consultas e exames', 'especialidades medicas'] },
  { p: ['8630504', '8630506'], area: 'Serviços odontológicos', kw: ['servicos odontologicos', 'odontologia', 'atendimento odontologico', 'tratamento odontologico'], fraco: ['servicos de saude', 'prestadores de servicos de saude'] },
  { p: ['8630502', '8650003'], area: 'Psicologia', kw: ['psicologia', 'psicologo', 'psicologos', 'atendimento psicologico', 'materiais de psicologia', 'testes psicologicos'], fraco: ['prestadores de servicos de saude'] },
  { p: ['8640'], area: 'Exames e diagnóstico', kw: ['exames', 'exames de imagem', 'ultrassonografia', 'raio x', 'tomografia', 'ressonancia', 'exames laboratoriais', 'eletroencefalograma'] },
  { p: ['8650'], area: 'Saúde multiprofissional', kw: ['fisioterapia', 'fonoaudiologia', 'nutricionista', 'terapia ocupacional'], fraco: ['prestadores de servicos de saude', 'servicos de saude'] },
  { p: ['8711', '8712', '8730'], area: 'Cuidadores e acolhimento', kw: ['cuidador', 'cuidadores', 'acolhimento institucional', 'casa lar', 'idosos'] },
  { p: ['9311', '9313', '9319'], area: 'Esportes e academia', kw: ['academia', 'atividades esportivas', 'eventos esportivos', 'escolinha', 'personal', 'ginastica'] },
  { p: ['9521', '9511', '9512', '3312'], area: 'Reparo de eletrônicos', kw: ['manutencao de equipamentos eletronicos', 'manutencao de computadores', 'manutencao de impressoras', 'reparo', 'conserto'] },
];

// Atividades que não costumam disputar licitações públicas (holdings, imobiliárias, associações…)
const EXCLUIDOS = ['8511', '8512', '8513', '8520', '0151', '1111', '4110', '4617', '4619', '6424', '6462', '6463', '6619', '6810', '6821', '6822', '7490', '8112', '8299706', '8299799', '9312', '9411', '9420', '9430', '9491', '9602', '9609', '4789099'];

export function regraDoCnae(cnae) {
  const c = String(cnae || '');
  if (!c || EXCLUIDOS.some((p) => c.startsWith(p))) return null;
  let best = null;
  let bestLen = 0;
  for (const r of CNAE_RULES) {
    for (const p of r.p) {
      if (c.startsWith(p) && p.length > bestLen) {
        best = r;
        bestLen = p.length;
      }
    }
  }
  return best && (best.kw.length || best.fraco?.length) ? best : null;
}

/* ------------------------------------------------------------------ */
/* 3. Cruzamento empresa x edital                                       */
/* ------------------------------------------------------------------ */

const hasTerm = (texto, termo) => ` ${texto} `.includes(` ${termo} `);

// Editais que não são "vender para o governo" (leilão: a prefeitura vende; cartão-alimentação etc.)
const IGNORAR = ['leilao', 'alienacao de bens', 'leiloeiro', 'agricultura familiar', 'agricultores familiares', 'auxilio alimentacao', 'cartao alimentacao'];

function proximidade(empresa, edital) {
  const cidE = normalizeName(empresa.cidade);
  const cidL = normalizeName(edital.municipio);
  if (cidE && cidE === cidL) return { pts: 15, txt: 'na mesma cidade' };
  const mE = microrregiaoDe(empresa.cidade);
  const mL = edital.microrregiao ?? microrregiaoDe(edital.municipio);
  if (mE && mE === mL) return { pts: 10, txt: `microrregião de ${mL}` };
  if (mL) return { pts: 6, txt: 'Zona da Mata' };
  return { pts: 0, txt: '' };
}

/**
 * @param empresas  lista de parseAlterdataCsv
 * @param editais   lista no formato mapItem (pncp.js)
 * @param opts      { agora, maxPorEmpresa, soZonaDaMata }
 */
export function sugerirEditais(empresas, editais, { agora = new Date(), maxPorEmpresa = 5, soZonaDaMata = false } = {}) {
  const limite = agora.getTime();
  const abertos = [];
  const vistos = new Set();
  for (const e of editais) {
    const key = e.link || e.id;
    if (vistos.has(key)) continue;
    vistos.add(key);
    if (e.propostasAte && new Date(e.propostasAte).getTime() < limite) continue;
    if (/leil/i.test(e.modalidade || '')) continue;
    const texto = norm(`${e.titulo} ${e.objeto}`);
    if (IGNORAR.some((t) => hasTerm(texto, t))) continue;
    const zm = e.microrregiao ?? microrregiaoDe(e.municipio);
    if (soZonaDaMata && !zm) continue;
    abertos.push({ ...e, microrregiao: zm, _texto: texto });
  }

  const resultado = [];
  const semRegra = [];
  const semEdital = [];
  for (const emp of empresas) {
    const regra = regraDoCnae(emp.cnae);
    if (!regra) {
      semRegra.push(emp);
      continue;
    }
    const achados = [];
    for (const ed of abertos) {
      const fortes = regra.kw.filter((t) => hasTerm(ed._texto, t));
      const fracos = (regra.fraco || []).filter((t) => hasTerm(ed._texto, t));
      if (!fortes.length && !fracos.length) continue;
      const prox = proximidade(emp, ed);
      // termo de apoio sozinho só vale se o edital for perto
      if (!fortes.length && prox.pts < 6) continue;
      const me = /(\bme\b|\bepp\b|microempresa|pequeno porte|exclusiv)/.test(ed._texto) && /SIMPLES|MEI/.test(emp.tributacao);
      const score = Math.min(fortes.length, 3) * 10 + Math.min(fracos.length, 2) * 5 + prox.pts + (me ? 5 : 0);
      achados.push({
        edital: ed,
        score,
        termos: [...fortes, ...fracos],
        proximidade: prox.txt,
        me,
      });
    }
    achados.sort((a, b) => b.score - a.score || String(a.edital.propostasAte).localeCompare(String(b.edital.propostasAte)));
    if (achados.length) resultado.push({ empresa: emp, regra, sugestoes: achados.slice(0, maxPorEmpresa), todas: achados, total: achados.length });
    else semEdital.push({ empresa: emp, regra });
  }
  resultado.sort((a, b) => b.sugestoes[0].score - a.sugestoes[0].score || a.empresa.razao.localeCompare(b.empresa.razao));
  return { resultado, semRegra, semEdital, editaisAnalisados: abertos.length };
}

/* ------------------------------------------------------------------ */
/* 4. Blocos do PDF (layout Ágil CM — ver pdfReport.ts)                 */
/* ------------------------------------------------------------------ */

const fmtCnpj = (c) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
const fmtData = (iso) => {
  if (!iso) return 'ver edital';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'ver edital';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const semPortal = (s) => String(s || '').replace(/^\s*\[[^\]]+\]\s*-?\s*/, '');
const BOILER = [
  /^(o\s+)?(objeto( da presente licita[cç][aã]o| do presente processo)?\s*(é|e|:)\s*(a\s+)?)/i,
  /^(constitui o objeto do presente preg[aã]o eletr[oô]nico\s*(o|a)?\s*)/i,
  /^refere-?se?a?\s+a\s+/i,
  /^(implanta[cç][aã]o do\s+)?(sistema de\s+)?registro de pre[cç]os?\s+(para|visando|referente)?\s*(a\s+|à\s+)?(futuras?|eventua(l|is)|e|,|\s)*(e\s+)?(possível\s+)?/i,
  /^forma[cç][aã]o de (ata de )?registro de pre[cç]os?[^,]*?para\s+(o\s+|a\s+)?(futura\s+e\s+)?(eventual\s+)?/i,
  /^contrata[cç][aã]o de (pessoa jur[ií]dica|empresas?|empresa\(s\))( especializadas?)?( em [a-z ]+?)?\s+(para|na|no|em)\s+(a\s+|o\s+)?/i,
];
function resumoObjeto(txt) {
  let t = semPortal(txt).replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) for (const re of BOILER) t = t.replace(re, '');
  t = t.replace(/^(futura e eventual|eventual e futura|futura|eventual)\s+/i, '');
  const letras = t.replace(/[^A-Za-zÀ-ú]/g, '');
  if (letras && letras.replace(/[^A-ZÀ-Ý]/g, '').length / letras.length > 0.6) t = t.toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
const cap = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const titleCase = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/(^|\s|\/|-)([a-zà-ú])/g, (m, a, b) => a + b.toUpperCase())
    .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase());

export function sugestoesReport({ resultado, semRegra, semEdital, editaisAnalisados }, { dataText, regiaoTexto, totalEmpresas, atualizadoEm }) {
  const blocks = [];
  const nome = (e) => e.fantasia && e.fantasia.length < e.razao.length ? e.fantasia : e.razao;

  // Agrupa por edital: quais empresas da carteira podem disputar cada um
  const porEdital = new Map();
  for (const r of resultado) {
    for (const s of r.todas || r.sugestoes) {
      const k = s.edital.link || s.edital.id;
      if (!porEdital.has(k)) porEdital.set(k, { edital: s.edital, empresas: [], melhor: 0 });
      const g = porEdital.get(k);
      g.empresas.push({ empresa: r.empresa, score: s.score });
      g.melhor = Math.max(g.melhor, s.score);
    }
  }
  const editaisLista = [...porEdital.values()].sort(
    (a, b) => (b.edital.microrregiao ? 1 : 0) - (a.edital.microrregiao ? 1 : 0) || b.empresas.length - a.empresas.length || b.melhor - a.melhor,
  );
  const naZm = editaisLista.filter((g) => g.edital.microrregiao).length;

  blocks.push({ type: 'date', text: dataText });
  blocks.push({ type: 'title', text: 'Sugestão de editais por empresa' });
  blocks.push({
    type: 'para',
    text:
      `Cruzamos a atividade principal (CNAE) de ${totalEmpresas} empresas ativas da carteira com ${editaisAnalisados} editais ` +
      `abertos no Portal Nacional de Contratações Públicas (PNCP) — ${regiaoTexto}${atualizadoEm ? `, dados de ${atualizadoEm}` : ''}.`,
    gapAfter: 6,
  });
  blocks.push({
    type: 'table',
    widths: [70, 30],
    rows: [
      ['Empresas com pelo menos um edital compatível', { text: String(resultado.length), align: 'right', bold: true }],
      ['Editais com empresa da carteira apta', { text: String(editaisLista.length), align: 'right', bold: true }],
      ['… desses, na Zona da Mata', { text: String(naZm), align: 'right', bold: true }],
      ['Empresas aguardando edital da sua área', { text: String(semEdital.length), align: 'right' }],
    ],
  });
  blocks.push({
    type: 'note',
    text:
      'Como ler: a nota soma o quanto o objeto do edital combina com a atividade da empresa (termos encontrados) e a distância até o órgão ' +
      'comprador (mesma cidade +15, mesma microrregião +10, Zona da Mata +6). É uma triagem: antes de disputar, confira no edital os itens, ' +
      'a habilitação exigida e o prazo. O número "PNCP" leva ao edital em pncp.gov.br/app/editais/…',
  });

  if (resultado.length) {
    blocks.push({ type: 'heading', text: '1. Empresas e editais sugeridos' });
    blocks.push({
      type: 'table',
      widths: [31, 17, 52],
      header: ['Empresa', 'Área (CNAE)', 'Editais sugeridos (melhores primeiro)'],
      headerAlign: ['left', 'left', 'left'],
      rows: resultado.map((r) => {
        const e = r.empresa;
        const linhas = r.sugestoes.map((s) => {
          const ed = s.edital;
          return `• ${ed.municipio}${ed.microrregiao ? ' (ZM)' : ''} — ${cap(resumoObjeto(ed.objeto || ed.titulo), 80)} — até ${fmtData(ed.propostasAte)} · nota ${s.score}`;
        });
        if (r.total > r.sugestoes.length) linhas.push(`+ ${r.total - r.sugestoes.length} outros compatíveis`);
        return [
          `${cap(nome(e), 48)}\nCNPJ ${fmtCnpj(e.cnpj)}\n${titleCase(e.cidade)}${e.uf ? `/${e.uf}` : ''} · ${titleCase(e.tributacao)}`,
          `${r.regra.area}\nCNAE ${e.cnae}`,
          linhas.join('\n'),
        ];
      }),
    });

    blocks.push({ type: 'heading', text: '2. Editais abertos e quem da carteira pode disputar' });
    blocks.push({ type: 'para', size: 9.5, color: 'muted', text: 'Primeiro os editais da Zona da Mata, depois o restante de Minas Gerais.', gapAfter: 4 });
    blocks.push({
      type: 'table',
      widths: [38, 19, 10, 33],
      header: ['Objeto do edital', 'Órgão / cidade', 'Propostas até', 'Empresas aptas'],
      headerAlign: ['left', 'left', 'center', 'left'],
      rows: editaisLista.map((g) => {
        const ed = g.edital;
        const ref = ed.compra ? `PNCP ${ed.compra.cnpj}/${ed.compra.ano}/${ed.compra.seq}` : '';
        const emps = g.empresas.sort((a, b) => b.score - a.score).map((x) => cap(nome(x.empresa), 34));
        const lista = emps.slice(0, 8).join('; ') + (emps.length > 8 ? `; e mais ${emps.length - 8}` : '');
        return [
          `${cap(resumoObjeto(ed.objeto || ed.titulo), 130)}${ref ? `\n${ref}` : ''}`,
          `${titleCase(ed.orgao)}\n${ed.municipio}${ed.microrregiao ? ` (ZM – ${ed.microrregiao})` : ''}`,
          { text: fmtData(ed.propostasAte), align: 'center' },
          `${emps.length} ${emps.length === 1 ? 'empresa' : 'empresas'}: ${lista}`,
        ];
      }),
    });
  }

  blocks.push({ type: 'heading', text: '3. Empresas sem sugestão neste momento' });
  blocks.push({
    type: 'bullets',
    items: [
      `${semEdital.length} empresas têm atividade que costuma ser licitada, mas nenhum edital compatível está aberto agora. Vale gerar este relatório de novo nas próximas semanas.`,
      `${semRegra.length} empresas têm atividades que normalmente não participam de licitações (holdings, administração de imóveis, condomínios, escolas, associações, lotéricas etc.) ou estão com o CNAE em branco.`,
    ],
  });
  if (semEdital.length) {
    const areas = {};
    for (const s of semEdital) areas[s.regra.area] = (areas[s.regra.area] || 0) + 1;
    blocks.push({
      type: 'para',
      size: 9,
      color: 'muted',
      text: 'Áreas aguardando edital: ' + Object.entries(areas).sort((a, b) => b[1] - a[1]).map(([a, n]) => `${a} (${n})`).join(' · '),
    });
  }
  blocks.push({
    type: 'note',
    text:
      'Fonte: PNCP (pncp.gov.br), editais com status "recebendo proposta" em Minas Gerais. A lista de empresas veio do cadastro do escritório ' +
      'e foi processada apenas no computador de quem gerou o relatório — nada foi enviado pela internet. ' +
      'A Ágil CM cuida da habilitação, das propostas e dos lances: fale com a gente.',
  });
  return blocks;
}
