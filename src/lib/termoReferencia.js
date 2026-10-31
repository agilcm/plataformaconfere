// Pesquisa de preços a partir de um termo de referência (planilha com produto, especificação e valor unitário).
// Para cada item, procura no PNCP pregões homologados em Minas Gerais e escolhe o menor preço ganho
// que encaixa na especificação. Uma compra baixada serve para todos os itens do termo que aparecem nela.
import { buildSearchUrl, fetchItensCompra, fetchJson, fetchResultadosItem, fixText, parseCompraRef } from './pncp.js';

// ---------------------------------------------------------------- texto

export const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const PARADAS = new Set(
  'a o e de da do das dos em no na nos nas com sem para por ou um uma ao aos as os que tipo cada sendo deve devera conforme minimo maximo aproximadamente aprox apresentar contendo embalagem embalado embalada produto produtos marca referencia similar equivalente qualidade unidade unidades und unid un pacote pct cx caixa fardo frasco pote saco lata garrafa galao kit item itens novo nova primeira linha original validade prazo entrega acondicionado acondicionada informacoes nutricionais rotulo rotulagem data fabricacao lote registro ministerio saude anvisa sif inspecao nao mais menos ate apos'.split(
    ' ',
  ),
);

const UNIDADES = [
  [/^(kg|kgs|kilo|kilos|quilo|quilos|quilograma|quilogramas)$/, 'kg'],
  [/^(g|gr|grs|grama|gramas)$/, 'g'],
  [/^(mg)$/, 'mg'],
  [/^(l|lt|lts|litro|litros)$/, 'l'],
  [/^(ml|mls)$/, 'ml'],
  [/^(cm)$/, 'cm'],
  [/^(mm)$/, 'mm'],
  [/^(m|metro|metros)$/, 'm'],
  [/^(w|watts?)$/, 'w'],
  [/^(v|volts?)$/, 'v'],
  [/^(btu|btus)$/, 'btu'],
  [/^(pol|pols|polegada|polegadas)$/, 'pol'],
];
const ROMANOS = {
  i: '1',
  ii: '2',
  iii: '3',
  iv: '4',
  v: '5',
  '01': '1',
  '02': '2',
  '03': '3',
};

