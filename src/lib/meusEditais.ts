// Meus editais: os editais marcados com a estrela em Editais abertos, com a etapa (funil), anotações
// e prazos. Ficam guardados neste navegador (localStorage); dá para baixar e importar uma cópia.
import { useSyncExternalStore } from 'react';

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
  salvoEm: string;
  atualizadoEm: string;
}

const CHAVE = 'agilcm:meus-editais';
const EVENTO = 'agilcm:meus-editais';
let cache: Record<string, MeuEdital> | null = null;

function ler(): Record<string, MeuEdital> {
  if (cache) return cache;
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || '{}');
    cache = v && typeof v === 'object' ? v : {};
  } catch {
    cache = {};
  }
  return cache!;
}

function gravar(novo: Record<string, MeuEdital>) {
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
  const atual = { ...ler() };
  if (atual[e.id]) delete atual[e.id];
  else {
    const agora = new Date().toISOString();
    atual[e.id] = { edital: resumir(e), etapa: 'interesse', nota: '', salvoEm: agora, atualizadoEm: agora };
  }
  gravar(atual);
}

export function atualizarMeuEdital(id: string, p: Partial<Pick<MeuEdital, 'etapa' | 'nota'>>) {
  const atual = ler();
  if (!atual[id]) return;
  gravar({ ...atual, [id]: { ...atual[id], ...p, atualizadoEm: new Date().toISOString() } });
}

export function removerMeuEdital(id: string) {
  const atual = { ...ler() };
  delete atual[id];
  gravar(atual);
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
