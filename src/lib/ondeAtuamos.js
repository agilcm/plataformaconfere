// "Onde já atuamos": resumo público das licitações que a Ágil CM venceu, montado a partir da leitura da área Privado
// (termos de homologação e adjudicação). Sai só o que é público e não é valor: órgão, município, ano, modalidade,
// objeto e o tipo de material fornecido. Puro: sem tela e sem rede, para testar.

const semAcento = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Tipos de material. Os termos valem como começo de palavra, sem acento; a ordem desempata (o primeiro que casar
 * classifica o item), por isso os mais específicos vêm antes.
 */
export const CATEGORIAS = [
  {
    id: 'informatica',
    nome: 'Informática e tecnologia',
    termos:
      'informatica|computador|notebook|impressora|toner|cartucho|tinta para recarga|tinta cor|tinta para impressora|refil de tinta|mouse|teclado|monitor|nobreak|switch|roteador|hd externo|ssd|pen ?drive|cabo de rede|cabo extensor usb|cabo hdmi|cabo usb|webcam|headset|estabilizador|memoria ram|placa mae|processador|scanner|projetor|retroprojetor|tablet|fonte de alimentacao|access point|rack|patch|conector rj|periferico|tecnologia da informacao|alcool isopropilico|pasta termica|hub usb|leitor de codigo|tela de projecao|multimidia|cabo de forca|memoria de|hd |multifunc|testador de cabos|headphone|fone de ouvido',
  },
  {
    id: 'eletro',
    nome: 'Eletrodomésticos e eletrônicos',
    termos:
      'eletrodomestico|eletroeletronico|televisor|televisao|smart tv|tv |liquidificador|geladeira|refrigerador|freezer|fogao|micro-?ondas|ventilador|bebedouro|purificador|cafeteira|batedeira|ferro de passar|lavadora|maquina de lavar|aspirador|ar condicionado|climatizador|caixa de som|microfone|camera|iphone|smartphone|celular|telefone|carregador|forno|sanduicheira|espremedor|multiprocessador|audiovisual|aparelho de som|mesa de som|amplificador|drone|tripe|ring light|secador de maos',
  },
  {
    id: 'eletrico',
    nome: 'Material elétrico',
    termos:
      'material eletrico|materiais eletricos|lampada|luminaria|refletor|disjuntor|tomada|interruptor|fio |fios |cabo paralelo|cabo flexivel|cabo pp|extensao eletrica|adaptador para tomada|adaptador de tomada|benjamin|reator|rele|fita isolante|eletroduto|plugue|soquete|pilha|bateria|filtro de linha|canaleta|conduite|quadro de distribuicao|sensor de presenca|fusivel|capacitor|chave contatora|caixa de parede|terminal tubular|abracadeira',
  },
  {
    id: 'esporte',
    nome: 'Material esportivo',
    termos:
      'esportiv|bola |bolas |futebol|futsal|volei|basquete|handebol|cone |cones |cone$|cones de|cone chines|apito|rede de |colchonete|halter|peso |anilha|corda de pular|bambole|raquete|peteca|cama elastica|barreira|medicine ball|step|kettlebell|caneleira|escada de agilidade|abdominal|exercicio|treinamento|chuteira|short |camisa de |colete|meiao|tatame|cronometro|trave|bomba de ar|tenis de mesa|placar|protetor bucal|faixa elastica|mesa de pingue|pingue|luva de boxe',
  },
  {
    id: 'pedagogico',
    nome: 'Brinquedos e material pedagógico',
    termos:
      'brinquedo|pedagogic|jogo |jogos |quebra-?cabeca|tangram|bingo|domino|xadrez|dama |boneca|boneco|carrinho|blocos de montar|blocos logicos|fantoche|piscina de bolinha|playground|escorregador|gangorra|tapete dupla face|alfabeto|material dourado|abaco|massa de modelar|massinha|educativ|ludic|triciclo|pula-?pula|casinha|instrumento musical|bandinha|cordao girassol|cordao quebra|kit panelinha|aramado|kit blocos|arco de atividades|construindo cidades|kit de instrumentos musicais|tabuleiro de plastico de dama|jogo de tabuleiro|bloco de montar|bloco primeira infancia|torre caiu|esquema corporal',
  },
  {
    id: 'artesanato',
    nome: 'Artesanato e aviamentos',
    termos:
      'artesanato|croche|trico|agulha|barbante|linha |lã |la para|feltro|tecido|e\\.?v\\.?a|mdf|micanga|bola translucida|cordao cru|enchimento|velcro|fita de cetim|fita cetim|botao|ziper|elastico|pincel|tinta para tecido|tinta acrilica|tinta guache|tela para pintura|cola para artesanato|cola quente|pistola de cola|lantejoula|strass|pedraria|renda|vies|papel color|papel crepom|papel camurca|papel de seda|saco de presente|saco transparente|palito|biscuit|cortador de eva|verniz|alfinete|colchete|lastex|tiara|tubete|fitilho|base de corte|cortador circular|kit de pinceis|carretel|fio de silicone|fio de cetim|guardanapo para decoupagem|decoupage|bola leitosa|passante|bola de soprar|balao|baloes',
  },
  {
    id: 'papelaria',
    nome: 'Material de escritório e escolar',
    termos:
      'expediente|papelaria|escritorio|escolar|papel |papel$|caneta|lapis|borracha|apontador|caderno|grampeador|grampo|clips|clipe|pasta |pastas |envelope|cola |fita adesiva|fita larga|fita dupla face|fita crepe|durex|tesoura|regua|estilete|marcador|marca-?texto|pincel atomico|pincel para quadro|quadro branco|limpador p/quadro|apagador|agenda|bloco |post-?it|etiqueta|perfurador|calculadora|carimbo|almofada para carimbo|corretivo|giz|transferidor|compasso|mochila|estojo|cartolina|bobina de papel|livro ata|livro de ponto|indice telefonico|arquivo morto|caixa arquivo|prancheta|percevejo|elastico de borracha|extrator de grampo|porta lapis|organizador de mesa|plastificadora|encadernacao|espiral|umedecedor|guilhotina|dispensador fita|cordoes para cracha|cordao para pescoco|caixa de correspondencia',
  },
  {
    id: 'alimentos',
    nome: 'Gêneros alimentícios',
    termos:
      'generos alimenticios|genero alimenticio|alimenticio|merenda|arroz|feijao|acucar|oleo de soja|oleo |cafe|leite|macarrao|farinha|fuba|sal |biscoito|bolacha|achocolatado|margarina|manteiga|carne|frango|ovo|ovos|suco|refrigerante|agua mineral|doce|adocante|tipo refinado|molho|extrato de tomate|tempero|vinagre|amido|aveia|gelatina|milho|ervilha|sardinha|salsicha|queijo|presunto|iogurte|pao |polvilho|fermento|chocolate|bala |pirulito|pipoca|cha |maionese|ketchup|mostarda|goiabada|granola|cereal|sopa|massa de tomate|bicarbonato',
  },
  {
    id: 'cozinha',
    nome: 'Copa, cozinha e utensílios',
    termos:
      'copa e cozinha|utensilio|prato|xicara|copo |copos |talher|garfo|faca|colher|panela|assadeira|frigideira|caneca|jarra|garrafa termica|bandeja|escorredor|concha|espumadeira|bacia|balde|pote|tigela|travessa|tabua de |abridor|ralador|peneira|caldeirao|cuscuzeira|leiteira|bule|coador|porta |saleiro|acucareiro|marmita|caixa termica|cooler|coletor copo|garrafa |squeeze|toalha de mesa|pano de prato|caixa plastica|caixa organizadora|cesto|lixeira|tapete|capacho|varal|escada|cadeado|cacarola|tacho|filtro de barro|isqueiro|caixa em pol|taca de|taca ',
  },
  {
    id: 'limpeza',
    nome: 'Limpeza, higiene e descartáveis',
    termos:
      'limpeza|higiene|sanitari|descartave|detergente|sabao|sabonete|desinfetante|agua sanitaria|alvejante|amaciante|alcool|esponja|vassoura|rodo|pano de chao|flanela|saco de lixo|saco para lixo|papel higienico|papel toalha|guardanapo|luva|mascara|touca|fralda|absorvente|shampoo|condicionador|creme dental|escova de dente|escova dental|pente|cotonete|lenco umedecido|desodorante|cera |lustra|limpa |multiuso|inseticida|bandeja rasa de isopor|isopor|saco de papel|sacola|embalagem|marmitex|canudo|pa de lixo|desentupidor|escova |hastes flexiveis|aparelho de barbear|toalha de papel|dispenser|palha de aco|banheira|pomada|borrifador|saco material',
  },
  {
    id: 'vestuario',
    nome: 'Vestuário, cama e banho',
    termos:
      'vestuario|calcado|roupa|enxoval|uniforme|camiseta|camisa|calca|bermuda|blusa|jaqueta|agasalho|meia|cueca|calcinha|sutia|pijama|sandalia|chinelo|tenis|sapato|bota|bone|lencol|fronha|cobertor|edredom|colcha|toalha de banho|toalha de rosto|toalha |travesseiro|colchao|manta|cama, mesa|mesa, banho|cama mesa e banho|body|macacao|kit bebe',
  },
  {
    id: 'saude',
    nome: 'Saúde e odontologia',
    termos:
      'odontologic|hospitalar|medic|seringa|gaze|esparadrapo|termometro|estetoscopio|oximetro|aparelho de pressao|esfigmomanometro|balanca|maca|cadeira de rodas|muleta|nebulizador|autoclave|fotopolimerizador|resina|broca|curativo|soro|laboratorio|vigilancia em saude|endemias|pulverizador',
  },
  {
    id: 'moveis',
    nome: 'Móveis e equipamentos',
    termos:
      'mobiliario|movel|moveis|material permanente|cadeira|mesa |mesas |armario|estante|arquivo de aco|gaveteiro|sofa|poltrona|banco |balcao|prateleira|rack|quadro de aviso|mural|suporte|gaiola de protecao|berco|cama |beliche|longarina|carteira escolar|conjunto escolar|roupeiro|cofre|carrinho de mao|ferramenta|furadeira|parafusadeira|alicate|chave de fenda|martelo|trena|manutencao predial|manutencao de bens|cortina|mola para porta|protetor de quina',
  },
];

