// Listas completas de editais abertos (Zona da Mata e Minas Gerais), carregadas uma vez só e
// compartilhadas por Editais abertos, AGIL CNAE, Super Sugestão e a exportação para Excel.
//  - na memória enquanto a página está aberta (trocar de aba não lê de novo);
//  - no navegador (IndexedDB) por 30 minutos (recarregar a página também não lê de novo);
//  - se duas partes pedem a mesma lista ao mesmo tempo, o PNCP é lido uma vez e as duas acompanham o progresso;
//  - a Zona da Mata sai da lista de Minas Gerais quando ela já está carregada.
import { PNCP_MUNICIPIOS_ZM } from '../data/pncpMunicipiosZM.js';
import { fetchAllMG, fetchMunicipios } from './pncp.js';

export type Chave = 'mg' | 'zm';
export type Progresso = (lidos: number, total: number) => void;
export interface Lista {
  items: any[];
  at: number; // quando foi lida do PNCP
  incompleto?: boolean;
}

const VALIDADE = 30 * 60e3;
const ZM_IDS = Object.values(PNCP_MUNICIPIOS_ZM) as string[];
const memoria = new Map<Chave, Lista>();
const andamento = new Map<Chave, { promessa: Promise<Lista>; ouvintes: Set<Progresso>; ultimo?: [number, number] }>();
const fresca = (l?: Lista | null): l is Lista => !!l && Date.now() - l.at < VALIDADE;

// ---------------------------------------------------------------- IndexedDB

const BANCO = 'agilcm-editais';
const LOJA = 'listas';
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
async function ler(chave: Chave): Promise<Lista | null> {
  const db = await abrir();
  if (!db) return null;
  return new Promise((ok) => {
    try {
      const req = db.transaction(LOJA).objectStore(LOJA).get(chave);
      req.onsuccess = () => ok(req.result || null);
      req.onerror = () => ok(null);
    } catch {
      ok(null);
    }
  });
}
async function gravar(chave: Chave, lista: Lista | null) {
  const db = await abrir();
  if (!db) return;
  try {
    const loja = db.transaction(LOJA, 'readwrite').objectStore(LOJA);
    if (lista) loja.put(lista, chave);
    else loja.delete(chave);
  } catch {
    /* sem cache: lê de novo na próxima vez */
  }
}

// ---------------------------------------------------------------- listas

/** A lista já carregada (sem ler nada), se ainda vale */
export function listaPronta(chave: Chave): Lista | null {
  const m = memoria.get(chave);
  if (fresca(m)) return m;
  const mg = memoria.get('mg');
  if (chave === 'zm' && fresca(mg)) return { items: mg.items.filter((e) => e.microrregiao), at: mg.at, incompleto: mg.incompleto };
  return null;
}

/** Lista completa da região: da memória, do navegador ou do PNCP (nessa ordem) */
export async function listaDe(chave: Chave, onProgress?: Progresso): Promise<Lista> {
  const pronta = listaPronta(chave);
  if (pronta) return pronta;
  let a = andamento.get(chave);
  if (!a) {
    const estado: { promessa?: Promise<Lista>; ouvintes: Set<Progresso>; ultimo?: [number, number] } = { ouvintes: new Set() };
    const avisar: Progresso = (lidos, total) => {
      estado.ultimo = [lidos, total];
      estado.ouvintes.forEach((f) => f(lidos, total));
    };
    estado.promessa = (async () => {
      const salva = await ler(chave);
      if (fresca(salva)) {
        memoria.set(chave, salva);
        return salva;
      }
      const r = chave === 'zm' ? await fetchMunicipios(ZM_IDS, { onProgress: avisar }) : await fetchAllMG({ onProgress: avisar });
      const lista: Lista = { items: r.items, at: Date.now(), incompleto: r.paginasComErro > 0 };
      memoria.set(chave, lista);
      // lista com páginas faltando não fica guardada para a próxima visita
      if (!lista.incompleto) gravar(chave, lista);
      return lista;
    })().finally(() => andamento.delete(chave));
    a = estado as { promessa: Promise<Lista>; ouvintes: Set<Progresso>; ultimo?: [number, number] };
    andamento.set(chave, a);
  }
  if (onProgress) {
    a.ouvintes.add(onProgress);
    if (a.ultimo) onProgress(...a.ultimo);
  }
  try {
    return await a.promessa;
  } finally {
    if (onProgress) a.ouvintes.delete(onProgress);
  }
}

/** Começa a ler uma lista em segundo plano (para ela já estar pronta quando for pedida) */
export function preCarregar(chave: Chave) {
  listaDe(chave).catch(() => {
    /* quem pedir de novo tenta outra vez */
  });
}

/** Esquece as listas guardadas: a próxima consulta lê tudo de novo no PNCP */
export function descartarListas() {
  memoria.clear();
  gravar('mg', null);
  gravar('zm', null);
}