/** Tokens comparáveis: palavras significativas, medidas ("5kg", "500g", "1l") e "tipo1". */
export function tokens(texto) {
  let s = norm(texto)
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/(\d)\s*("|”|'')/g, '$1 pol ')
    .replace(/[^a-z0-9.]+/g, ' ');
  s = s.replace(/\btipo\s+(i{1,3}|iv|v|0?\d)\b/g, (_, t) => ` tipo${ROMANOS[t] || String(Number(t))} `);
  // medidas: "5 kg" → "5kg"; "1.000 g" → "1000g"
  // e quantidades do produto: "48 portas" → "48porta", "04 lugares" → "4lugar", "06 bocas" → "6boca"
  s = s.replace(/\b(\d+(?:\.\d+)?)\s*([a-z]{1,11})\b/g, (m, n, u) => {
    const numero = Number(/^\d{1,3}(\.\d{3})+$/.test(n) ? n.replace(/\./g, '') : n);
    const un = UNIDADES.find(([re]) => re.test(u));
    if (un) return ` ${numero}${un[1]} `;
    if (u.length >= 3 && !PARADAS.has(u) && !/^(x|ou|a|e)$/.test(u)) return ` ${numero}${raiz(u)} `;
    return m;
  });
  const out = [];
  for (const w of s.split(/\s+/)) {
    const t = w.replace(/^\.+|\.+$/g, '');
    if (!t || PARADAS.has(t)) continue;
    if (MEDIDA.test(t) || /^tipo\d$/.test(t)) out.push(t);
    else if (/^[a-z]{3,}$/.test(t)) out.push(raiz(t));
  }
  return [...new Set(out)];
}

/** Plural simples → singular ("feijoes" → "feijao", "pacotes" → "pacote") */
function raiz(w) {
  if (w.length > 4 && w.endsWith('oes')) return `${w.slice(0, -3)}ao`;
  if (w.length > 4 && w.endsWith('aes')) return `${w.slice(0, -3)}ao`;
  if (w.length > 4 && w.endsWith('ns')) return `${w.slice(0, -2)}m`;
  if (w.length > 4 && /[^s]s$/.test(w) && !w.endsWith('us') && !w.endsWith('is')) return w.slice(0, -1);
  return w;
}

/** Palavras usadas na busca do PNCP: as 2 primeiras palavras do nome do produto. */
export function palavrasChave(item) {
  const base = tokens(item.produto || item.descricao).filter((t) => /^[a-z]+$/.test(t));
  return base.slice(0, 2);
}

/**
 * Palavras da especificação usadas na comparação. Especificações longas (equipamentos com dezenas de
 * exigências) são resumidas no nome do produto, nas medidas do nome, nas 3 primeiras medidas e nas
 * 10 primeiras palavras da especificação: é o que costuma aparecer na descrição de outros pregões.
 */
export function tokensEspec(item) {
  const todos = tokens(item.descricao);
  if (todos.length <= 12) return todos;
  const nome = tokens(item.produto || '');
  const resto = item.especificacao ? tokens(item.especificacao) : todos.filter((t) => !nome.includes(t));
  const med = resto.filter((t) => MEDIDA.test(t)).slice(0, 3);
  const palavras = resto.filter((t) => !MEDIDA.test(t) && !nome.includes(t)).slice(0, 10);
  return [...new Set([...nome, ...med, ...palavras])];
}

/** Quanto da especificação do termo aparece na descrição do item ganho (0 a 1). */
export function aderencia(termoTokens, descricao) {
  if (!termoTokens.length) return 0;
  const cand = new Set(tokens(descricao));
  return termoTokens.filter((t) => cand.has(t)).length / termoTokens.length;
}

/** Marca, quando o órgão escreveu na descrição do item ("MARCA: TIO JOÃO", "marca de referência X"). */
export function marcaDe(descricao) {
  const m = String(descricao || '').match(
    /\bmarcas?\b\s*(?:de\s+refer[eê]ncia|sugerida|ref\.?)?\s*[:\-–]?\s*([^,;:()\n]{2,40}?)(?=\s*(?:[,;()\n]|\s-\s|\bou\b|\bmodelo\b|$))/i,
  );
  if (!m) return '';
  const v = m[1].trim().replace(/[.\s]+$/, '');
  if (/^(propria|própria|de|do|da|similar|equivalente|referencia|referência)$/i.test(v) || v.length < 2) return '';
  return v;
}

// ---------------------------------------------------------------- planilha do termo

const num = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v ?? '')
    .replace(/r\$|\s/gi, '')
    .trim();
  if (!s || !/\d/.test(s)) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // 1.200 = mil e duzentos
  const n = Number(s.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const CAMPOS = {
  numero: /^(item|it|n|no|nº|n°|num|numero|seq|sequencia|lote item|cod|codigo|lote|numero do (lote|item)|n(º|°|o)? do (lote|item))\.?$/,
  produto: /produto|nome|material|objeto|bem\b|^item descri/,
  especificacao: /especifica|descri|discrimina|caracter|detalh/,
  unidade: /^(un|und|unid|unidade|unidade de medida|medida|u\.?m\.?|apresenta)/,
  quantidade: /qtd|qtde|quant/,
  valor: /unit|valor|pre[cç]o|vlr|vl\b|r\$|m[eé]dio/,
};

/** Acha a linha de cabeçalho e as colunas do termo. */
export function detectarColunas(linhas) {
  let melhor = { linha: -1, pontos: 0, cols: {} };
  for (let r = 0; r < Math.min(40, linhas.length); r++) {
    const cab = linhas[r].map((c) => norm(c).trim());
    const cols = {};
    cab.forEach((h, i) => {
      if (!h || h.length > 60) return;
      if (CAMPOS.numero.test(h)) cols.numero ??= i;
      else if (CAMPOS.quantidade.test(h)) cols.quantidade ??= i;
      else if (/marca|fabricante|modelo|propost|ofertad/.test(h))
        return; // colunas que o licitante preenche
      else if (CAMPOS.valor.test(h) && !/total|global/.test(h)) cols.valor = cols.valor != null && !/unit|refer/.test(h) ? cols.valor : i;
      else if (/descri/.test(h) && /lote|resumid|curta|sucinta|nome/.test(h)) cols.produto ??= i;
      else if (CAMPOS.especificacao.test(h)) cols.especificacao ??= i;
      else if (CAMPOS.produto.test(h)) cols.produto ??= i;
      else if (CAMPOS.unidade.test(h)) cols.unidade ??= i;
      else if (CAMPOS.numero.test(h)) cols.numero ??= i;
    });
    const pontos = Object.keys(cols).length + (cols.valor != null ? 1 : 0) + (cols.produto != null || cols.especificacao != null ? 1 : 0);
    if (pontos > melhor.pontos) melhor = { linha: r, pontos, cols };
  }
  const cols = { ...melhor.cols };
  // só uma coluna de texto: ela é a descrição
  if (cols.produto == null && cols.especificacao != null) {
    cols.produto = cols.especificacao;
    delete cols.especificacao;
  }
  if (melhor.pontos < 3 || cols.produto == null) {
    // sem cabeçalho: a coluna com mais texto é a descrição; a última numérica com centavos é o valor
    const amostra = linhas.slice(0, 50);
    const larg = Math.max(0, ...amostra.map((l) => l.length));
    const media = (i) => amostra.reduce((s, l) => s + (typeof l[i] === 'string' ? l[i].length : 0), 0);
    let desc = 0;
    for (let i = 1; i < larg; i++) if (media(i) > media(desc)) desc = i;
    let valor = null;
    for (let i = 0; i < larg; i++)
      if (i !== desc && amostra.filter((l) => num(l[i]) != null && !Number.isInteger(num(l[i]))).length >= amostra.length / 3) valor = i;
    return {
      linha: -1,
      cols: { produto: desc, ...(valor != null ? { valor } : {}) },
    };
  }
  return { linha: melhor.linha, cols };
}

/**
 * Itens do termo a partir da planilha.
 * @param {any[][]} linhas
 * @param {{ linha: number, cols: Record<string, number> }} [mapa] colunas (se não vier, detecta)
 */
export function itensDoTermo(linhas, mapa = detectarColunas(linhas)) {
  const { linha, cols } = mapa;
  const pega = (l, k) => (cols[k] == null ? '' : l[cols[k]]);
  const itens = [];
  for (let r = linha + 1; r < linhas.length; r++) {
    const l = linhas[r];
    let produto = fixText(String(pega(l, 'produto') ?? '')).trim();
    let espec = fixText(String(pega(l, 'especificacao') ?? '')).trim();
    // especificação que repete o nome no começo ("ADIPÔMETROInstrumento para...")
    if (produto && espec.toUpperCase().startsWith(produto.toUpperCase()) && espec.length > produto.length)
      espec = espec
        .slice(produto.length)
        .replace(/^[\s\-–—:.,;]+/, '')
        .trim();
    produto = produto.replace(/[\s\-–—:]+$/, '');
    const texto = espec && espec !== produto ? `${produto}${produto ? ' - ' : ''}${espec}` : produto;
    if (texto.length < 3 || /^(total|subtotal|valor total|lote\s*\d*$)/i.test(texto)) continue;
    if (!tokens(texto).some((t) => /^[a-z]+$/.test(t))) continue;
    const n = pega(l, 'numero');
    itens.push({
      numero: String(n === '' || n == null ? itens.length + 1 : n).replace(/\.0+$/, ''),
      produto: produto || espec,
      especificacao: espec,
      descricao: texto,
      unidade: String(pega(l, 'unidade') ?? '').trim(),
      quantidade: num(pega(l, 'quantidade')),
      valorTermo: num(pega(l, 'valor')),
    });
  }
  return itens;
}

// ---------------------------------------------------------------- escolha do melhor preço

const MEDIDA = /^\d+(\.\d+)?[a-z]+$/;
/** Medidas do texto (5kg, 900ml…). */
export const medidas = (tks) => tks.filter((t) => MEDIDA.test(t));

/** Termo com até 2 palavras de especificação (fora as medidas) = "pouca especificação": vale o mais barato. */
export const poucaEspecificacao = (item) => tokensEspec(item).filter((t) => !MEDIDA.test(t)).length <= 2;

/** Preços fora da curva (menos de 35% da mediana ou longe do valor do termo): erro de cadastro, unidade ou produto diferente. */
export function marcarSuspeitos(ocorrencias, valorTermo = null) {
  const vals = ocorrencias.map((o) => o.valorUnitario).sort((a, b) => a - b);
  const mediana = vals.length >= 4 ? vals[Math.floor(vals.length / 2)] : null;
  // também fora: menos de 20% ou mais de 5 vezes o valor do termo (outro produto ou outra unidade)
  return ocorrencias.map((o) => ({
    ...o,
    suspeito:
      (mediana != null && o.valorUnitario < mediana * 0.35) || (!!valorTermo && (o.valorUnitario < valorTermo * 0.2 || o.valorUnitario > valorTermo * 5)),
  }));
}

/** Núcleo do nome: as 3 primeiras palavras do produto ("mesa reuniao redonda"); precisam estar todas no item ganho. */
export const nucleoNome = (item) =>
  tokens(item.produto || item.descricao)
    .filter((t) => /^[a-z]+$/.test(t))
    .slice(0, 3);

/**
 * Menor preço que encaixa no termo.
 * - Se o termo tem medida (5 kg, 900 ml…), só valem itens com a mesma medida.
 * - Com pouca especificação, o mais barato; senão, o mais barato com aderência ≥ 60% (≥ 40% em especificação longa)
 *   (se nenhum chega lá, entre os de maior aderência, com aviso).
 * - Preços fora da curva (suspeitos) não entram.
 */
export function escolherMelhor(item, candidatos) {
  const validos = candidatos.filter((c) => c.valorUnitario > 0 && !c.suspeito);
  if (!validos.length) return null;
  const barato = (lista) => lista.reduce((a, b) => (b.valorUnitario < a.valorUnitario ? b : a));
  // medidas do nome valem todas (9.000 BTUs); da especificação, basta uma
  // (tensão não conta: 127 V × 220 V é opção de fornecimento; em especificação longa, só as do nome)
  const semTensao = (l) => l.filter((t) => !t.endsWith('v'));
  const medNome = semTensao(medidas(tokens(item.produto || '')));
  const longa = tokens(item.descricao).length > 12;
  const medEspec = medNome.length || longa ? [] : semTensao(medidas(tokensEspec(item)));
  const nucleo = nucleoNome(item);
  const tk = new Map(validos.map((c) => [c, new Set(tokens(c.descricao))]));
  const N = (c) => nucleo.every((w) => tk.get(c).has(w));
  const MN = (c) => medNome.every((m) => tk.get(c).has(m));
  const MS = (c) => !medEspec.length || medEspec.some((m) => tk.get(c).has(m));
  const temNucleo = (c) => tk.has(c) && N(c);
  // prioridade: nome + medida do nome ("9.000 BTUs", "48 portas") > medida do nome > nome > o resto
  const ordem = [[N, MN, MS], [N, MN], [MN, MS], [MN], [N, MS], [N], [MS], []];
  let pool = validos;
  let usado = [];
  for (const regras of ordem) {
    const l = validos.filter((c) => regras.every((r) => r(c)));
    if (l.length) {
      pool = l;
      usado = regras;
      break;
    }
  }
  const med = [...medNome, ...medEspec];
  const aviso =
    (medNome.length && !usado.includes(MN)) || (medEspec.length && !usado.includes(MS))
      ? `nenhum com a mesma medida (${med.join(', ')}): confira a unidade`
      : '';
  if (poucaEspecificacao(item))
    return {
      ...barato(pool),
      criterio: aviso || 'mais barato (termo com pouca especificação)',
    };
  const encaixa = pool.filter((c) => c.aderencia >= (longa ? 0.4 : 0.6) && temNucleo(c));
  if (encaixa.length)
    return {
      ...barato(encaixa),
      criterio: aviso || 'mais barato que encaixa na especificação',
    };
  // sem nenhum que encaixe: entre os que têm o nome do produto (se houver), os de maior aderência
  const top = Math.max(...pool.map((c) => c.aderencia));
  if (top < 0.25 && !pool.some(temNucleo)) return null; // nada parecido: melhor não sugerir
  return {
    ...barato(pool.filter((c) => c.aderencia >= top - 0.1)),
    criterio: aviso || 'aderência parcial: confira a especificação',
  };
}

// ---------------------------------------------------------------- pesquisa no PNCP

async function mapLimit(list, limit, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, list.length) }, async () => {
      while (i < list.length) {
        const idx = i++;
        await fn(list[idx], idx);
      }
    }),
  );
}