const REGRAS = CATEGORIAS.map((c) => ({ id: c.id, re: new RegExp(`(?:^|[^a-z0-9])(?:${c.termos})`) }));

/** Tipo de material de um item (pelo começo da descrição, onde está o nome do produto); null se não reconhecer */
export function categoriaDoItem(descricao) {
  const t = semAcento(descricao).replace(/\s+/g, ' ').slice(0, 70);
  if (!t.trim()) return null;
  // o primeiro termo que aparece no texto decide (o nome do produto vem antes da especificação)
  // (no empate, o termo mais comprido: "bola leitosa" é miçanga, não bola de esporte)
  let melhor = null;
  for (const r of REGRAS) {
    const m = r.re.exec(t);
    if (m && (!melhor || m.index < melhor.pos || (m.index === melhor.pos && m[0].length > melhor.tam))) melhor = { id: r.id, pos: m.index, tam: m[0].length };
  }
  return melhor?.id || null;
}

/** Tipos de material citados no objeto da licitação (usado quando os itens não dizem) */
export function categoriasDoObjeto(objeto) {
  const t = semAcento(objeto).replace(/\s+/g, ' ');
  return REGRAS.filter((r) => r.re.test(t)).map((r) => r.id);
}

/** Tipos de material de um processo: os dos itens vencidos pela Ágil; sem itens reconhecidos, os do objeto */
export function categoriasDoProcesso(p) {
  const conta = {};
  for (const i of p.itens || []) {
    const c = categoriaDoItem(i.descricao);
    if (c) conta[c] = (conta[c] || 0) + 1;
  }
  const total = Object.values(conta).reduce((s, n) => s + n, 0);
  if (!total) return categoriasDoObjeto(p.objeto);
  // só os tipos com peso no processo (1 item solto entre 20 não vira "tipo fornecido")
  return Object.keys(conta)
    .filter((c) => conta[c] / total >= 0.2)
    .sort((a, b) => conta[b] - conta[a] || a.localeCompare(b));
}

