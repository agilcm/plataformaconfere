// Meus editais: os editais marcados com a estrela, com a etapa (funil), anotações e prazos.
// Ficam neste navegador (localStorage) e, com a planilha da equipe conectada, iguais para todos.
import { useSyncExternalStore } from 'react';
import { MEUS_EDITAIS_URL } from '../data/privadoConfig.ts';

export const ETAPAS = [
  { id: 'interesse', nome: 'Interesse', cor: 'bg-slate-100 text-slate-700' },
  { id: 'analisando', nome: 'Analisando o edital', cor: 'bg-sky-100 text-sky-800' },
  { id: 'participar', nome: 'Vamos participar', cor: 'bg-amber-100 text-amber-900' },
  { id: 'enviada', nome: 'Proposta enviada', cor: 'bg-indigo-100 text-indigo-800' },
  { id: 'ganhamos', nome: 'Ganhamos', cor: 'bg-emerald-100 text-emerald-800' },
  { id: 'perdemos', nome: 'Não ganhamos', cor: 'bg-red-100 text-red-800' },
  { id: 'desistimos', nome: 'Desistimos', cor: 'bg-slate-200 text-slate-600' },
] as const;
export type Etapa = (typeof ETAPAS)[number]['id'];

export interface MeuEdital {
  edital: {
    id: string;
    titulo: string;
    objeto: string;
    orgao: string;
    municipio: string;
    uf?: string;
    modalidade: string;
    valor: number | null;
    propostasAte: string | null;
    link: string;
    linkOrigem?: string | null;
    local?: string;
    linkLocal?: string | null;
  };
  etapa: Etapa;
  nota: string;
  por?: string; // quem salvou (nome digitado ao conectar à planilha da equipe)
  salvoEm: string;
  atualizadoEm: string;
}

const CHAVE = 'agilcm:meus-editais';
const CHAVE_REMOVIDOS = 'agilcm:meus-editais:removidos';
const CHAVE_EQUIPE = 'agilcm:meus-editais:equipe';
const EVENTO = 'agilcm:meus-editais';
let cache: Record<string, MeuEdital> | null = null;

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

function ler(): Record<string, MeuEdital> {
  cache ??= lerJson<Record<string, MeuEdital>>(CHAVE, {});
  return cache;
}
// editais tirados da lista: guardados com a data, para a remoção chegar à planilha da equipe também
const lerRemovidos = () => lerJson<Record<string, MeuEdital>>(CHAVE_REMOVIDOS, {});

