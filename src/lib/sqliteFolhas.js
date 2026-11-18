// Leitura de páginas de um arquivo SQLite sem o SQLite: serve para varrer em sequência o cadastro de CNPJ da Receita
// (cnpj.db, 28 GB, no Google Drive) sem baixar o arquivo inteiro. Cada página "folha de tabela" traz as linhas
// completas; a tabela de cada linha é reconhecida pelo número de colunas e pelo conteúdo (scripts/cadastro-cnpj.mjs).
// Linhas grandes demais para caber numa página (com "overflow") ficam de fora e são contadas. Puro: recebe bytes.

/** Tipos de página do SQLite */
export const PAGINA = { INDICE_INTERNA: 2, TABELA_INTERNA: 5, INDICE_FOLHA: 10, TABELA_FOLHA: 13 };

const decodificador = new TextDecoder('utf-8');

/** Inteiro de tamanho variável do SQLite (1 a 9 bytes) → [valor, próxima posição] */
export function varint(b, i) {
  let v = 0;
  for (let k = 0; k < 8; k++) {
    const c = b[i + k];
    v = v * 128 + (c & 0x7f);
    if (c < 0x80) return [v, i + k + 1];
  }
  return [v * 256 + b[i + 8], i + 9];
}

/**
 * Os valores de um registro (linha) a partir da posição do cabeçalho.
 * @returns {(string | number | null | Uint8Array)[]}
 */
export function registro(b, i, fim = b.length) {
  const [tamCab, j0] = varint(b, i);
  const fimCab = i + tamCab;
  const tipos = [];
  let j = j0;
  while (j < fimCab) {
    const [t, k] = varint(b, j);
    tipos.push(t);
    j = k;
  }
  const vals = [];
  let p = fimCab;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  for (const t of tipos) {
    if (p > fim) throw new Error('registro maior que a página');
    if (t === 0) vals.push(null);
    else if (t >= 1 && t <= 6) {
      const n = [0, 1, 2, 3, 4, 6, 8][t];
      vals.push(n === 8 ? Number(dv.getBigInt64(p)) : inteiro(b, p, n));
      p += n;
    } else if (t === 7) {
      vals.push(dv.getFloat64(p));
      p += 8;
    } else if (t === 8 || t === 9) vals.push(t - 8);
    else if (t >= 12) {
      const n = (t - 12) >> 1;
      vals.push(t % 2 ? decodificador.decode(b.subarray(p, p + n)) : b.slice(p, p + n));
      p += n;
    } else vals.push(null);
  }
  return vals;
}

/** Inteiro com sinal, big-endian, de n bytes */
function inteiro(b, p, n) {
  let v = 0;
  for (let k = 0; k < n; k++) v = v * 256 + b[p + k];
  const lim = 2 ** (8 * n - 1);
  return v >= lim ? v - 2 * lim : v;
}

/**
 * As linhas de uma página "folha de tabela" (tipo 13). Outras páginas devolvem [].
 * @param {Uint8Array} pagina  a página inteira (o tamanho da página do arquivo)
 * @param {{ primeira?: boolean }} [o]  primeira: é a página 1 (o cabeçalho de 100 bytes do arquivo vem antes)
 * @returns {{ linhas: { rowid: number, valores: any[] }[], grandes: number, tipo: number }}
 */
export function linhasDaPagina(pagina, o = {}) {
  const h = o.primeira ? 100 : 0;
  const tipo = pagina[h];
  if (tipo !== PAGINA.TABELA_FOLHA) return { linhas: [], grandes: 0, tipo };
  const n = (pagina[h + 3] << 8) | pagina[h + 4];
  const U = pagina.length;
  const X = U - 35; // maior conteúdo que cabe inteiro na página
  const linhas = [];
  let grandes = 0;
  for (let k = 0; k < n; k++) {
    const off = (pagina[h + 8 + 2 * k] << 8) | pagina[h + 8 + 2 * k + 1];
    const [tam, j] = varint(pagina, off);
    const [rowid, ini] = varint(pagina, j);
    if (tam > X) {
      grandes++;
      continue;
    }
    try {
      linhas.push({ rowid, valores: registro(pagina, ini, ini + tam) });
    } catch {
      grandes++;
    }
  }
  return { linhas, grandes, tipo };
}

/** Filhos de uma página interna de tabela (tipo 5): números das páginas, o da direita por último */
export function filhosDaPagina(pagina, o = {}) {
  const h = o.primeira ? 100 : 0;
  if (pagina[h] !== PAGINA.TABELA_INTERNA) return [];
  const n = (pagina[h + 3] << 8) | pagina[h + 4];
  const u32 = (i) => ((pagina[i] << 24) >>> 0) + (pagina[i + 1] << 16) + (pagina[i + 2] << 8) + pagina[i + 3];
  const out = [];
  for (let k = 0; k < n; k++) out.push(u32((pagina[h + 12 + 2 * k] << 8) | pagina[h + 12 + 2 * k + 1]));
  out.push(u32(h + 8));
  return out;
}

/** Tamanho da página do arquivo (cabeçalho "SQLite format 3") */
export function tamanhoDaPagina(inicio) {
  if (new TextDecoder().decode(inicio.subarray(0, 15)) !== 'SQLite format 3') throw new Error('Não é um arquivo SQLite');
  const t = (inicio[16] << 8) | inicio[17];
  return t === 1 ? 65536 : t;
}

/**
 * Todas as linhas de uma tabela pequena, percorrendo a árvore a partir da página raiz.
 * @param {(numero: number) => Uint8Array | Promise<Uint8Array>} pagina  devolve a página pelo número (1 = a primeira)
 */
export async function lerTabela(pagina, raiz) {
  const out = [];
  const pilha = [raiz];
  while (pilha.length) {
    const numero = pilha.shift();
    const b = await pagina(numero);
    const primeira = numero === 1;
    if (b[primeira ? 100 : 0] === PAGINA.TABELA_INTERNA) pilha.unshift(...filhosDaPagina(b, { primeira }));
    else out.push(...linhasDaPagina(b, { primeira }).linhas);
  }
  return out;
}