const UF_FORA_DE_MG = { 'presidente prudente': 'SP' };
const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
const titulo = (s) =>
  String(s || '')
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i && MINUSCULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

/**
 * Órgão e município a partir do nome que vem no termo.
 * "Prefeitura Municipal de Guarani - MUNICÍPIO DE GUARANI" → { orgao: "Prefeitura Municipal de Guarani", municipio: "Guarani", tipo: "Prefeitura" }
 */
export function orgaoEMunicipio(nome) {
  const limpo = String(nome || '')
    .replace(/\s+/g, ' ')
    .split(/\s+[-–]\s+/)[0]
    .replace(/Municípal/gi, 'Municipal')
    .trim();
  const m = limpo.match(/^(.*?)\b(?:Municipal|Município|Municipio)?\s*d[eoa]s?\s+(.+)$/i);
  const municipio = titulo((m ? m[2] : limpo).trim());
  const n = semAcento(limpo);
  const tipo =
    n.startsWith('prefeitura') || n.startsWith('municipio')
      ? 'Prefeitura'
      : n.startsWith('camara')
        ? 'Câmara Municipal'
        : n.startsWith('saae') || n.includes('agua e esgoto')
          ? 'Serviço de água e esgoto'
          : n.startsWith('consorcio')
            ? 'Consórcio'
            : 'Órgão público';
  return { orgao: limpo, municipio, uf: UF_FORA_DE_MG[semAcento(municipio)] || 'MG', tipo };
}

