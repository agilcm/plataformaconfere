// Editais abertos que combinam com uma empresa da lista Possíveis clientes: o "motivo para ligar hoje".
// Compara as palavras do objeto das licitações que a empresa disputou (e da descrição dos itens) com o objeto de cada
// edital aberto. Palavra comum em muitos editais (aquisição, secretaria…) vale pouco; palavra rara que a empresa
// repete (detergente, pneu, merenda…) vale muito. Puro: recebe os editais já carregados, sem rede.

// palavras de todo objeto de licitação, que não dizem o que se compra
const VAZIAS = new Set(
  (
    'para pela pelo pelos pelas com dos das nos nas num numa este esta estes estas esse essa isso aqui ali como sobre entre apos ' +
    'ate sem nao mais menos bem tambem todo toda todos todas cada sendo seja forma onde quando qual quais mesmo mesma outro outra outros outras ' +
    'seus suas sua seu nosso nossa demais diversos diversas geral gerais varios varias ' +
    'aquisicao aquisicoes adquirir compra compras contratacao contratacoes contratar contratada empresa empresas especializada especializadas ' +
    'registro preco precos futura futuras futuro eventual eventuais eventualmente atender atendimento necessidade necessidades ' +
    'demanda demandas suprir uso utilizacao destinado destinada destinados destinadas visando objetivando objetivo objeto finalidade ' +
    'fornecimento fornecer prestacao servico servicos material materiais produto produtos item itens lote lotes tipo unidade unidades ' +
    'conforme termo referencia edital anexo anexos especificacao especificacoes especificado especificados descrito descritos ' +
    'quantidade quantidades quantitativos constantes constante presente processo licitatorio pregao eletronico eletronica dispensa ' +
    'concorrencia menor maior global valor percentual desconto tabela parcelada parcelado parcelas mediante durante periodo meses ' +
    'mes ano anos exercicio vigencia prazo dias contrato contratos ata atas ' +
    'secretaria secretarias municipal municipais municipio municipios prefeitura prefeituras fundo fundos camara consorcio intermunicipal ' +
    'publica publico publicas publicos rede estado minas gerais administracao administrativa departamento setor setores unidade orgao orgaos ' +
    'diversas diversos demais referente referentes relativo relativos acordo segundo abaixo acima modelo marca minimo maximo ' +
    'solicitacao requisicao programa atividade atividades rotina rotinas geral portal credenciamento interessado interessados ' +
    // palavras de especificação dos itens (medida, embalagem, cor, qualidade): aparecem em produtos de todo tipo
    'nome cientifico aproximadamente aproximada aproximado tamanho qualidade capacidade minima minimo maximo maxima embalagem pacote ' +
    'caixa fardo frasco litro litros metro metros gramas grama quilo quilos quilograma peso medida medidas dimensao dimensoes comprimento ' +
    'largura espessura diametro volume cores padrao linha frente formado formada confeccionado confeccionada acondicionado acondicionada ' +
    'contendo conter deve devera deverao apresentar garantia fabricacao fabricante fabrica validade similar equivalente superior inferior ' +
    'nova novo novas novos original certificado certificacao norma normas abnt inmetro anvisa alta baixa resistente durabilidade ' +
    'acabamento branco branca preto preta azul verde amarelo amarela vermelho vermelha cinza transparente natural parte primeira ' +
    'composicao composto composta aplicacao indicado indicada utilizado utilizada sistema modelo tipo referencia ' +
    'neste nesta nesse nessa deste desta desse dessa condicao exigencia estabelecida estabelecido serem empregado empregada ' +
    'apoio execucao transferencia apresentada apresentado nacional base consumo diver'
  ).split(' '),
);

const semAcento = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Palavras que dizem o que se compra: sem acento, a partir de 4 letras, sem número, no singular simples */
export function palavras(texto) {
  const out = [];
  for (let w of semAcento(texto).split(/[^a-z]+/)) {
    if (w.length < 4 || VAZIAS.has(w)) continue;
    // plural simples: "condições" = "condição", "descartáveis" = "descartável", "ornamentais" = "ornamental",
    // "lugares" = "lugar", "pneus" = "pneu", "fraldas" = "fralda"
    if (w.length > 5 && w.endsWith('oes')) w = `${w.slice(0, -3)}ao`;
    else if (w.length > 6 && w.endsWith('eis')) w = `${w.slice(0, -3)}el`;
    else if (w.length > 6 && w.endsWith('ais')) w = `${w.slice(0, -3)}al`;
    else if (w.length > 6 && /(r|z|s)es$/.test(w)) w = w.slice(0, -2);
    else if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
    if (VAZIAS.has(w)) continue;
    out.push(w);
  }
  return out;
}

