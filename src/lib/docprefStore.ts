// DocPref: o órgão, as contratadas e as conferências do fiscal. Ficam neste navegador e, com a planilha do órgão
// conectada (scripts/apps-script/docpref.gs), numa planilha Google compartilhada: todos os fiscais veem as mesmas
// marcações, em qualquer computador. A leitura automática das pastas vem de docpref/leitura.json (GitHub Actions).
import { useSyncExternalStore } from 'react';
import { ANTIGO, carimbar, limparRemovidos, mesclarDocPref, paraRegistros, resumoRegistro } from './docprefSinc.js';

/** App da Web da planilha do órgão (https://script.google.com/macros/s/…/exec). Preenchido aqui, cada fiscal só digita a senha. */
export const DOCPREF_URL = 'https://script.google.com/macros/s/AKfycbz6UPiTLDHgN_VSbnRuCi0sb9H4Pcyfhojz0tykiq_nCNA-QRLDMvo1NGNDMbgxr8Y/exec';

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
  fiscal?: string; // fiscal do contrato (assina a notificação)
  objeto?: string; // objeto do contrato
}
/** O órgão público que contrata e fiscaliza: aparece no cabeçalho da página, no parecer, nos relatórios e na notificação */
export interface ConfigDocPref {
  contratante: string; // nome do órgão (ex.: Prefeitura Municipal de ...)
  cnpj?: string; // CNPJ do órgão
  unidade?: string; // secretaria ou setor responsável pela fiscalização
  gestor?: string; // gestor dos contratos
  cidade?: string; // município e UF
  /** Papel do parecer e da notificação: 'orgao' (padrão quando o nome do órgão está preenchido) ou 'agil' (timbre da Ágil CM) */
  papel?: 'orgao' | 'agil';
  prazoRegularizacao: number; // dias úteis para regularizar depois da notificação (0 = o previsto no contrato)
}
/** Ajustes por prestadora (chave da prestadora): exigências que não se aplicam a ela em nenhum mês */
export interface AjustePrestadora {
  naoAplica: string[];
}
export interface Conferencia {
  situacoes: Record<string, boolean>;
  itens: Record<string, { status: 'pendente' | 'ok' | 'recusado' | 'na'; motivo?: string; em?: string }>;
  atualizadoEm: string;
}
export interface DadosDocPref {
  prestadoras: Prestadora[];
  conferencias: Record<string, Conferencia>; // chave: `${prestadora.id}|AAAA-MM`
  config: ConfigDocPref;
  ajustes: Record<string, AjustePrestadora>;
}

const CHAVE = 'agilcm:docpref';
const ANTIGA = 'agilcm:bancodoc'; // nome anterior do sistema
const CHAVE_CARIMBOS = 'agilcm:docpref:carimbos'; // data da última mudança de cada registro e as remoções
const CHAVE_PLANILHA = 'agilcm:docpref:planilha'; // endereço, senha e nome de quem usa
const EVENTO = 'agilcm:docpref';
export const CONFIG_PADRAO: ConfigDocPref = { contratante: '', cnpj: '', unidade: '', gestor: '', cidade: '', prazoRegularizacao: 5 };
const VAZIO: DadosDocPref = { prestadoras: [], conferencias: {}, config: CONFIG_PADRAO, ajustes: {} };
let cache: DadosDocPref | null = null;

function ler(): DadosDocPref {
  if (cache) return cache;
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || localStorage.getItem(ANTIGA) || 'null');
    cache =
      v && Array.isArray(v.prestadoras)
        ? { prestadoras: v.prestadoras, conferencias: v.conferencias || {}, config: { ...CONFIG_PADRAO, ...(v.config || {}) }, ajustes: v.ajustes || {} }
        : VAZIO;
  } catch {
    cache = VAZIO;
  }
  return cache;
}

function lerJson<T>(chave: string, padrao: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(chave) || 'null');
    return v && typeof v === 'object' ? v : padrao;
  } catch {
    return padrao;
  }
}
function gravarJson(chave: string, v: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(v));
  } catch {
    /* sem armazenamento: fica só enquanto a página estiver aberta */
  }
}
type Carimbos = { carimbos: Record<string, string>; removidos: Record<string, string> };
const lerCarimbos = () => lerJson<Carimbos>(CHAVE_CARIMBOS, { carimbos: {}, removidos: {} });

/** Grava os dados; `daPlanilha` = veio da sincronização (as datas já vêm prontas e nada é reenviado) */
function gravar(novo: DadosDocPref, daPlanilha?: Carimbos) {
  const antes = ler();
  cache = novo;
  gravarJson(CHAVE, novo);
  if (daPlanilha) gravarJson(CHAVE_CARIMBOS, { carimbos: daPlanilha.carimbos, removidos: limparRemovidos(daPlanilha.removidos) });
  else {
    const c = lerCarimbos();
    gravarJson(CHAVE_CARIMBOS, carimbar(antes, novo, c.carimbos, c.removidos));
  }
  window.dispatchEvent(new Event(EVENTO));
  if (!daPlanilha) agendarSincronizacao();
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
  iniciarSincronizacao();
  return () => {
    window.removeEventListener(EVENTO, aviso);
    window.removeEventListener('storage', deOutraAba);
  };
}

