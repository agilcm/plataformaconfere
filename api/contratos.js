// GET /api/contratos?q=notebook&regiao=mg|zona-da-mata&micro=Ubá&municipios=1&pagina=1
// Quem comprou o produto, qual modelo/descrição foi pedido, quantidade, valor e fornecedor vencedor.
import { searchContratosProduto } from '../src/lib/pncp.js';
import { cached, params, send, sendError } from './_util.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const p = params(req);
  const q = (p.get('q') || '').trim().slice(0, 80);
  if (q.length < 2) return send(res, 400, { erro: 'Informe o produto que deseja pesquisar.' });
  const regiao = p.get('regiao') === 'zona-da-mata' ? 'zona-da-mata' : 'mg';
  const micro = p.get('micro') || '';
  const soMunicipios = p.get('municipios') !== '0';
  const pagina = Math.max(1, Number(p.get('pagina')) || 1);
  try {
    const key = `contratos:${q.toLowerCase()}:${regiao}:${micro}:${soMunicipios}:${pagina}`;
    const r = await cached(key, 30 * 60e3, () => searchContratosProduto({ q, regiao, micro, soMunicipios, pagina, alvo: 20, maxPaginas: 8, meses: 6 }));
    return send(res, 200, { ...r.value, atualizadoEm: new Date(r.at).toISOString(), desatualizado: r.stale }, 1800);
  } catch (e) {
    return sendError(res, e);
  }
}
