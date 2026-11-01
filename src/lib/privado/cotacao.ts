// Cotação a partir de um termo de referência (área Privado):
// lê a base de custos no Drive (todas as planilhas da pasta, inclusive subpastas) e guarda no navegador
// o que já foi lido; na próxima vez, só baixa as planilhas que mudaram.
import { lerXlsxAbas } from '../planilhaLeitura.js';
import { extrairCotacoes } from './baseCustos.js';
import { baixar, exportar, listarFilhos, PASTA, PLANILHA_GOOGLE, XLSX, type ArquivoDrive } from './drive.ts';

export interface Cotacao {
  descricao: string;
  marca: string;
  referencia: string;
  link: string;
  compra: number;
  colunaCompra: string;
  arquivo: string;
  arquivoId: string;
  arquivoLink: string;
  modificado: string;
  aba: string;
  linha: number;
}

// ---------------------------------------------------------------- cache no navegador (IndexedDB)

const BANCO = 'agilcm-custos';
const LOJA = 'planilhas';

function abrirBanco(): Promise<IDBDatabase | null> {
  return new Promise((ok) => {
    try {
      const req = indexedDB.open(BANCO, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(LOJA);
      req.onsuccess = () => ok(req.result);
      req.onerror = () => ok(null);
    } catch {
      ok(null);
    }
  });
}

async function lerCache(id: string): Promise<{ mod: string; itens: Cotacao[] } | null> {
  const db = await abrirBanco();
  if (!db) return null;
  return new Promise((ok) => {
    try {
      const req = db.transaction(LOJA).objectStore(LOJA).get(id);
      req.onsuccess = () => ok(req.result || null);
      req.onerror = () => ok(null);
    } catch {
      ok(null);
    }
  });
}

async function gravarCache(id: string, valor: { mod: string; itens: Cotacao[] }) {
  const db = await abrirBanco();
  if (!db) return;
  try {
    db.transaction(LOJA, 'readwrite').objectStore(LOJA).put(valor, id);
  } catch {
    /* sem cache: lê de novo na próxima vez */
  }
}

// ---------------------------------------------------------------- leitura da pasta

async function planilhasDaPasta(pastaId: string, caminho = ''): Promise<(ArquivoDrive & { caminho: string })[]> {
  const out: (ArquivoDrive & { caminho: string })[] = [];
  for (const f of await listarFilhos(pastaId)) {
    if (f.mimeType === PASTA) out.push(...(await planilhasDaPasta(f.id, `${caminho}${f.name}/`)));
    else if (f.mimeType === XLSX || f.mimeType === PLANILHA_GOOGLE || /\.xlsx$/i.test(f.name)) out.push({ ...f, caminho });
  }
  return out;
}

/**
 * Lê todas as planilhas de custo da pasta e devolve os itens cotados (descrição, link, marca, valor de compra).
 * Planilhas que não mudaram desde a última leitura vêm do cache do navegador.
 */
export async function carregarBase(
  pastaId: string,
  progresso: (etapa: string, feito?: number, total?: number) => void,
): Promise<{ itens: Cotacao[]; planilhas: number; comErro: string[] }> {
  progresso('Listando as planilhas da pasta');
  const arquivos = await planilhasDaPasta(pastaId);
  const itens: Cotacao[] = [];
  const comErro: string[] = [];
  let feito = 0;
  const fila = [...arquivos];
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (fila.length) {
        const f = fila.shift()!;
        const mod = f.modifiedTime || '';
        try {
          const cache = await lerCache(f.id);
          if (cache && cache.mod === mod) itens.push(...cache.itens);
          else {
            const bytes = f.mimeType === PLANILHA_GOOGLE ? await exportar(f.id, XLSX) : await baixar(f.id);
            const abas = await lerXlsxAbas(bytes);
            const lidos = extrairCotacoes(abas, { arquivo: `${f.caminho}${f.name}`, arquivoId: f.id, link: f.webViewLink, modificado: mod }) as Cotacao[];
            itens.push(...lidos);
            await gravarCache(f.id, { mod, itens: lidos });
          }
        } catch {
          comErro.push(f.name);
        }
        progresso('Lendo as planilhas de custo', ++feito, arquivos.length);
      }
    }),
  );
  return { itens, planilhas: arquivos.length, comErro };
}