export const useDocPref = () => useSyncExternalStore(assinar, ler, () => VAZIO);

export const chaveConferencia = (prestadoraId: string, comp: string) => `${prestadoraId}|${comp}`;

/**
 * Grava a contratada. `herdarDe` é a chave que ela tinha antes do cadastro (a da pasta lida no Drive, "drive:<pasta>"):
 * as conferências e os ajustes já feitos nessa chave passam para o cadastro novo, para o fiscal não perder as marcações.
 */
export function salvarPrestadora(p: Omit<Prestadora, 'id'> & { id?: string }, herdarDe = '') {
  const d = ler();
  const id = p.id || `p${Date.now().toString(36)}`;
  const nova = { ...p, id, dia: Math.min(31, Math.max(0, Number(p.dia) || 0)) } as Prestadora;
  const existe = d.prestadoras.some((x) => x.id === id);
  let { conferencias, ajustes } = d;
  if (herdarDe && herdarDe !== id) {
    conferencias = Object.fromEntries(
      Object.entries(conferencias).map(([k, v]) => [k.startsWith(`${herdarDe}|`) ? `${id}|${k.slice(herdarDe.length + 1)}` : k, v]),
    );
    if (ajustes[herdarDe]) {
      const { [herdarDe]: antigo, ...resto } = ajustes;
      ajustes = { ...resto, [id]: antigo };
    }
  }
  gravar({ ...d, conferencias, ajustes, prestadoras: existe ? d.prestadoras.map((x) => (x.id === id ? nova : x)) : [...d.prestadoras, nova] });
  return id;
}

