// Filtros avançados de Editais abertos (como nas plataformas pagas de busca de licitações):
// modalidade, valor estimado, prazo das propostas, registro de preços, esfera, palavras a excluir,
// distância até uma cidade-base e ordenação. Funções puras: a tela passa a lista e as escolhas.
import { normalizeName } from '../data/zonaDaMata.js';

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// ---------------------------------------------------------------- modalidade

export const MODALIDADES = ['Pregão eletrônico', 'Dispensa', 'Concorrência', 'Inexigibilidade', 'Credenciamento', 'Pregão presencial', 'Leilão', 'Outras'];

/** "Pregão - Eletrônico" → "Pregão eletrônico"; "Dispensa de Licitação" → "Dispensa" */
export function grupoModalidade(m) {
  const t = norm(m);
  if (/pregao/.test(t)) return /presencial/.test(t) ? 'Pregão presencial' : 'Pregão eletrônico';
  if (/dispensa/.test(t)) return 'Dispensa';
  if (/concorrencia/.test(t)) return 'Concorrência';
  if (/inexigibilidade/.test(t)) return 'Inexigibilidade';
  if (/credenciamento/.test(t)) return 'Credenciamento';
  if (/leilao/.test(t)) return 'Leilão';
  return 'Outras';
}

// ---------------------------------------------------------------- valor e prazo

export const FAIXAS_VALOR = [
  { id: 'ate50', nome: 'Até R$ 50 mil', min: 0, max: 50_000 },
  { id: '50a200', nome: 'R$ 50 mil a 200 mil', min: 50_000, max: 200_000 },
  { id: '200a1m', nome: 'R$ 200 mil a 1 milhão', min: 200_000, max: 1_000_000 },
  { id: 'acima1m', nome: 'Acima de R$ 1 milhão', min: 1_000_000, max: Infinity },
];

export const PRAZOS = [
  { id: 'hoje', nome: 'Encerra hoje' },
  { id: '3', nome: 'Até 3 dias' },
  { id: '7', nome: 'Até 7 dias' },
  { id: '15', nome: 'Até 15 dias' },
  { id: 'mais7', nome: 'Mais de 7 dias (dá tempo de preparar)' },
];

export const ESFERAS = [
  { id: 'M', nome: 'Municipal' },
  { id: 'E', nome: 'Estadual' },
  { id: 'F', nome: 'Federal' },
];

export const ORDENS = [
  { id: 'recentes', nome: 'Mais recentes' },
  { id: 'prazo', nome: 'Prazo mais próximo' },
  { id: 'valor-desc', nome: 'Maior valor' },
  { id: 'valor-asc', nome: 'Menor valor' },
  { id: 'distancia', nome: 'Mais perto' },
];

export const RAIOS = [30, 50, 100, 150, 200];

