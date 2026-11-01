// Base de custos: lê as planilhas de cotação da pasta "PLANILHAS PARA LICITAÇÕES" (cada aba é uma licitação)
// e guarda, de cada item já cotado, a descrição, o link de referência, a marca e o valor de compra.
// Depois procura os itens de um termo de referência nessa base.
import { aderencia, escolherMelhor, medidas, norm, palavrasChave, tokens, tokensEspec } from '../termoReferencia.js';

const num = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v ?? '')
    .replace(/r\$|\s/gi, '')
    .trim();
  if (!s || !/\d/.test(s)) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const letra = (i) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

// Colunas de preço de compra, da mais confiável para a menos (as planilhas antigas não têm "valor de compra").
const COMPRA = [/^valor (unit[aá]rio )?de compra/, /^pre[cç]o (unit[aá]rio )?de compra/, /^custo (de )?compra unit/, /^lance m[aá]ximo/];

/** Acha o cabeçalho de uma aba (descrição + marca/link/compra nas 12 primeiras linhas). */
export function cabecalhoCustos(linhas) {
  for (let r = 0; r < Math.min(12, linhas.length); r++) {
    const cab = (linhas[r] || []).map((c) => norm(c).replace(/\s+/g, ' ').trim());
    const ach = (re, nao) => cab.findIndex((h) => h && re.test(h) && !(nao && nao.test(h)));
    const item = ach(/^descri[cç][aã]o (do )?item|^descri[cç][aã]o t[eé]cnica|^descri[cç][aã]o$|^descri[cç][aã]o do produto|^produto$|^item$/);
    const lote = ach(/^descri[cç][aã]o (do )?lote/);
    const desc = item >= 0 ? item : lote;
    if (desc < 0) continue;
    const marca = ach(/^marca\b|marca oferecida/, /marcas? de refer/);
    const ref = ach(/^refer[eê]ncia$|^link\b/);
    let compra = -1;
    let colunaCompra = '';
    for (const re of COMPRA) {
      compra = ach(re);
      if (compra >= 0) {
        colunaCompra = String(linhas[r][compra]).trim();
        break;
      }
    }
    if (compra < 0 || (marca < 0 && ref < 0)) continue;
    return { linha: r, desc, lote: lote !== desc ? lote : -1, marca, ref, compra, colunaCompra };
  }
  return null;
}

/**
 * Itens cotados de uma planilha (todas as abas).
 * @param {{ nome: string, linhas: any[][], links: Record<string, string> }[]} abas
 * @param {{ arquivo: string, arquivoId?: string, link?: string, modificado?: string }} origem
 */
export function extrairCotacoes(abas, origem) {
  const out = [];
  for (const aba of abas) {
    const c = cabecalhoCustos(aba.linhas);
    if (!c) continue;
    for (let r = c.linha + 1; r < aba.linhas.length; r++) {
      const l = aba.linhas[r] || [];
      const compra = num(l[c.compra]);
      if (!compra || compra <= 0) continue;
      let descricao = String(l[c.desc] ?? '')
        .replace(/\s+/g, ' ')
        .trim();
      const nomeLote =
        c.lote >= 0
          ? String(l[c.lote] ?? '')
              .replace(/\s+/g, ' ')
              .trim()
          : '';
      if (nomeLote && !/^lote\s*\d*$/i.test(nomeLote) && !norm(descricao).startsWith(norm(nomeLote))) descricao = `${nomeLote} - ${descricao}`;
      if (descricao.length < 3) continue;
      const marca = c.marca >= 0 ? String(l[c.marca] ?? '').trim() : '';
      const celRef = c.ref >= 0 ? `${letra(c.ref)}${r + 1}` : '';
      const textoRef = c.ref >= 0 ? String(l[c.ref] ?? '').trim() : '';
      const link = (celRef && aba.links[celRef]) || (/^https?:\/\//i.test(textoRef) ? textoRef : '');
      const referencia = /^https?:\/\//i.test(textoRef) ? '' : textoRef;
      if (!link && !marca && !referencia) continue;
      out.push({
        descricao,
        marca,
        referencia,
        link,
        compra: Math.round(compra * 100) / 100,
        colunaCompra: c.colunaCompra,
        arquivo: origem.arquivo,
        arquivoId: origem.arquivoId || '',
        arquivoLink: origem.link || '',
        modificado: origem.modificado || '',
        aba: aba.nome,
        linha: r + 1,
      });
    }
  }
  return out;
}

/** Pré-calcula as palavras de cada item da base (para buscar rápido em termos grandes). */
export const indexar = (base) => base.map((b) => ({ ...b, tk: new Set(tokens(b.descricao)) }));

/**
 * Procura um item do termo na base de custos.
 * Escolhe o menor valor de compra que encaixa na especificação (mesma regra da pesquisa de contratos)
 * e devolve também as alternativas, da mais parecida para a menos. `confiavel` = encaixa sem ressalva
 * (só esses entram sozinhos na planilha; os outros ficam como sugestão para escolher).
 */
export function buscarNaBase(item, base) {
  const chave = palavrasChave(item);
  if (!chave.length) return { melhor: null, alternativas: [] };
  const espec = tokensEspec(item);
  const cands = [];
  for (const b of base) {
    const tk = b.tk || new Set(tokens(b.descricao));
    if (!chave.every((w) => tk.has(w))) continue;
    cands.push({ ...b, tk: undefined, valorUnitario: b.compra, aderencia: aderencia(espec, b.descricao) });
  }
  cands.sort((a, b) => b.aderencia - a.aderencia || a.compra - b.compra);
  const escolhido = escolherMelhor(item, cands);
  // medida diferente (9.000 × 12.000 BTUs) não serve; aderência parcial fica só como sugestão
  const melhor = escolhido && !/^nenhum com a mesma medida/.test(escolhido.criterio || '') ? escolhido : null;
  // a medida do nome (9.000 BTUs, 48 portas) bate: é o mesmo produto, mesmo com a descrição mais curta
  const medNome = medidas(tokens(item.produto || '')).filter((t) => !t.endsWith('v'));
  const mesmaMedida = !!melhor && medNome.length > 0 && medNome.every((m) => new Set(tokens(melhor.descricao)).has(m));
  const confiavel = !!melhor && (!/confira/.test(melhor.criterio || '') || mesmaMedida);
  return { melhor, confiavel, alternativas: cands.slice(0, 12) };
}
