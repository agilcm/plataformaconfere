// Utilidades compartilhadas pelas funções de /api (arquivos com "_" não viram rota na Vercel).

const store = new Map(); // key -> { at, value }

/**
 * Cache em memória com "dados de reserva": se o PNCP falhar, devolve a última resposta boa
 * (marcada como desatualizada) em vez de erro.
 */
export async function cached(key, ttlMs, fn) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return { value: hit.value, at: hit.at, stale: false };
  try {
    const value = await fn();
    store.set(key, { at: Date.now(), value });
    if (store.size > 300) store.delete(store.keys().next().value);
    return { value, at: Date.now(), stale: false };
  } catch (e) {
    if (hit) return { value: hit.value, at: hit.at, stale: true };
    throw e;
  }
}

export function params(req) {
  return new URL(req.url || '/', 'http://localhost').searchParams;
}

export function send(res, status, body, cacheSeconds = 0) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (cacheSeconds) res.setHeader('Cache-Control', `public, s-maxage=${cacheSeconds}, stale-while-revalidate=86400`);
  else res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function sendError(res, e) {
  const status = e?.status === 404 ? 404 : 503;
  send(res, status, {
    erro: status === 404 ? 'Não encontrado no PNCP.' : 'O PNCP está instável no momento. Tente novamente em alguns minutos.',
    detalhe: String(e?.message || e),
    tentarNovamente: status !== 404,
  });
}