const CAPITAL = 'belo horizonte';
const chaveCompra = (c) => `${c.cnpj}/${c.ano}/${c.seq}`;

/**
 * Pesquisa os itens do termo no PNCP.
 * @param {any[]} itens de itensDoTermo()
 * @param {{ meses?: number, interior?: boolean, editaisPorItem?: number, paginas?: number, hoje?: Date,
 *           onProgresso?: (p: { fase: string, feito: number, total: number }) => void, cancelado?: () => boolean }} [opts]
 * @returns {Promise<{ itens: any[], comprasLidas: number, comprasComErro: number }>}
 */
export async function pesquisarTermo(itens, opts = {}, fetchImpl = fetch) {
  const { meses = 6, interior = true, editaisPorItem = 10, paginas = 2, onProgresso, cancelado = () => false } = opts;
  const hoje = opts.hoje || new Date();
  const corte = new Date(hoje);
  corte.setMonth(corte.getMonth() - meses);
  const corteIso = corte.toISOString().slice(0, 10);

  const trabalho = itens.map((it) => ({
    ...it,
    chave: palavrasChave(it),
    espec: tokensEspec(it),
    candidatos: [],
  }));

  // 1) busca de compras homologadas por palavra-chave (uma vez por palavra-chave)
  const buscas = new Map();
  for (const t of trabalho) if (t.chave.length) buscas.set(t.chave.join(' '), []);
  const compras = new Map();
  let feito = 0;
  await mapLimit([...buscas.keys()], 3, async (q) => {
    if (cancelado()) return;
    const achadas = [];
    for (let p = 1; p <= paginas && achadas.length < editaisPorItem; p++) {
      let data;
      try {
        data = await fetchJson(
          buildSearchUrl({
            q,
            pagina: p,
            tamanho: 50,
            tipo: 'edital',
            status: 'encerradas',
          }),
          { fetchImpl, retries: 3 },
        );
      } catch {
        break;
      }
      const lista = data?.items || [];
      for (const it of lista) {
        if (!it?.tem_resultado) continue;
        if (String(it.data_atualizacao_pncp || '').slice(0, 10) < corteIso) continue;
        if (interior && norm(it.municipio_nome) === CAPITAL) continue;
        const ref = parseCompraRef(it.item_url);
        if (!ref) continue;
        const k = chaveCompra(ref);
        if (!compras.has(k))
          compras.set(k, {
            ref,
            orgao: fixText(it.orgao_nome),
            municipio: fixText(it.municipio_nome),
            modalidade: it.modalidade_licitacao_nome || '',
            objeto: fixText(it.description),
            link: `https://pncp.gov.br/app/editais/${ref.cnpj}/${ref.ano}/${ref.seq}`,
          });
        if (achadas.length < editaisPorItem) achadas.push(k);
      }
      if (lista.length < 50) break;
    }
    buscas.set(q, achadas);
    onProgresso?.({
      fase: 'Procurando pregões homologados',
      feito: ++feito,
      total: buscas.size,
    });
  });

  // 2) itens de cada compra (uma vez por compra, servindo a todos os itens do termo)
  const precisa = new Set();
  for (const t of trabalho) for (const k of buscas.get(t.chave.join(' ')) || []) precisa.add(k);
  const itensCompra = new Map();
  let comprasComErro = 0;
  feito = 0;
  await mapLimit([...precisa], 4, async (k) => {
    if (cancelado()) return;
    try {
      itensCompra.set(k, await fetchItensCompra(compras.get(k).ref, fetchImpl, 5));
    } catch {
      comprasComErro++;
    }
    onProgresso?.({
      fase: 'Lendo os itens dos pregões',
      feito: ++feito,
      total: precisa.size,
    });
  });

  // 3) casa itens do termo × itens das compras (qualquer compra lida, não só a da própria busca)
  const pedidos = new Map();
  for (const t of trabalho) {
    if (!t.chave.length) continue;
    const achados = [];
    for (const [k, lista] of itensCompra) {
      for (const ic of lista) {
        if (!ic.temResultado) continue;
        const tk = new Set(tokens(ic.descricao));
        if (!t.chave.every((w) => tk.has(w))) continue;
        achados.push({ k, ic, aderencia: aderencia(t.espec, ic.descricao) });
      }
    }
    achados.sort((a, b) => b.aderencia - a.aderencia);
    for (const a of achados.slice(0, editaisPorItem * 2)) {
      const pk = `${a.k}#${a.ic.numero}`;
      if (!pedidos.has(pk)) pedidos.set(pk, { k: a.k, ic: a.ic, resultados: null });
      t.candidatos.push({ pk, aderencia: a.aderencia });
    }
  }

  // 4) resultados (vencedor e valor homologado) de cada item casado
  feito = 0;
  await mapLimit([...pedidos.values()], 4, async (p) => {
    if (cancelado()) return;
    try {
      p.resultados = await fetchResultadosItem(compras.get(p.k).ref, p.ic.numero, fetchImpl);
    } catch {
      p.resultados = [];
    }
    onProgresso?.({
      fase: 'Buscando preços ganhos e vencedores',
      feito: ++feito,
      total: pedidos.size,
    });
  });

  const saida = trabalho.map((t) => {
    const ocorrencias = [];
    for (const c of t.candidatos) {
      const p = pedidos.get(c.pk);
      const compra = compras.get(p.k);
      for (const r of p.resultados || []) {
        if (!r.valorUnitario) continue;
        if (r.data && r.data.slice(0, 10) < corteIso) continue;
        ocorrencias.push({
          orgao: compra.orgao,
          municipio: compra.municipio,
          modalidade: compra.modalidade,
          link: compra.link,
          itemNumero: p.ic.numero,
          descricao: p.ic.descricao,
          unidade: p.ic.unidade,
          quantidade: r.quantidade ?? p.ic.quantidade,
          valorEstimado: p.ic.valorUnitarioEstimado,
          valorUnitario: r.valorUnitario,
          fornecedor: r.fornecedor,
          fornecedorDoc: r.fornecedorDoc,
          data: r.data ? r.data.slice(0, 10) : '',
          marca: marcaDe(p.ic.descricao),
          aderencia: c.aderencia,
        });
      }
    }
    // mesmo resultado achado por dois caminhos aparece uma vez só
    const vistos = new Set();
    const unicas = marcarSuspeitos(
      ocorrencias.filter((o) => {
        const k = `${o.link}#${o.itemNumero}#${o.fornecedorDoc}`;
        return vistos.has(k) ? false : vistos.add(k);
      }),
      t.valorTermo,
    ).sort((a, b) => a.valorUnitario - b.valorUnitario);
    ocorrencias.length = 0;
    ocorrencias.push(...unicas);
    const melhor = escolherMelhor(t, ocorrencias);
    const { chave, espec, candidatos, ...item } = t;
    return {
      ...item,
      palavrasChave: chave.join(' '),
      ocorrencias,
      melhor,
      diferenca: melhor && t.valorTermo ? melhor.valorUnitario / t.valorTermo - 1 : null,
    };
  });
  return { itens: saida, comprasLidas: itensCompra.size, comprasComErro };
}