// Datas do PNCP vêm no horário de Brasília, sem fuso
const quando = (s) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] || '23'}:${m[5] || '59'}:00-03:00`) : null;
};
const diaBR = (d) => new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 10);

/** Dias corridos até o fim das propostas (0 = hoje; negativo = já passou; null = sem data) */
export function diasPara(s, agora = new Date()) {
  const d = quando(s);
  if (!d) return null;
  return Math.round((Date.parse(diaBR(d)) - Date.parse(diaBR(agora))) / 86400e3);
}

// ---------------------------------------------------------------- distância

/** Distância em linha reta (km) entre dois pontos [lat, lon] */
export function distanciaKm(a, b) {
  if (!a || !b) return null;
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Código IBGE de um edital (campo do PNCP ou, sem ele, pelo nome da cidade em MG) */
export function ibgeDe(e, porNome) {
  if (e.ibge) return String(e.ibge);
  return porNome?.get(normalizeName(e.municipio)) || '';
}

// ---------------------------------------------------------------- filtros

/** Palavras a excluir, separadas por vírgula ("obra, engenharia, locação") */
export const termosExcluir = (s) =>
  String(s || '')
    .split(/[,;\n]/)
    .map((t) => norm(t).trim())
    .filter((t) => t.length >= 3);

/**
 * @param {any[]} lista  editais (formato mapItem)
 * @param {{ modalidades?: string[], valor?: string, prazo?: string, srp?: string, esfera?: string, excluir?: string,
 *           raio?: number, base?: string }} f
 * @param {{ coords?: Record<string, number[]>, porNome?: Map<string, string>, agora?: Date }} [ctx]
 */
export function filtrarAvancado(lista, f, ctx = {}) {
  const mods = new Set(f.modalidades || []);
  const faixa = FAIXAS_VALOR.find((x) => x.id === f.valor);
  const fora = termosExcluir(f.excluir);
  const centro = f.raio && f.base && ctx.coords ? ctx.coords[f.base] : null;
  return lista.filter((e) => {
    if (mods.size && !mods.has(grupoModalidade(e.modalidade))) return false;
    if (f.valor === 'sem' && e.valor) return false;
    if (faixa && !(e.valor && e.valor >= faixa.min && e.valor < faixa.max)) return false;
    if (f.prazo) {
      const d = diasPara(e.propostasAte, ctx.agora);
      if (d === null) return false;
      if (f.prazo === 'hoje' && d !== 0) return false;
      if (f.prazo === 'mais7' && d <= 7) return false;
      if (/^\d+$/.test(f.prazo) && (d < 0 || d > Number(f.prazo))) return false;
    }
    if (f.srp === 'sim' && !e.srp) return false;
    if (f.srp === 'nao' && e.srp) return false;
    if (f.esfera && e.esfera && e.esfera !== f.esfera) return false;
    if (fora.length) {
      const texto = norm(`${e.objeto} ${e.titulo}`);
      if (fora.some((t) => texto.includes(t))) return false;
    }
    if (centro) {
      const km = distanciaKm(centro, ctx.coords[ibgeDe(e, ctx.porNome)]);
      if (km === null || km > f.raio) return false;
    }
    return true;
  });
}

/** Ordena uma cópia da lista */
export function ordenarEditais(lista, ordem, ctx = {}) {
  const l = [...lista];
  const prazo = (e) => quando(e.propostasAte)?.getTime() ?? Infinity;
  if (ordem === 'prazo') return l.sort((a, b) => prazo(a) - prazo(b));
  if (ordem === 'valor-desc') return l.sort((a, b) => (b.valor || 0) - (a.valor || 0));
  if (ordem === 'valor-asc') return l.sort((a, b) => (a.valor || Infinity) - (b.valor || Infinity));
  if (ordem === 'distancia' && ctx.coords && ctx.base) {
    const c = ctx.coords[ctx.base];
    const km = new Map(l.map((e) => [e.id, distanciaKm(c, ctx.coords[ibgeDe(e, ctx.porNome)]) ?? Infinity]));
    return l.sort((a, b) => km.get(a.id) - km.get(b.id));
  }
  return l; // mais recentes: a lista já vem assim
}

/** Números da busca: quanto está em jogo, o que encerra logo, como se divide por modalidade */
export function resumoEditais(lista, agora = new Date()) {
  let valor = 0;
  let semValor = 0;
  let encerra3 = 0;
  let srp = 0;
  const porModalidade = new Map();
  for (const e of lista) {
    if (e.valor) valor += e.valor;
    else semValor++;
    const d = diasPara(e.propostasAte, agora);
    if (d !== null && d >= 0 && d <= 3) encerra3++;
    if (e.srp) srp++;
    const g = grupoModalidade(e.modalidade);
    porModalidade.set(g, (porModalidade.get(g) || 0) + 1);
  }
  return {
    total: lista.length,
    valor,
    semValor,
    encerra3,
    srp,
    porModalidade: [...porModalidade.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total),
  };
}

/** Raio-X dos itens de um edital: benefícios às ME/EPP, materiais e serviços, critério de julgamento */
export function raioXItens(itens) {
  const r = { total: itens.length, exclusivos: 0, cota: 0, subcontratacao: 0, materiais: 0, servicos: 0, sigilosos: 0, valor: 0, criterios: [] };
  const crit = new Map();
  for (const i of itens) {
    const b = norm(i.beneficio);
    if (/exclusiva/.test(b)) r.exclusivos++;
    else if (/cota/.test(b)) r.cota++;
    else if (/subcontrata/.test(b)) r.subcontratacao++;
    if (/servi/.test(norm(i.tipo))) r.servicos++;
    else if (/material/.test(norm(i.tipo))) r.materiais++;
    if (i.sigiloso) r.sigilosos++;
    const v = i.valorTotalEstimado ?? (i.valorUnitarioEstimado && i.quantidade ? i.valorUnitarioEstimado * i.quantidade : 0);
    if (v) r.valor += v;
    if (i.criterio) crit.set(i.criterio, (crit.get(i.criterio) || 0) + 1);
  }
  r.criterios = [...crit.entries()].sort((a, b) => b[1] - a[1]).map(([nome]) => nome);
  return r;
}
