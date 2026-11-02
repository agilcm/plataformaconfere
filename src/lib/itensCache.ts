// Itens dos editais guardados no navegador (IndexedDB): o PNCP às vezes leva dezenas de segundos para
// devolver os itens de uma compra; com o cache, a Super Sugestão aberta de novo já usa o que foi lido.

const BANCO = 'agilcm-itens';
const LOJA = 'compras';
const VALIDADE = 5 * 24 * 3600e3;

let banco: Promise<IDBDatabase | null> | null = null;
function abrir(): Promise<IDBDatabase | null> {
  banco ??= new Promise((ok) => {
    try {
      const req = indexedDB.open(BANCO, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(LOJA);
      req.onsuccess = () => ok(req.result);
      req.onerror = () => ok(null);
    } catch {
      ok(null);
    }
  });
  return banco;
}

/** Itens guardados de vários editais de uma vez: Map id → itens (só os ainda válidos) */
export async function itensGuardados(ids: string[]): Promise<Map<string, any[]>> {
  const out = new Map<string, any[]>();
  const db = await abrir();
  if (!db || !ids.length) return out;
  return new Promise((ok) => {
    try {
      const loja = db.transaction(LOJA).objectStore(LOJA);
      let falta = ids.length;
      for (const id of ids) {
        const req = loja.get(id);
        req.onsuccess = () => {
          const v = req.result;
          if (v && Date.now() - v.at < VALIDADE && Array.isArray(v.itens)) out.set(id, v.itens);
          if (--falta === 0) ok(out);
        };
        req.onerror = () => --falta === 0 && ok(out);
      }
    } catch {
      ok(out);
    }
  });
}

export async function guardarItens(id: string, itens: any[]) {
  const db = await abrir();
  if (!db) return;
  try {
    db.transaction(LOJA, 'readwrite').objectStore(LOJA).put({ at: Date.now(), itens }, id);
  } catch {
    /* sem cache: lê de novo na próxima vez */
  }
}
