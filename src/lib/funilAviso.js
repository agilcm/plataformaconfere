// Lembrete da prospecção no Telegram (dias úteis de manhã): as empresas do funil que estão para retornar hoje ou com o
// retorno atrasado, e as mais quentes da lista Possíveis clientes que ainda não receberam contato. Lê os registros
// "funil:<CNPJ>" da planilha da equipe (Meus editais). Puro: sem rede, para testar.
import { notaOportunidade } from './diagnostico.js';

// as mesmas etapas de src/lib/meusEditais.ts (aqui sem React, para rodar no GitHub)
const ETAPAS = { contato: 'Mensagem enviada', respondeu: 'Respondeu', diagnostico: 'Diagnóstico enviado', reuniao: 'Reunião marcada' };
const PREFIXO = 'funil:';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
const dataBR = (iso) =>
  String(iso || '')
    .slice(0, 10)
    .split('-')
    .reverse()
    .join('/');
const dias = (de, ate) => Math.round((Date.parse(ate) - Date.parse(de)) / 86400e3);

/**
 * @param {Record<string, any>} registros  a lista da planilha da equipe ({ id: registro }, com `removido`)
 * @param {string} hoje  AAAA-MM-DD (Brasília)
 * @returns {{ hoje: any[], atrasados: any[], noFunil: Set<string> }}
 */
export function retornosDoFunil(registros, hoje) {
  const out = { hoje: [], atrasados: [], noFunil: new Set() };
  for (const [id, r] of Object.entries(registros || {})) {
    if (!id.startsWith(PREFIXO) || r?.removido) continue;
    out.noFunil.add(id.slice(PREFIXO.length));
    const quando = String(r.edital?.propostasAte || '').slice(0, 10);
    if (!ETAPAS[r.etapa] || !quando || quando > hoje) continue;
    const item = {
      cnpj: id.slice(PREFIXO.length),
      razao: r.edital?.titulo || id.slice(PREFIXO.length),
      cidade: r.edital?.municipio || '',
      etapa: ETAPAS[r.etapa],
      nota: String(r.nota || '').trim(),
      por: String(r.por || '').trim(),
      quando,
      atraso: dias(quando, hoje),
    };
    (quando === hoje ? out.hoje : out.atrasados).push(item);
  }
  out.atrasados.sort((a, b) => a.quando.localeCompare(b.quando));
  out.hoje.sort((a, b) => a.razao.localeCompare(b.razao, 'pt-BR'));
  return out;
}

/**
 * As empresas mais quentes da lista que ainda não estão no funil (sugestão de quem ligar hoje).
 * @param {{ empresas: any[], licitacoes: any[] } | null} clientes  prospeccao/clientes.json do site
 * @param {Set<string>} noFunil
 */
export function quentesSemContato(clientes, noFunil, hoje, max = 3) {
  if (!clientes?.empresas) return [];
  return clientes.empresas
    .filter((e) => !noFunil.has(e.cnpj))
    .map((e) => ({ e, n: notaOportunidade(e, clientes.licitacoes, hoje) }))
    .filter((x) => x.n.faixa === 'quente')
    .sort((a, b) => b.n.nota - a.n.nota)
    .slice(0, max)
    .map(({ e, n }) => ({ cnpj: e.cnpj, razao: e.razao, cidade: e.cidade, nota: n.nota, motivos: n.motivos }));
}

const linha = (x) =>
  `• <b>${esc(x.razao)}</b>${x.cidade ? ` (${esc(x.cidade)})` : ''} · ${esc(x.etapa)}` +
  (x.atraso > 0 ? ` · era para ${dataBR(x.quando)} (${x.atraso} ${x.atraso === 1 ? 'dia' : 'dias'} de atraso)` : '') +
  (x.nota ? `\n  ${esc(x.nota)}` : '') +
  (x.por ? ` · ${esc(x.por)}` : '');

/**
 * Mensagem do Telegram (HTML). Sem retorno nem sugestão, devolve ''.
 * @param {ReturnType<typeof retornosDoFunil>} r
 * @param {ReturnType<typeof quentesSemContato>} quentes
 * @param {{ hoje: string, site?: string }} o
 */
export function mensagemRetornos(r, quentes, o) {
  if (!r.hoje.length && !r.atrasados.length && !quentes.length) return '';
  const site = o.site || 'https://www.agilcm.com.br/licitacoes/#possiveis-clientes';
  const L = [`📞 <b>Prospecção de hoje · ${dataBR(o.hoje)}</b>`];
  if (r.hoje.length) L.push('', `<b>Retornar hoje (${r.hoje.length})</b>`, ...r.hoje.map(linha));
  if (r.atrasados.length) L.push('', `<b>Retornos atrasados (${r.atrasados.length})</b>`, ...r.atrasados.map(linha));
  if (quentes.length)
    L.push(
      '',
      `<b>Quentes ainda sem contato</b>`,
      ...quentes.map((x) => `• <b>${esc(x.razao)}</b> (${esc(x.cidade)}) · nota ${x.nota}\n  ${esc(x.motivos.slice(0, 2).join('; '))}`),
    );
  L.push('', `Abrir em <a href="${site}">Possíveis clientes</a> (filtro Prospecção → Retornar hoje).`);
  return L.join('\n');
}