function gravar(novo: Record<string, MeuEdital>, removidos?: Record<string, MeuEdital>, enviar = true) {
  cache = novo;
  gravarJson(CHAVE, novo);
  if (removidos) {
    // remoções com mais de 90 dias já chegaram a todo mundo
    const limite = new Date(Date.now() - 90 * 86400e3).toISOString();
    gravarJson(CHAVE_REMOVIDOS, Object.fromEntries(Object.entries(removidos).filter(([, m]) => (m.atualizadoEm || '') > limite)));
  }
  window.dispatchEvent(new Event(EVENTO));
  if (enviar) agendarSincronizacao();
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

const VAZIO: Record<string, MeuEdital> = {};
/** Os editais salvos (atualiza a tela quando mudam, inclusive em outra aba do navegador) */
export function useMeusEditais(): Record<string, MeuEdital> {
  return useSyncExternalStore(assinar, ler, () => VAZIO);
}

/** Guarda só o que a lista precisa mostrar (o edital completo do PNCP é grande) */
function resumir(e: any): MeuEdital['edital'] {
  return {
    id: e.id,
    titulo: e.titulo,
    objeto: e.objeto,
    orgao: e.orgao,
    municipio: e.municipio,
    uf: e.uf,
    modalidade: e.modalidade,
    valor: e.valor ?? null,
    propostasAte: e.propostasAte ?? null,
    link: e.link,
    linkOrigem: e.linkOrigem ?? null,
    local: e.local,
    linkLocal: e.linkLocal ?? null,
  };
}

/** Estrela: salva o edital (etapa "Interesse") ou tira da lista */
export function alternarMeuEdital(e: any) {
  if (ler()[e.id]) return removerMeuEdital(e.id);
  const atual = { ...ler() };
  const removidos = lerRemovidos();
  delete removidos[e.id];
  const agora = new Date().toISOString();
  atual[e.id] = { edital: resumir(e), etapa: 'interesse', nota: '', por: equipe()?.nome || '', salvoEm: agora, atualizadoEm: agora };
  gravar(atual, removidos);
}

export function atualizarMeuEdital(id: string, p: Partial<Pick<MeuEdital, 'etapa' | 'nota'>>) {
  const atual = ler();
  if (!atual[id]) return;
  gravar({ ...atual, [id]: { ...atual[id], ...p, atualizadoEm: new Date().toISOString() } });
}

export function removerMeuEdital(id: string) {
  const atual = { ...ler() };
  const m = atual[id];
  if (!m) return;
  delete atual[id];
  gravar(atual, { ...lerRemovidos(), [id]: { ...m, atualizadoEm: new Date().toISOString() } });
}

/** Cópia de segurança (JSON) */
export function exportarMeusEditais(): string {
  return JSON.stringify({ versao: 1, exportadoEm: new Date().toISOString(), editais: ler() }, null, 1);
}

/** Junta uma cópia de segurança à lista (o que já existe aqui e foi mexido por último fica) */
export function importarMeusEditais(texto: string): number {
  const v = JSON.parse(texto);
  const vindos: Record<string, MeuEdital> = v?.editais && typeof v.editais === 'object' ? v.editais : {};
  const atual = { ...ler() };
  let n = 0;
  for (const [id, m] of Object.entries(vindos)) {
    if (!m?.edital?.id || !ETAPAS.some((e) => e.id === m.etapa)) continue;
    if (!atual[id] || (m.atualizadoEm || '') > (atual[id].atualizadoEm || '')) {
      atual[id] = m;
      n++;
    }
  }
  gravar(atual);
  return n;
}

// ---------------------------------------------------------------- equipe: a mesma lista para todos (planilha Google)
// A planilha "AGIL CM - Meus editais (equipe)" tem um App da Web (scripts/apps-script/meus-editais.gs)
// que lê e grava os editais com a senha da equipe. Cada navegador guarda uma cópia e sincroniza:
// ao abrir a página, a cada minuto, ao voltar para a janela e logo depois de cada mudança.

export interface Equipe {
  url: string;
  senha: string;
  nome: string;
}
export interface Sincronizacao {
  estado: 'desligada' | 'sincronizando' | 'ok' | 'erro';
  em?: string;
  erro?: string;
}

export const equipe = (): Equipe | null => {
  const e = lerJson<Equipe | null>(CHAVE_EQUIPE, null);
  const url = e?.url || MEUS_EDITAIS_URL;
  return e?.senha && url ? { ...e, url } : null;
};

let sinc: Sincronizacao = { estado: 'desligada' };
const ouvintesSinc = new Set<() => void>();
function mudarSinc(s: Sincronizacao) {
  sinc = s;
  ouvintesSinc.forEach((f) => f());
}
export function useSincronizacao(): Sincronizacao {
  return useSyncExternalStore(
    (f) => {
      ouvintesSinc.add(f);
      return () => ouvintesSinc.delete(f);
    },
    () => sinc,
    () => sinc,
  );
}

type Registro = MeuEdital & { id: string; removido?: boolean };

/** Chamada ao App da Web da planilha: grava os registros (pode ser nenhum) e devolve a lista da equipe */
async function chamar(e: Equipe, registros: Registro[]): Promise<Record<string, MeuEdital & { removido?: boolean }>> {
  // corpo em texto puro: o navegador não precisa pedir licença antes (o Apps Script não responde a essa pergunta)
  const r = await fetch(e.url, { method: 'POST', body: JSON.stringify({ senha: e.senha, registros }), redirect: 'follow' });
  let j: any;
  try {
    j = await r.json();
  } catch {
    throw new Error('A planilha da equipe não respondeu como esperado. Confira o endereço do App da Web.');
  }
  if (!j?.ok) throw new Error(j?.erro === 'senha' ? 'Senha da equipe errada.' : 'A planilha da equipe recusou o pedido.');
  return j.editais || {};
}

/** Junta a lista da equipe com a deste navegador (vale a mudança mais recente) e devolve o que falta enviar */
export function mesclar(
  locais: Record<string, MeuEdital>,
  removidos: Record<string, MeuEdital>,
  servidor: Record<string, MeuEdital & { removido?: boolean }>,
): { locais: Record<string, MeuEdital>; removidos: Record<string, MeuEdital>; enviar: Registro[] } {
  const L = { ...locais };
  const R = { ...removidos };
  const enviar: Registro[] = [];
  for (const id of new Set([...Object.keys(servidor), ...Object.keys(L), ...Object.keys(R)])) {
    const s = servidor[id];
    const meu = L[id] ?? R[id];
    const tMeu = meu?.atualizadoEm || '';
    const tS = s?.atualizadoEm || '';
    if (meu && (!s || tMeu > tS)) enviar.push({ ...meu, id, removido: !L[id] });
    else if (s && (!meu || tS > tMeu)) {
      const { removido, ...m } = s;
      if (removido) {
        delete L[id];
        R[id] = m;
      } else {
        L[id] = m;
        delete R[id];
      }
    }
  }
  return { locais: L, removidos: R, enviar };
}

let rodando: Promise<void> | null = null;
let deNovo = false;
/** Sincroniza agora com a planilha da equipe (se estiver conectada) */
export function sincronizar(): Promise<void> {
  if (rodando) {
    deNovo = true;
    return rodando;
  }
  const e = equipe();
  if (!e) {
    mudarSinc({ estado: 'desligada' });
    return Promise.resolve();
  }
  rodando = (async () => {
    mudarSinc({ ...sinc, estado: 'sincronizando' });
    try {
      let servidor = await chamar(e, []);
      let m = mesclar(ler(), lerRemovidos(), servidor);
      if (m.enviar.length) {
        servidor = await chamar(e, m.enviar);
        m = mesclar(m.locais, m.removidos, servidor);
      }
      gravar(m.locais, m.removidos, false);
      mudarSinc({ estado: 'ok', em: new Date().toISOString() });
    } catch (err) {
      mudarSinc({ estado: 'erro', em: sinc.em, erro: (err as Error).message || 'Sem conexão com a planilha da equipe.' });
    }
  })().finally(() => {
    rodando = null;
    if (deNovo) {
      deNovo = false;
      sincronizar();
    }
  });
  return rodando;
}

let espera: ReturnType<typeof setTimeout> | null = null;
function agendarSincronizacao() {
  if (!equipe()) return;
  if (espera) clearTimeout(espera);
  espera = setTimeout(() => sincronizar(), 800);
}

let iniciada = false;
function iniciarSincronizacao() {
  if (iniciada || typeof window === 'undefined') return;
  iniciada = true;
  if (!equipe()) return;
  sincronizar();
  const talvez = () => {
    if (document.visibilityState === 'visible' && Date.now() - Date.parse(sinc.em || '0') > 20_000) sincronizar();
  };
  window.addEventListener('focus', talvez);
  document.addEventListener('visibilitychange', talvez);
  setInterval(talvez, 60_000);
}

/** Liga este navegador à planilha da equipe (testa a senha antes) e envia o que já estava salvo aqui */
export async function conectarEquipe(dados: Equipe): Promise<void> {
  const e = { url: (dados.url || MEUS_EDITAIS_URL).trim(), senha: dados.senha, nome: dados.nome.trim() };
  if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(e.url))
    throw new Error('O endereço precisa ser o do App da Web do Apps Script (https://script.google.com/macros/s/…/exec).');
  await chamar(e, []);
  gravarJson(CHAVE_EQUIPE, { ...e, url: e.url === MEUS_EDITAIS_URL ? '' : e.url });
  // o que este navegador já tinha ganha o nome de quem salvou
  const atual = ler();
  if (e.nome) gravar(Object.fromEntries(Object.entries(atual).map(([id, m]) => [id, m.por ? m : { ...m, por: e.nome }])), undefined, false);
  iniciada = false;
  iniciarSincronizacao();
  await sincronizar();
}

