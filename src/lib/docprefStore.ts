// DocPref: prestadoras e conferências guardadas neste navegador (com cópia de segurança em arquivo).
// A leitura automática das pastas vem de docpref/leitura.json (GitHub Actions); aqui ficam só as marcações da equipe.
import { useSyncExternalStore } from 'react';

export interface Prestadora {
  id: string;
  razao: string;
  cnpj: string;
  contrato: string;
  email: string;
  pasta: string; // link da pasta no Google Drive
  dia: number; // dia do mês seguinte para enviar os documentos (0 = último dia do mês seguinte)
  drive?: string; // nome da pasta da prestadora dentro da pasta lida pelo DocPref (quando o nome não bate sozinho)
  inicio?: string; // competência de início do contrato (AAAA-MM)
}
export interface Conferencia {
  situacoes: Record<string, boolean>;
  itens: Record<string, { status: 'pendente' | 'ok' | 'recusado' | 'na'; motivo?: string }>;
  atualizadoEm: string;
}
export interface DadosDocPref {
  prestadoras: Prestadora[];
  conferencias: Record<string, Conferencia>; // chave: `${prestadora.id}|AAAA-MM`
}

const CHAVE = 'agilcm:docpref';
const ANTIGA = 'agilcm:bancodoc'; // nome anterior do sistema
const EVENTO = 'agilcm:docpref';
const VAZIO: DadosDocPref = { prestadoras: [], conferencias: {} };
let cache: DadosDocPref | null = null;

function ler(): DadosDocPref {
  if (cache) return cache;
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || localStorage.getItem(ANTIGA) || 'null');
    cache = v && Array.isArray(v.prestadoras) ? { prestadoras: v.prestadoras, conferencias: v.conferencias || {} } : VAZIO;
  } catch {
    cache = VAZIO;
  }
  return cache;
}

function gravar(novo: DadosDocPref) {
  cache = novo;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(novo));
  } catch {
    /* sem armazenamento: fica só enquanto a página estiver aberta */
  }
  window.dispatchEvent(new Event(EVENTO));
}

function assinar(aviso: () => void) {
  const deOutraAba = (e: StorageEvent) => {
    if (e.key === CHAVE) {
      cache = null;
      aviso();
    }
  };
  window.addEventListener(EVENTO, aviso);
  window.addEventListener('storage', deOutraAba);
  return () => {
    window.removeEventListener(EVENTO, aviso);
    window.removeEventListener('storage', deOutraAba);
  };
}

export const useDocPref = () => useSyncExternalStore(assinar, ler, () => VAZIO);

export const chaveConferencia = (prestadoraId: string, comp: string) => `${prestadoraId}|${comp}`;

export function salvarPrestadora(p: Omit<Prestadora, 'id'> & { id?: string }) {
  const d = ler();
  const id = p.id || `p${Date.now().toString(36)}`;
  const nova = { ...p, id, dia: Math.min(31, Math.max(0, Number(p.dia) || 0)) } as Prestadora;
  const existe = d.prestadoras.some((x) => x.id === id);
  gravar({ ...d, prestadoras: existe ? d.prestadoras.map((x) => (x.id === id ? nova : x)) : [...d.prestadoras, nova] });
  return id;
}

export function removerPrestadora(id: string) {
  const d = ler();
  gravar({
    prestadoras: d.prestadoras.filter((x) => x.id !== id),
    conferencias: Object.fromEntries(Object.entries(d.conferencias).filter(([k]) => !k.startsWith(`${id}|`))),
  });
}

export function atualizarConferencia(prestadoraId: string, comp: string, mudar: (c: Conferencia) => Conferencia) {
  const d = ler();
  const k = chaveConferencia(prestadoraId, comp);
  const atual: Conferencia = d.conferencias[k] || { situacoes: {}, itens: {}, atualizadoEm: '' };
  gravar({ ...d, conferencias: { ...d.conferencias, [k]: { ...mudar(atual), atualizadoEm: new Date().toISOString() } } });
}

export const exportarDocPref = () => JSON.stringify({ versao: 1, exportadoEm: new Date().toISOString(), ...ler() }, null, 1);

export function importarDocPref(texto: string) {
  const v = JSON.parse(texto);
  if (!Array.isArray(v?.prestadoras)) throw new Error('arquivo inválido');
  const d = ler();
  const prestadoras = [...d.prestadoras.filter((p) => !v.prestadoras.some((x: Prestadora) => x.id === p.id)), ...v.prestadoras];
  gravar({ prestadoras, conferencias: { ...d.conferencias, ...(v.conferencias || {}) } });
  return v.prestadoras.length as number;
}
