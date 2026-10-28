// Catálogo de CNAEs para o filtro de "Editais abertos": os 19 CNAEs da Ágil CM (com termos próprios)
// e os grupos de CNAE de sugestoes.js (prefixos de classe/subclasse e termos do objeto do edital).
import { AGIL_CNAES } from '../data/agilCnaes.js';
import { CNAE_RULES, norm } from './sugestoes.js';

/** "8121" -> "81.21"; "4649408" -> "4649-4/08" */
export const formatarCnae = (p) => (p.length >= 7 ? `${p.slice(0, 4)}-${p.slice(4, 5)}/${p.slice(5, 7)}` : `${p.slice(0, 2)}.${p.slice(2)}`);
const digitos = (s) => String(s || '').replace(/\D/g, '');

/** @typedef {{ id: string, codigos: string[], rotulo: string, descricao: string, termos: string[], agil?: boolean }} ItemCatalogo */

/** @type {ItemCatalogo[]} */
export const CATALOGO_CNAE = [
  ...AGIL_CNAES.map((c) => ({ id: c.codigo, codigos: [digitos(c.codigo)], rotulo: c.codigo, descricao: c.descricao, termos: c.termos.map(norm), agil: true })),
  ...CNAE_RULES.filter((r) => r.kw.length || r.fraco?.length).map((r) => ({
    id: `grupo:${norm(r.area).replace(/ /g, '-')}`,
    codigos: r.p,
    rotulo: r.p.map(formatarCnae).join(', '),
    descricao: r.area,
    termos: (r.kw.length ? r.kw : r.fraco).map(norm),
  })),
];
export const CATALOGO_POR_ID = new Map(CATALOGO_CNAE.map((c) => [c.id, c]));

/**
 * Busca no catálogo por código (qualquer parte, com ou sem pontuação) ou pela descrição.
 * Um código completo (ex.: 4751-2/01) também encontra o grupo pelo prefixo da classe.
 */
export function buscarCnae(texto, limite = 30) {
  const d = digitos(texto);
  const t = norm(texto);
  if (!t) return CATALOGO_CNAE.slice(0, limite);
  const out = CATALOGO_CNAE.filter((c) => {
    if (d.length >= 2 && c.codigos.some((p) => p.startsWith(d) || (d.length >= 4 && d.startsWith(p)))) return true;
    return !d && norm(c.descricao).includes(t);
  });
  return out.slice(0, limite);
}

/** Regras ({ codigo, termos }) para filtrarPorRegras a partir dos ids escolhidos */
export const regrasDoCatalogo = (ids) =>
  (Array.isArray(ids) ? ids : String(ids || '').split('|').filter(Boolean)).map((id) => CATALOGO_POR_ID.get(id)).filter(Boolean).map((c) => ({ codigo: c.id, termos: c.termos }));
