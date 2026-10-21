// GET /api/compra?cnpj=00348003000110&ano=2026&seq=1323
// Itens (descrição, quantidade, valores) e documentos (edital, termo de referência...) de uma compra.
import { fetchDetalheCompra } from '../src/lib/pncp.js';
import { cached, params, send, sendError } from './_util.js';

export default async function handler(req, res) {
  const p = params(req);
  const cnpj = (p.get('cnpj') || '').replace(/\D/g, '');
  const ano = (p.get('ano') || '').replace(/\D/g, '');
  const seq = (p.get('seq') || '').replace(/\D/g, '');
  if (cnpj.length !== 14 || ano.length !== 4 || !seq) return send(res, 400, { erro: 'Parâmetros inválidos.' });
  try {
    const r = await cached(`compra:${cnpj}/${ano}/${seq}`, 60 * 60e3, () => fetchDetalheCompra({ cnpj, ano, seq }));
    return send(res, 200, { ...r.value, desatualizado: r.stale }, 3600);
  } catch (e) {
    return sendError(res, e);
  }
}