/** Objeto da licitação em texto de leitura: sem caixa alta, sem a "cauda" jurídica e com tamanho limitado */
export function objetoLegivel(objeto, max = 170) {
  let t = String(objeto || '')
    .replace(/\s+/g, ' ')
    .trim();
  t = t.replace(/^Constitui objeto d[oa] presente (?:processo|licitação|pregão) a escolha da proposta mais vantajosa para a?\s*/i, '');
  t = t.replace(
    /[,;]?\s*(?:conforme|de acordo com|nos termos d|segundo)\s+(?:as?\s+|os?\s+)?(?:condições|especificações|termo|exigências|quantidades|solicitação|lei|anexo|descri)[\s\S]*$/i,
    '',
  );
  t = t.replace(/[\s.,;:]+$/, '');
  const letras = t.replace(/[^A-Za-zÀ-ÿ]/g, '');
  const maiusculas = letras.replace(/[^A-ZÀ-Ý]/g, '').length;
  if (letras.length && maiusculas / letras.length > 0.6) t = t.toLowerCase();
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (t.length > max)
    t = `${t
      .slice(0, max)
      .replace(/\s+\S*$/, '')
      .replace(/[\s.,;:]+$/, '')}…`;
  return t;
}

const ano = (p) => String(p.dataDocumento || p.dataTermo || p.dataHomologacao || p.dataAdjudicacao || '').slice(0, 4);

/**
 * Resumo público: municípios → órgãos → fornecimentos (sem valores, quantidades, preços ou links).
 * @param {any[]} processos  resultado.processos da leitura do Privado
 * @param {string} [atualizadoEm]
 */
export function resumoAtuacao(processos, atualizadoEm = '') {
  const ganhos = (processos || []).filter((p) => p.agilVenceu && p.orgao);
  const porMunicipio = new Map();
  const contaCategoria = {};
  for (const p of ganhos) {
    const { orgao, municipio, uf, tipo } = orgaoEMunicipio(p.orgao);
    const chaveM = `${semAcento(municipio)}|${uf}`;
    if (!porMunicipio.has(chaveM)) porMunicipio.set(chaveM, { nome: municipio, uf, orgaos: new Map() });
    const M = porMunicipio.get(chaveM);
    const chaveO = semAcento(orgao);
    if (!M.orgaos.has(chaveO)) M.orgaos.set(chaveO, { nome: orgao, tipo, fornecimentos: [] });
    const categorias = categoriasDoProcesso(p);
    for (const c of categorias) contaCategoria[c] = (contaCategoria[c] || 0) + 1;
    M.orgaos.get(chaveO).fornecimentos.push({ ano: ano(p), modalidade: p.modalidade || '', objeto: objetoLegivel(p.objeto), categorias });
  }
  const municipios = [...porMunicipio.values()]
    .map((M) => {
      const orgaos = [...M.orgaos.values()]
        .map((o) => {
          const fornecimentos = o.fornecimentos.sort((a, b) => b.ano.localeCompare(a.ano) || a.objeto.localeCompare(b.objeto, 'pt-BR'));
          const conta = {};
          for (const f of fornecimentos) for (const c of f.categorias) conta[c] = (conta[c] || 0) + 1;
          const anos = [...new Set(fornecimentos.map((f) => f.ano).filter(Boolean))].sort();
          return {
            nome: o.nome,
            tipo: o.tipo,
            processos: fornecimentos.length,
            anos,
            categorias: Object.keys(conta).sort((a, b) => conta[b] - conta[a] || a.localeCompare(b)),
            fornecimentos,
          };
        })
        .sort((a, b) => b.processos - a.processos || a.nome.localeCompare(b.nome, 'pt-BR'));
      return { nome: M.nome, uf: M.uf, processos: orgaos.reduce((s, o) => s + o.processos, 0), orgaos };
    })
    .sort((a, b) => b.processos - a.processos || a.nome.localeCompare(b.nome, 'pt-BR'));
  const anos = ganhos.map(ano).filter(Boolean).sort();
  return {
    atualizadoEm: String(atualizadoEm || '').slice(0, 10),
    totais: {
      processos: ganhos.length,
      orgaos: municipios.reduce((s, m) => s + m.orgaos.length, 0),
      municipios: municipios.length,
      desde: anos[0] || '',
      ate: anos.at(-1) || '',
    },
    categorias: CATEGORIAS.filter((c) => contaCategoria[c.id]).map((c) => ({ id: c.id, nome: c.nome, processos: contaCategoria[c.id] })),
    municipios,
  };
}

export const nomeCategoria = (id) => CATEGORIAS.find((c) => c.id === id)?.nome || id;
