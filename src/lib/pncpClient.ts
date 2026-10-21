// Funções do navegador para falar com o PNCP.
// Ordem de tentativa: 1) nossas funções /api (servidor), 2) PNCP direto, 3) última resposta salva no
// aparelho do visitante, 4) amostra embutida (só na visualização de demonstração).

export type Fonte = 'servidor' | 'direto' | 'salvo' | 'amostra';

export async function callApi<T>(path: string, params: Record<string, string>): Promise<T | null> {
  if (import.meta.env.VITE_STATIC_HOST === 'true') return null;
  try {
    const res = await fetch(`/api/${path}?${new URLSearchParams(params)}`, { headers: { Accept: 'application/json' } });
    const isJson = (res.headers.get('content-type') || '').includes('json');
    if (res.ok && isJson) return (await res.json()) as T;
    // 503 da nossa função = PNCP fora do ar; 404 = função não existe nesta hospedagem
    return null;
  } catch {
    return null;
  }
}

const PREFIX = 'agilcm:pncp:';

export function saveLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    /* armazenamento indisponível: segue sem cache */
  }
}

export function loadLocal<T>(key: string, maxAgeMs = 3 * 24 * 3600e3): { at: number; value: T } | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.at > maxAgeMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const formatHora = (iso?: string | number) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};