/** Desliga este navegador da planilha (a lista daqui continua) */
export function desconectarEquipe() {
  try {
    localStorage.removeItem(CHAVE_EQUIPE);
  } catch {
    /* sem armazenamento */
  }
  mudarSinc({ estado: 'desligada' });
}

// ---------------------------------------------------------------- agenda (.ics, abre no Google Agenda / Outlook / celular)

const doisDig = (n: number) => String(n).padStart(2, '0');
/** "2026-11-24T08:59" (Brasília) → "20261124T115900Z" */
function utc(s: string) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] || '09'}:${m[5] || '00'}:00-03:00`);
  return `${d.getUTCFullYear()}${doisDig(d.getUTCMonth() + 1)}${doisDig(d.getUTCDate())}T${doisDig(d.getUTCHours())}${doisDig(d.getUTCMinutes())}00Z`;
}
const esc = (s: string) =>
  String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/[,;]/g, (c) => `\\${c}`);
// linhas do .ics têm no máximo 75 caracteres
const dobrar = (linha: string) => linha.replace(/(.{73})(?=.)/g, '$1\r\n ');

/** Arquivo de calendário com o fim do prazo de cada edital (e um lembrete no dia anterior) */
export function agendaIcs(lista: MeuEdital[]): string {
  const agora = utc(new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 16)) || '';
  const eventos = lista
    .filter((m) => m.edital.propostasAte && utc(m.edital.propostasAte))
    .map((m) => {
      const e = m.edital;
      const fim = utc(e.propostasAte!)!;
      const descricao = `${e.objeto}\n\nÓrgão: ${e.orgao} (${e.municipio}/${e.uf || 'MG'})\nModalidade: ${e.modalidade}\nLocal do pregão: ${e.local || '-'}\n${e.link}${m.nota ? `\n\nAnotações: ${m.nota}` : ''}`;
      return [
        'BEGIN:VEVENT',
        `UID:${e.id.replace(/[^\w-]/g, '')}@agilcm.com.br`,
        `DTSTAMP:${agora}`,
        `DTSTART:${fim}`,
        `DTEND:${fim}`,
        dobrar(`SUMMARY:${esc(`Prazo do edital: ${e.municipio} - ${e.titulo}`)}`),
        dobrar(`DESCRIPTION:${esc(descricao)}`),
        dobrar(`URL:${e.link}`),
        'BEGIN:VALARM',
        'TRIGGER:-P1D',
        'ACTION:DISPLAY',
        'DESCRIPTION:Prazo do edital amanhã',
        'END:VALARM',
        'END:VEVENT',
      ].join('\r\n');
    });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Agil CM//Meus editais//PT', 'CALSCALE:GREGORIAN', ...eventos, 'END:VCALENDAR'].join('\r\n');
}

export function baixarTexto(nome: string, texto: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
