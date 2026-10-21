// GET /api/editais?regiao=mg|zona-da-mata&micro=Ubá&q=merenda&fontes=Licitanet|Compras.gov.br&pagina=1&tamanho=20
// GET /api/editais?facetas=1&regiao=...  -> quantos editais há em cada fonte (plataforma)
// Editais abertos (recebendo propostas) em MG, ordenados pela última atualização.
import { contarFontes, fetchAllMG, fetchPage, filterEditais, sortByUpdate } from '../src/lib/pncp.js';
import { cached, params, send, sendError } from './_util.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const p = params(req);
  const regiao = p.get('regiao') === 'zona-da-mata' ? 'zona-da-mata' : 'mg';
  const micro = p.get('micro') || '';
  const q = (p.get('q') || '').slice(0, 100);
  const pagina = Math.max(1, Number(p.get('pagina')) || 1);
  const tamanho = Math.min(50, Math.max(5, Number(p.get('tamanho')) || 20));
  const fontes = (p.get('fontes') || '').split('|').map((x) => x.trim()).filter(Boolean).slice(0, 40);

  try {
    if (p.get('facetas') === '1') {
      const all = await cached('editais:all-mg', 20 * 60e3, () => fetchAllMG({ concurrency: 8 }));
      const base = filterEditais(all.value.items, { regiao, micro, q });
      return send(res, 200, { fontes: contarFontes(base), total: base.length, atualizadoEm: new Date(all.at).toISOString(), desatualizado: all.stale }, 900);
    }
    // ?todos=1: lista completa (usada pelo botão "Sugestão", que cruza com os CNAEs no navegador)
    if (p.get('todos') === '1') {
      const all = await cached('editais:all-mg', 20 * 60e3, () => fetchAllMG({ concurrency: 8 }));
      const items = filterEditais(all.value.items, { regiao, micro, q, fontes });
      return send(
        res,
        200,
        { items, total: items.length, atualizadoEm: new Date(all.at).toISOString(), desatualizado: all.stale, incompleto: all.value.paginasComErro > 0 },
        900,
      );
    }
    if (regiao === 'mg' && !micro && !q && !fontes.length) {
      // Minas Gerais inteira: repassa a paginação do PNCP (rápido)
      const r = await cached(`editais:mg:${pagina}:${tamanho}`, 10 * 60e3, () => fetchPage({ pagina, tamanho }));
      return send(res, 200, { items: sortByUpdate(r.value.items), total: r.value.total, pagina, tamanho, atualizadoEm: new Date(r.at).toISOString(), desatualizado: r.stale }, 600);
    }
    // Zona da Mata ou busca por texto: varre todos os editais de MG (com cache) e filtra
    const all = await cached('editais:all-mg', 20 * 60e3, () => fetchAllMG({ concurrency: 8 }));
    const filtered = filterEditais(all.value.items, { regiao, micro, q, fontes });
    const start = (pagina - 1) * tamanho;
    return send(
      res,
      200,
      {
        items: filtered.slice(start, start + tamanho),
        total: filtered.length,
        pagina,
        tamanho,
        atualizadoEm: new Date(all.at).toISOString(),
        desatualizado: all.stale,
        incompleto: all.value.paginasComErro > 0,
      },
      900,
    );
  } catch (e) {
    return sendError(res, e);
  }
}
