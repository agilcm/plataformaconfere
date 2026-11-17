// Aviso de oportunidade (Telegram): empresas das cidades escolhidas que acabaram de perder um item por pouco ou com o
// melhor preço, nas atas lidas pela Prospecção. Um aviso por empresa e licitação. Puro: sem rede, para testar.
import { ehDesconto, normCidade, textoColocacao } from './possiveisClientes.js';
import { distancia, ficouPerto } from './diagnostico.js';

/** Só licitações publicadas há até 60 dias: as atas antigas, lidas agora pela primeira vez, não viram aviso */
export const DIAS_OPORTUNIDADE = 60;

/**
 * @param {{ compras: Record<string, any>, cnpj: Record<string, any> }} cache
 * @param {{ nome: string, uf: string }[]} cidades
 * @param {{ hoje: string, avisados?: Record<string, string> }} o  avisados: chave "licitação|cnpj" → data do aviso
 */
export function oportunidades(cache, cidades, o) {
  const alvo = new Map(cidades.map((c) => [`${normCidade(c.nome)}|${c.uf}`, c.nome]));
  const limite = new Date(Date.parse(o.hoje) - DIAS_OPORTUNIDADE * 86400e3).toISOString().slice(0, 10);
  const grupos = new Map();
  for (const [id, c] of Object.entries(cache.compras || {})) {
    if (!c.itens?.length || String(c.data || '') < limite) continue;
    for (const it of c.itens) {
      if (it.v == null) continue; // sem vencedora identificada
      const desconto = ehDesconto(it);
      for (const [cnpj, col, melhor] of it.c) {
        const cad = cache.cnpj?.[cnpj];
        const cidade = cad && alvo.get(`${normCidade(cad.m)}|${cad.u}`);
        if (!cidade) continue;
        const d = { col, melhor, venc: it.v, desconto };
        if (!(col === 0 || (col >= 2 && col <= 5 && ficouPerto(d)))) continue;
        const chave = `${id}|${cnpj}`;
        if (o.avisados?.[chave]) continue;
        if (!grupos.has(chave))
          grupos.set(chave, {
            chave,
            cnpj,
            razao: cad.r,
            cidade,
            licitacao: { id, orgao: c.orgao, municipio: c.municipio, uf: c.uf, data: c.data },
            itens: [],
          });
        grupos.get(chave).itens.push({ item: it.n, desc: it.d, ...d, distancia: distancia(d) });
      }
    }
  }
  // primeiro quem perdeu com o melhor preço, depois os mais perto
  const peso = (g) => Math.min(...g.itens.map((i) => (i.col === 0 ? -1 : (i.distancia?.valor ?? 99))));
  return [...grupos.values()].sort((a, b) => peso(a) - peso(b) || b.itens.length - a.itens.length);
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const curto = (t, n = 60) => {
  const s = String(t || '').replace(/…$/, '');
  return s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, '')}…` : s;
};

function linhaItem(i) {
  const nome = `item ${Number(i.item) || i.item} (${esc(curto(i.desc))})`;
  if (i.col === 0) return `melhor preço e não levou no ${nome}`;
  const x = i.distancia;
  const quanto = !x ? 'perto da vencedora' : x.empate ? `${x.texto} da vencedora (perdeu no desempate)` : i.desconto ? x.texto : `${x.texto} da vencedora`;
  return `${textoColocacao(i.col)} no ${nome}, ${quanto}`;
}

/**
 * Mensagem do Telegram (HTML). Sem oportunidades, devolve ''.
 * @param {ReturnType<typeof oportunidades>} lista
 * @param {{ site?: string, max?: number }} [o]
 */
export function mensagemOportunidades(lista, o = {}) {
  if (!lista.length) return '';
  const site = o.site || 'https://www.agilcm.com.br/licitacoes/#possiveis-clientes';
  const max = o.max ?? 15;
  const L = [`🎯 <b>Possíveis clientes: ${lista.length} ${lista.length === 1 ? 'oportunidade nova' : 'oportunidades novas'}</b>`, ''];
  for (const g of lista.slice(0, max)) {
    const l = g.licitacao;
    L.push(`• <b>${esc(g.razao)}</b> (${esc(g.cidade)}) · ${esc(l.orgao)}, ${dataBR(l.data)}`);
    for (const i of g.itens.slice(0, 3)) L.push(`  ${linhaItem(i)}`);
    if (g.itens.length > 3) L.push(`  e mais ${g.itens.length - 3} ${g.itens.length - 3 === 1 ? 'item' : 'itens'}`);
    L.push(`  <a href="https://pncp.gov.br/app/editais/${l.id}">licitação no PNCP</a>`);
  }
  if (lista.length > max) L.push('', `E mais ${lista.length - max} na lista.`);
  L.push('', `Diagnóstico e mensagem prontos em <a href="${site}">Possíveis clientes</a>.`);
  return L.join('\n');
}