/**
 * O que a empresa vende, pelas licitações que disputou: palavra → em quantas licitações ela aparece (no objeto vale 1;
 * só na descrição dos itens disputados, 0,5). Com `idf`, ficam as 20 palavras mais fortes contando também quão rara
 * cada uma é nos editais (frequente na empresa e rara no geral = o que ela vende).
 * @param {{ disputas: { lic: number, desc?: string }[] }} empresa
 * @param {{ objeto?: string }[]} licitacoes
 * @param {Map<string, number>} [idf]
 * @returns {Map<string, number>}
 */
export function perfilEmpresa(empresa, licitacoes, idf) {
  const porLic = new Map();
  for (const d of empresa.disputas) {
    if (!porLic.has(d.lic)) {
      const lic = licitacoes[d.lic] || {};
      // o nome da cidade e do órgão no objeto ("…de Patrocínio do Muriaé") não diz o que a empresa vende
      const local = new Set(palavras(`${lic.municipio || ''} ${lic.orgao || ''}`));
      porLic.set(d.lic, { objeto: new Set(palavras(lic.objeto).filter((w) => !local.has(w))), itens: new Set(), local });
    }
    const l = porLic.get(d.lic);
    for (const w of palavras(d.desc)) if (!l.local.has(w)) l.itens.add(w);
  }
  const peso = new Map();
  for (const { objeto, itens } of porLic.values()) {
    for (const w of objeto) peso.set(w, (peso.get(w) || 0) + 1);
    for (const w of itens) if (!objeto.has(w)) peso.set(w, (peso.get(w) || 0) + 0.5);
  }
  const forca = (w, p) => (idf ? p * (idf.get(w) ?? 0) : p);
  return new Map(
    [...peso.entries()]
      .filter(([w, p]) => forca(w, p) > 0)
      .sort((a, b) => forca(b[0], b[1]) - forca(a[0], a[1]))
      .slice(0, 20),
  );
}

/**
 * Prepara os editais abertos para a comparação (uma vez para todas as empresas).
 * @param {{ objeto?: string, titulo?: string }[]} editais
 */
export function indiceEditais(editais) {
  const docs = editais.map((e) => ({ e, termos: new Set(palavras(`${e.objeto || ''} ${e.titulo || ''}`)) }));
  const df = new Map();
  for (const d of docs) for (const w of d.termos) df.set(w, (df.get(w) || 0) + 1);
  const n = docs.length || 1;
  // palavra em quase todo edital vale perto de zero; palavra rara vale até ~8
  const idf = new Map([...df.entries()].map(([w, k]) => [w, Math.log((n + 1) / (k + 0.5))]));
  return { docs, idf };
}

/**
 * Os editais abertos que mais combinam com a empresa.
 * @param {{ disputas: any[] }} empresa
 * @param {any[]} licitacoes  as licitações da lista (para o objeto de cada uma)
 * @param {ReturnType<typeof indiceEditais>} indice
 * @param {{ agora?: number, soZonaDaMata?: boolean, max?: number }} [o]
 * @returns {{ edital: any, pontos: number, termos: string[] }[]}
 */
export function editaisParaEmpresa(empresa, licitacoes, indice, o = {}) {
  const perfil = perfilEmpresa(empresa, licitacoes, indice.idf);
  if (!perfil.size) return [];
  const maior = Math.max(...perfil.values());
  const agora = o.agora ?? Date.now();
  const out = [];
  for (const { e, termos } of indice.docs) {
    if (o.soZonaDaMata && !e.microrregiao) continue;
    // propostas já encerradas ficam de fora (sem data, o edital continua: o PNCP nem sempre informa)
    if (e.propostasAte && Date.parse(e.propostasAte) < agora) continue;
    let pontos = 0;
    let forte = false;
    const achados = [];
    for (const [w, p] of perfil) {
      if (!termos.has(w)) continue;
      const idf = indice.idf.get(w) || 0;
      const v = (p / maior) * idf;
      if (v <= 0) continue;
      pontos += v;
      achados.push([w, v]);
      if (p / maior >= 0.5 && idf >= 4) forte = true;
    }
    // combina com duas palavras ou mais; com uma só, se ela for central para a empresa e rara nos editais ("enteral").
    // Os limites foram acertados com a lista inteira de editais abertos de Minas (uns 4 mil): com poucos editais, a
    // raridade de cada palavra fica baixa e quase nada combina.
    if (pontos < 2.5 || (achados.length < 2 && !forte)) continue;
    out.push({ edital: e, pontos: Math.round(pontos * 10) / 10, termos: achados.sort((a, b) => b[1] - a[1]).map(([w]) => w) });
  }
  return out
    .sort((a, b) => b.pontos - a.pontos || String(a.edital.propostasAte || '9').localeCompare(String(b.edital.propostasAte || '9')))
    .slice(0, o.max ?? 5);
}
