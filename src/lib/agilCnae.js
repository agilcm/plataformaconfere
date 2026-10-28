// Filtro de editais por CNAE: termos de cada CNAE procurados no objeto do edital.
// Usado pela função /api/editais (cnae=agil ou cnae=lista) e, como plano B, direto no navegador.
import { AGIL_CNAES } from '../data/agilCnaes.js';
import { IGNORAR, hasTerm, norm } from './sugestoes.js';

const REGRAS = AGIL_CNAES.map((c) => ({ codigo: c.codigo, termos: c.termos.map(norm) }));

/**
 * Mantém só os editais cujo objeto tem algum termo das regras e anota quais regras (CNAEs) e termos casaram.
 * @param {any[]} list  editais no formato mapItem (pncp.js)
 * @param {{ codigo: string, termos: string[] }[]} regras  termos já normalizados
 */
export function filtrarPorRegras(list, regras) {
  const out = [];
  for (const e of list) {
    if (/leil/i.test(e.modalidade || '')) continue;
    const texto = norm(`${e.titulo} ${e.objeto}`);
    if (IGNORAR.some((t) => hasTerm(texto, t))) continue;
    const casou = [];
    const termos = new Set();
    for (const r of regras) {
      const achados = r.termos.filter((t) => hasTerm(texto, t));
      if (!achados.length) continue;
      casou.push(r.codigo);
      achados.forEach((t) => termos.add(t));
    }
    if (casou.length) out.push({ ...e, cnaes: casou, termos: [...termos] });
  }
  return out;
}

/**
 * Aba AGIL CNAE: só os editais ligados aos CNAEs da Ágil CM.
 * @param {any[]} list
 * @param {{ cnaes?: string | string[] }} options  códigos para restringir (vazio = todos os CNAEs da Ágil CM)
 */
export function filtrarPorCnaes(list, { cnaes = [] } = {}) {
  const sel = new Set(Array.isArray(cnaes) ? cnaes : String(cnaes || '').split('|').filter(Boolean));
  return filtrarPorRegras(list, sel.size ? REGRAS.filter((r) => sel.has(r.codigo)) : REGRAS);
}
