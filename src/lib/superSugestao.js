// Super Sugestão: cruza o que a AGIL já ganhou (histórico da área Privado) com os editais abertos.
//  - forte: mesma cidade e mesmo produto (ganhamos toner em Astolfo Dutra; abriu toner em Astolfo Dutra)
//  - media: mesma cidade e mesma categoria (ganhamos carrinho; abriu brinquedo de outro tipo na cidade)
//  - fraca: mesmo produto em outra cidade
import { CATEGORIAS } from '../data/categoriasProdutos.js';

export const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** termo inteiro, aceitando plural simples (toner/toners, bola/bolas, papel/papeis) */
const regexDe = (termo) => {
  const t = escapar(norm(termo));
  const plural = t.endsWith('l') ? `(?:${t}|${t.slice(0, -1)}is)` : t.endsWith('ao') ? `(?:${t}|${t.slice(0, -2)}oes|${t.slice(0, -2)}aes)` : `${t}(?:s|es)?`;
  return new RegExp(`(?:^| )${plural}(?= |$)`);
};

const CATS = CATEGORIAS.map((c) => ({ nome: c.nome, res: c.termos.map(regexDe) }));
export const categoriasDe = (texto) => CATS.filter((c) => c.res.some((r) => r.test(texto))).map((c) => c.nome);

// palavras que não identificam o produto
const GENERICAS = new Set(
  'aquisicao contratacao fornecimento kit jogo conjunto caixa pacote pct par unidade unid und tipo modelo marca material materiais produto produtos item itens lote cor cores com sem para tamanho medida medio media grande pequeno pequena novo nova primeira linha qualidade embalagem contendo sendo minimo maximo aproximadamente referencia similar equivalente superior'.split(' '),
);

// adjetivos e medidas que vêm logo depois do nome ("CAIXA PLÁSTICA", "TV 43 POLEGADAS")
const ADJETIVOS = new Set(
  'plastico plastica metalico metalica eletrico eletrica eletronico eletronica digital automatico automatica manual infantil adulto branco branca preto preta azul verde vermelho vermelha amarelo amarela transparente colorido colorida liso lisa simples duplo dupla triplo tripla polegadas litros metros centimetros gramas quilos multimidia portatil universal compativel original interno interna externo externa'.split(' '),
);
const CURTAS = new Set(['tv', 'hd', 'ssd', 'eva', 'epi', 'led', 'cd', 'dvd', 'gas', 'som']);

/** Nome do produto: o começo da descrição, antes da ficha técnica */
export const nomeDoProduto = (descricao) => norm(descricao).split(' ').slice(0, 8).join(' ');

/** Palavra que identifica o item ganho: "TONER COMPATÍVEL HP 85A" -> "toner"; "CARRINHO DE BRINQUEDO" -> "carrinho" */
export function palavraDoItem(descricao) {
  for (const w of nomeDoProduto(descricao).split(' ')) {
    if (CURTAS.has(w)) return w;
    if (w.length < 4 || /\d/.test(w) || GENERICAS.has(w) || ADJETIVOS.has(w)) continue;
    return w;
  }
  return '';
}

/** Normaliza o nome da cidade para comparar ("São João Nepomuceno" = "sao joao nepomuceno") */
export const chaveCidade = (s) => norm(s).replace(/\b(mg|minas gerais)\b/g, '').trim();

/**
 * @param {{ processos: any[] }} historico  de historicoVitorias.js
 * @param {any[]} editais  formato mapItem (pncp.js)
 * @param {Map<string, any[]>} itensPorEdital  itens dos editais já consultados (opcional)
 */
export function superSugestao(historico, editais, itensPorEdital = new Map()) {
  // cada item ganho uma vez: palavra, categorias, onde e em qual processo
  const ganhos = [];
  for (const p of historico?.processos || []) {
    for (const it of p.itens || []) {
      const palavra = palavraDoItem(it.descricao);
      ganhos.push({
        palavra,
        re: palavra ? regexDe(palavra) : null,
        // categoria pelo nome do produto (a ficha técnica traz palavras de outras famílias)
        categorias: categoriasDe(nomeDoProduto(it.descricao)),
        cidade: chaveCidade(p.cidade),
        cidadeNome: p.cidade,
        orgao: p.orgao,
        processo: p.processo,
        situacao: p.situacao,
        descricao: it.descricao,
        unitario: it.unitario,
      });
    }
  }
  const cidadesGanhas = new Set(ganhos.map((g) => g.cidade));

  const out = [];
  for (const e of editais) {
    const itens = itensPorEdital.get(e.id) || [];
    const texto = norm(`${e.titulo} ${e.objeto} ${itens.map((i) => i.descricao).join(' ')}`);
    const cidade = chaveCidade(e.municipio);
    const mesmaCidade = cidadesGanhas.has(cidade);
    const catsEdital = mesmaCidade ? new Set(categoriasDe(texto)) : null;
    const motivos = new Map();
    for (const g of ganhos) {
      const aqui = g.cidade === cidade;
      const produto = g.re && g.re.test(texto);
      let nivel = null;
      let porque = '';
      if (aqui && produto) {
        nivel = 'forte';
        porque = g.palavra;
      } else if (aqui) {
        const cat = g.categorias.find((c) => catsEdital.has(c));
        if (cat) {
          nivel = 'media';
          porque = cat;
        }
      } else if (produto) {
        nivel = 'fraca';
        porque = g.palavra;
      }
      if (!nivel) continue;
      const k = `${nivel}|${porque}|${g.orgao}|${g.processo}`;
      if (!motivos.has(k)) motivos.set(k, { nivel, porque, orgao: g.orgao, cidade: g.cidadeNome, processo: g.processo, situacao: g.situacao, exemplos: [] });
      const m = motivos.get(k);
      if (m.exemplos.length < 3 && !m.exemplos.some((x) => x.descricao === g.descricao)) m.exemplos.push({ descricao: g.descricao, unitario: g.unitario });
    }
    if (!motivos.size) continue;
    const lista = [...motivos.values()];
    const nivel = lista.some((m) => m.nivel === 'forte') ? 'forte' : lista.some((m) => m.nivel === 'media') ? 'media' : 'fraca';
    out.push({ edital: e, nivel, motivos: lista.filter((m) => m.nivel === nivel).concat(lista.filter((m) => m.nivel !== nivel)) });
  }
  const peso = { forte: 0, media: 1, fraca: 2 };
  return out.sort(
    (a, b) => peso[a.nivel] - peso[b.nivel] || b.motivos.length - a.motivos.length || String(a.edital.propostasAte || '9').localeCompare(String(b.edital.propostasAte || '9')),
  );
}

/** Editais das cidades onde já ganhamos: vale a pena consultar os itens deles no PNCP. */
export function editaisNasCidades(historico, editais) {
  const cidades = new Set((historico?.processos || []).map((p) => chaveCidade(p.cidade)));
  return editais.filter((e) => cidades.has(chaveCidade(e.municipio)));
}