export function removerPrestadora(id: string) {
  const d = ler();
  gravar({
    ...d,
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

export function salvarConfig(mudar: Partial<ConfigDocPref>) {
  const d = ler();
  gravar({ ...d, config: { ...d.config, ...mudar } });
}

/** Marca (ou desmarca) uma exigência como "não se aplica" a esta prestadora em todos os meses */
export function naoAplicaSempre(chave: string, itemId: string, sim: boolean) {
  const d = ler();
  const atual = new Set(d.ajustes[chave]?.naoAplica || []);
  if (sim) atual.add(itemId);
  else atual.delete(itemId);
  gravar({ ...d, ajustes: { ...d.ajustes, [chave]: { naoAplica: [...atual] } } });
}

export const exportarDocPref = () => JSON.stringify({ versao: 1, exportadoEm: new Date().toISOString(), ...ler() }, null, 1);

export function importarDocPref(texto: string) {
  const v = JSON.parse(texto);
  if (!Array.isArray(v?.prestadoras)) throw new Error('arquivo inválido');
  const d = ler();
  const prestadoras = [...d.prestadoras.filter((p) => !v.prestadoras.some((x: Prestadora) => x.id === p.id)), ...v.prestadoras];
  gravar({
    prestadoras,
    conferencias: { ...d.conferencias, ...(v.conferencias || {}) },
    config: { ...d.config, ...(v.config || {}) },
    ajustes: { ...d.ajustes, ...(v.ajustes || {}) },
  });
  return v.prestadoras.length as number;
}

// ---------------------------------------------------------------- planilha do órgão (todos os fiscais veem o mesmo)

export interface PlanilhaDocPref {
  url: string;
  senha: string;
  nome: string;
}
export interface SincDocPref {
  estado: 'desligada' | 'sincronizando' | 'ok' | 'erro';
  em?: string;
  erro?: string;
}

export const planilhaDocPref = (): PlanilhaDocPref | null => {
  const e = lerJson<PlanilhaDocPref | null>(CHAVE_PLANILHA, null);
  const url = e?.url || DOCPREF_URL;
  return e?.senha && url ? { ...e, url } : null;
};

let sinc: SincDocPref = { estado: 'desligada' };
const ouvintes = new Set<() => void>();
function mudarSinc(x: SincDocPref) {
  sinc = x;
  ouvintes.forEach((f) => f());
}
export function useSincDocPref(): SincDocPref {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => sinc,
    () => sinc,
  );
}

type RegistroPlanilha = { id: string; tipo: string; dados: any; atualizadoEm: string; removido?: boolean; por?: string; resumo?: string };

/** Nome legível de cada contratada (para a coluna "Resumo" da planilha) */
function nomes(d: DadosDocPref) {
  const out: Record<string, string> = {};
  for (const p of d.prestadoras) out[p.id] = p.razao;
  for (const k of [...Object.keys(d.conferencias).map((x) => x.split('|')[0]), ...Object.keys(d.ajustes)])
    if (!out[k] && k.startsWith('drive:')) out[k] = `pasta ${k.slice(6)}`;
  return out;
}

/** Chamada ao App da Web: grava os registros (pode ser nenhum) e devolve todos os da planilha */
async function chamar(e: PlanilhaDocPref, registros: RegistroPlanilha[]): Promise<Record<string, RegistroPlanilha>> {
  // corpo em texto puro: o navegador não precisa pedir licença antes (o Apps Script não responde a essa pergunta)
  const r = await fetch(e.url, { method: 'POST', body: JSON.stringify({ senha: e.senha, registros }), redirect: 'follow' });
  let j: any;
  try {
    j = await r.json();
  } catch {
    throw new Error('A planilha do órgão não respondeu como esperado. Confira o endereço do App da Web.');
  }
  if (!j?.ok) throw new Error(j?.erro === 'senha' ? 'Senha da planilha errada.' : 'A planilha do órgão recusou o pedido.');
  return j.registros || {};
}

let rodando: Promise<void> | null = null;
let deNovo = false;
/** Sincroniza agora com a planilha do órgão (se estiver conectada) */
export function sincronizarDocPref(): Promise<void> {
  if (rodando) {
    deNovo = true;
    return rodando;
  }
  const e = planilhaDocPref();
  if (!e) {
    mudarSinc({ estado: 'desligada' });
    return Promise.resolve();
  }
  rodando = (async () => {
    mudarSinc({ ...sinc, estado: 'sincronizando' });
    try {
      let servidor = await chamar(e, []);
      const c = lerCarimbos();
      let m = mesclarDocPref({ dados: ler(), ...c }, servidor, CONFIG_PADRAO);
      if (m.enviar.length) {
        const ns = nomes(m.dados);
        const regs = m.enviar.map((r) => ({ ...r, por: e.nome, resumo: resumoRegistro(r.id, r.dados, ns) }));
        servidor = await chamar(e, regs);
        m = mesclarDocPref({ dados: m.dados, carimbos: m.carimbos, removidos: m.removidos }, servidor, CONFIG_PADRAO);
      }
      gravar(m.dados, { carimbos: m.carimbos, removidos: m.removidos });
      mudarSinc({ estado: 'ok', em: new Date().toISOString() });
    } catch (err) {
      mudarSinc({ estado: 'erro', em: sinc.em, erro: (err as Error).message || 'Sem conexão com a planilha do órgão.' });
    }
  })().finally(() => {
    rodando = null;
    if (deNovo) {
      deNovo = false;
      sincronizarDocPref();
    }
  });
  return rodando;
}

let espera: ReturnType<typeof setTimeout> | null = null;
function agendarSincronizacao() {
  if (!planilhaDocPref()) return;
  if (espera) clearTimeout(espera);
  espera = setTimeout(() => sincronizarDocPref(), 800);
}

let iniciada = false;
function iniciarSincronizacao() {
  if (iniciada || typeof window === 'undefined') return;
  iniciada = true;
  if (!planilhaDocPref()) return;
  sincronizarDocPref();
  const talvez = () => {
    if (document.visibilityState === 'visible' && Date.now() - Date.parse(sinc.em || '0') > 20_000) sincronizarDocPref();
  };
  window.addEventListener('focus', talvez);
  document.addEventListener('visibilitychange', talvez);
  setInterval(talvez, 60_000);
}

/** Liga este navegador à planilha do órgão (testa a senha antes) e envia o que já estava marcado aqui */
export async function conectarPlanilha(dados: PlanilhaDocPref): Promise<void> {
  const e = { url: (dados.url || DOCPREF_URL).trim(), senha: dados.senha, nome: dados.nome.trim() };
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(e.url))
    throw new Error('O endereço precisa ser o do App da Web do Apps Script (https://script.google.com/macros/s/…/exec).');
  await chamar(e, []);
  gravarJson(CHAVE_PLANILHA, { ...e, url: e.url === DOCPREF_URL ? '' : e.url });
  // o que este navegador já tinha e nunca foi carimbado entra com data antiga: perde para o que já está na planilha
  const c = lerCarimbos();
  const carimbos = { ...c.carimbos };
  for (const id of Object.keys(paraRegistros(ler()))) carimbos[id] ||= ANTIGO;
  gravarJson(CHAVE_CARIMBOS, { ...c, carimbos });
  iniciada = false;
  iniciarSincronizacao();
  await sincronizarDocPref();
}

/** Desliga este navegador da planilha (os dados daqui continuam) */
export function desconectarPlanilha() {
  try {
    localStorage.removeItem(CHAVE_PLANILHA);
  } catch {
    /* sem armazenamento */
  }
  mudarSinc({ estado: 'desligada' });
}