// ---------------------------------------------------------------- relatórios

const moeda = (v) => (v == null ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const pct = (v, casas = 0) => (v == null ? '' : `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`);
const dataBR = (s) => (s ? s.split('-').reverse().join('/') : '');

/** Totais do termo × melhores preços (só itens com preço e quantidade nos dois lados). */
export function totaisTermo(itens) {
  let termo = 0;
  let ganho = 0;
  let comparados = 0;
  for (const i of itens) {
    if (!i.melhor || !i.valorTermo) continue;
    const q = i.quantidade || 1;
    termo += i.valorTermo * q;
    ganho += i.melhor.valorUnitario * q;
    comparados++;
  }
  return {
    termo,
    ganho,
    comparados,
    encontrados: itens.filter((i) => i.melhor).length,
    total: itens.length,
  };
}

export function abasExcelTermo(itens, { meses, interior }) {
  const resumo = {
    nome: 'Melhor preço por item',
    colunas: [
      { titulo: 'Item', largura: 7 },
      { titulo: 'Descrição no termo', largura: 50 },
      { titulo: 'Unidade', largura: 9 },
      { titulo: 'Quantidade', largura: 11, tipo: 'numero' },
      { titulo: 'Valor do termo', largura: 14, tipo: 'moeda' },
      { titulo: 'Menor preço ganho', largura: 15, tipo: 'moeda' },
      { titulo: 'Diferença (%)', largura: 12, tipo: 'numero' },
      { titulo: 'Município', largura: 20 },
      { titulo: 'Órgão', largura: 34 },
      { titulo: 'Data do resultado', largura: 13, tipo: 'data' },
      { titulo: 'Fornecedor vencedor', largura: 34 },
      { titulo: 'CNPJ do fornecedor', largura: 18 },
      { titulo: 'Marca', largura: 18 },
      { titulo: 'Descrição do item ganho', largura: 60 },
      { titulo: 'Unidade do item ganho', largura: 12 },
      { titulo: 'Aderência à especificação (%)', largura: 14, tipo: 'numero' },
      { titulo: 'Critério', largura: 34 },
      { titulo: 'Ocorrências encontradas', largura: 12, tipo: 'numero' },
      { titulo: 'Link do pregão', largura: 50 },
    ],
    linhas: itens.map((i) => {
      const m = i.melhor;
      return [
        i.numero,
        i.descricao,
        i.unidade,
        i.quantidade,
        i.valorTermo,
        m?.valorUnitario ?? null,
        i.diferenca == null ? null : Math.round(i.diferenca * 1000) / 10,
        m?.municipio || '',
        m?.orgao || (i.ocorrencias.length ? '' : 'Nada encontrado no período'),
        m?.data || '',
        m?.fornecedor || '',
        m?.fornecedorDoc || '',
        m ? m.marca || 'Não informada no PNCP' : '',
        m?.descricao || '',
        m?.unidade || '',
        m ? Math.round(m.aderencia * 100) : null,
        m?.criterio || '',
        i.ocorrencias.length,
        m?.link || '',
      ];
    }),
  };
  const todas = {
    nome: 'Todas as ocorrências',
    colunas: [
      { titulo: 'Item do termo', largura: 9 },
      { titulo: 'Descrição no termo', largura: 40 },
      { titulo: 'Preço ganho', largura: 13, tipo: 'moeda' },
      { titulo: 'Valor estimado do órgão', largura: 14, tipo: 'moeda' },
      { titulo: 'Município', largura: 20 },
      { titulo: 'Órgão', largura: 34 },
      { titulo: 'Data', largura: 12, tipo: 'data' },
      { titulo: 'Fornecedor', largura: 34 },
      { titulo: 'Marca', largura: 18 },
      { titulo: 'Descrição do item ganho', largura: 60 },
      { titulo: 'Unidade', largura: 10 },
      { titulo: 'Quantidade', largura: 11, tipo: 'numero' },
      { titulo: 'Aderência (%)', largura: 11, tipo: 'numero' },
      { titulo: 'Link do pregão', largura: 50 },
    ],
    linhas: itens.flatMap((i) =>
      i.ocorrencias.map((o) => [
        i.numero,
        i.descricao,
        o.valorUnitario,
        o.valorEstimado,
        o.municipio,
        o.orgao,
        o.data,
        o.fornecedor,
        o.marca || 'Não informada no PNCP',
        o.suspeito ? `${o.descricao} [preço fora da curva ou muito distante do termo: não usado]` : o.descricao,
        o.unidade,
        o.quantidade,
        Math.round(o.aderencia * 100),
        o.link,
      ]),
    ),
  };
  const info = {
    nome: 'Sobre a pesquisa',
    colunas: [
      { titulo: 'Item', largura: 30 },
      { titulo: 'Valor', largura: 90 },
    ],
    linhas: [
      ['Fonte', 'PNCP (Portal Nacional de Contratações Públicas): pregões e dispensas encerrados com resultado homologado'],
      ['Região', interior ? 'Minas Gerais, interior (sem Belo Horizonte)' : 'Minas Gerais'],
      ['Período', `Últimos ${meses} meses`],
      [
        'Regra do melhor preço',
        'Menor preço homologado entre os itens com 60% ou mais da especificação do termo (40% em especificações longas, resumidas no nome, medidas e primeiras exigências); se o termo tem pouca especificação, o menor preço.',
      ],
      [
        'Marca',
        'O PNCP não publica a marca do vencedor. Ela aparece quando o órgão a escreveu na descrição do item; nos demais casos, consulte a ata no link do pregão.',
      ],
    ],
  };
  return [resumo, todas, info];
}

export function blocosPdfTermo(itens, { meses, interior, nomeArquivo, dataText }) {
  const t = totaisTermo(itens);
  const b = [
    { type: 'date', text: dataText },
    { type: 'title', text: 'Pesquisa de preços · termo de referência' },
    {
      type: 'para',
      text: `${nomeArquivo ? `Termo: ${nomeArquivo}. ` : ''}${t.total} itens pesquisados no PNCP em pregões homologados de ${interior ? 'Minas Gerais (interior)' : 'Minas Gerais'} nos últimos ${meses} meses. Preço encontrado para ${t.encontrados} ${t.encontrados === 1 ? 'item' : 'itens'}.`,
      gapAfter: 6,
    },
  ];
  if (t.comparados)
    b.push({
      type: 'table',
      widths: [0.6, 0.4],
      rows: [
        [`Valor do termo (${t.comparados} itens com preço encontrado × quantidade)`, { text: moeda(t.termo), align: 'right' }],
        ['Mesmos itens pelos menores preços ganhos', { text: moeda(t.ganho), align: 'right' }],
        [
          { text: 'Diferença', bold: true },
          {
            text: `${moeda(t.ganho - t.termo)} (${pct(t.termo ? t.ganho / t.termo - 1 : 0, 1)})`,
            align: 'right',
            bold: true,
          },
        ],
      ],
      totalRows: 1,
    });
  b.push({ type: 'heading', text: 'Menor preço ganho por item' });
  b.push({
    type: 'table',
    widths: [0.06, 0.3, 0.11, 0.11, 0.2, 0.22],
    header: ['Item', 'Descrição no termo', 'Termo', 'Ganho', 'Onde e quando', 'Fornecedor e marca'],
    headerAlign: ['center', 'left', 'right', 'right', 'left', 'left'],
    rows: itens.map((i) => {
      const m = i.melhor;
      const desc = i.descricao.length > 140 ? `${i.descricao.slice(0, 137)}...` : i.descricao;
      return [
        { text: i.numero, align: 'center' },
        desc,
        { text: moeda(i.valorTermo), align: 'right' },
        {
          text: m ? `${moeda(m.valorUnitario)}${i.diferenca != null ? `\n${i.diferenca > 0 ? '+' : ''}${pct(i.diferenca, 1)}` : ''}` : 'Não encontrado',
          align: 'right',
          bold: !!m,
        },
        m ? `${m.municipio}\n${m.orgao}\n${dataBR(m.data)} · aderência ${pct(m.aderencia)}` : '',
        m ? `${m.fornecedor}\nMarca: ${m.marca || 'não informada no PNCP'}` : '',
      ];
    }),
  });
  b.push({
    type: 'note',
    text: 'Fonte: PNCP, valores unitários homologados. Regra: menor preço entre os itens com 60% ou mais da especificação do termo (40% em especificações longas, resumidas no nome, medidas e primeiras exigências); se o termo tem pouca especificação, o menor preço. Confira unidade de fornecimento e especificação no link do pregão (planilha Excel). O PNCP não publica a marca do vencedor: ela aparece quando o órgão a escreveu na descrição; nos demais casos, está na ata do pregão.',
  });
  return b;
}
