// Tendência: como a procura por um produto ou serviço muda ao longo do tempo nas licitações.
// Lê no PNCP todos os editais (abertos e encerrados) com a palavra pesquisada nos últimos meses
// e conta por mês: está em alta ou em baixa? Em que meses mais aparece? Quem mais compra?
import { PNCP_MUNICIPIOS_ZM } from '../data/pncpMunicipiosZM.js';
import { buildSearchUrl, fetchJson, fixText } from './pncp.js';

const ZM_IDS = Object.values(PNCP_MUNICIPIOS_ZM);
export const MESES_NOME = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const mesDe = (s) => String(s || '').slice(0, 7); // "2026-03"
/** "2026-11" a partir de uma data, no horário de Brasília */
const mesAtual = (agora) => new Date(agora.getTime() - 3 * 3600e3).toISOString().slice(0, 7);
function somarMeses(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/** O mínimo de cada edital que a tendência usa (a resposta do PNCP é grande) */
function resumir(it) {
  return {
    id: it.numero_controle_pncp || it.id,
    pub: it.data_publicacao_pncp || '',
    atu: it.data_atualizacao_pncp || it.data_publicacao_pncp || '',
    fim: it.data_fim_vigencia || null,
    valor: Number(it.valor_total_estimado) || 0,
    municipio: fixText(it.municipio_nome),
    uf: it.uf || '',
    orgao: fixText(it.orgao_nome),
    modalidade: it.modalidade_licitacao_nome || '',
    objeto: fixText(it.description),
    link: it.item_url ? `https://pncp.gov.br/app/editais/${String(it.item_url).replace(/^\/compras\//, '')}` : '',
    cancelado: !!it.cancelado,
  };
}

/**
 * Lê os editais com o termo, do mais novo para o mais antigo, até passar do início do período.
 * @param {{ q: string, regiao: 'zona-da-mata'|'mg'|'brasil', meses?: number, agora?: Date, tamanho?: number, maxPaginas?: number,
 *           onProgress?: (lidos: number, total: number) => void, fetchImpl?: typeof fetch }} o
 * meses: quantos meses completos olhar (o mês atual entra também, ainda em andamento)
 */
export async function buscarTendencia({ q, regiao, meses = 24, agora = new Date(), tamanho = 500, maxPaginas, onProgress, fetchImpl = fetch }) {
  const inicio = `${somarMeses(mesAtual(agora), -meses)}-01`;
  const limite = maxPaginas ?? (regiao === 'brasil' ? 12 : 24);
  const itens = [];
  let total = 0;
  let completo = false;
  let ultimaData = '';
  for (let pagina = 1; pagina <= limite; pagina++) {
    const url = buildSearchUrl({
      pagina,
      tamanho,
      q,
      status: 'todos',
      uf: regiao === 'brasil' ? '' : 'MG',
      municipios: regiao === 'zona-da-mata' ? ZM_IDS : [],
    });
    const data = await fetchJson(url, { fetchImpl, timeout: 60000, retries: 4 });
    total = Number(data?.total) || 0;
    const arr = Array.isArray(data?.items) ? data.items : [];
    for (const it of arr) itens.push(resumir(it));
    onProgress?.(itens.length, total);
    if (!arr.length || arr.length < tamanho || itens.length >= total) {
      completo = true;
      break;
    }
    // a lista vem do mais novo para o mais antigo: passou do início, acabou
    const ult = resumir(arr[arr.length - 1]);
    ultimaData = ult.atu > ult.pub ? ult.atu : ult.pub;
    if (ultimaData.slice(0, 10) < inicio) {
      completo = true;
      break;
    }
  }
  // sem ler tudo (termo muito comum), só os meses inteiros já lidos valem
  const desde = completo || !ultimaData ? inicio : `${somarMeses(mesDe(ultimaData), 1)}-01`;
  return { q, regiao, total, itens, completo, inicio, desde: desde > inicio ? desde : inicio };
}

/**
 * Números da tendência (função pura).
 * @param {{ itens: any[], inicio: string, desde: string }} r  resultado de buscarTendencia
 */
export function analisarTendencia(r, agora = new Date()) {
  const atual = mesAtual(agora);
  const primeiro = mesDe(r.desde);
  const meses = [];
  for (let m = primeiro; m <= atual; m = somarMeses(m, 1)) meses.push({ mes: m, n: 0, valor: 0, emAndamento: m === atual });
  const porMes = new Map(meses.map((x) => [x.mes, x]));
  const validos = r.itens.filter((e) => !e.cancelado && mesDe(e.pub) >= primeiro && mesDe(e.pub) <= atual);
  const vistos = new Set();
  const lista = validos.filter((e) => (vistos.has(e.id) ? false : vistos.add(e.id)));
  const cidades = new Map();
  const orgaos = new Map();
  const modalidades = new Map();
  let valor = 0;
  let abertos = 0;
  const hoje = new Date(agora.getTime() - 3 * 3600e3).toISOString().slice(0, 16);
  for (const e of lista) {
    const m = porMes.get(mesDe(e.pub));
    m.n++;
    m.valor += e.valor;
    valor += e.valor;
    if (e.fim && e.fim.slice(0, 16) >= hoje) abertos++;
    const c = `${e.municipio}${e.uf && e.uf !== 'MG' ? `/${e.uf}` : ''}`;
    if (e.municipio) {
      const x = cidades.get(c) || { nome: c, n: 0, valor: 0 };
      x.n++;
      x.valor += e.valor;
      cidades.set(c, x);
    }
    const o = orgaos.get(e.orgao) || { nome: e.orgao, n: 0, valor: 0 };
    o.n++;
    o.valor += e.valor;
    orgaos.set(e.orgao, o);
    const mod = e.modalidade || 'Não informada';
    modalidades.set(mod, (modalidades.get(mod) || 0) + 1);
  }
  const completos = meses.filter((m) => !m.emAndamento);
  const soma = (l) => l.reduce((s, m) => s + m.n, 0);
  // em alta ou em baixa: últimos 3 meses completos contra os 3 anteriores
  let variacao = null;
  if (completos.length >= 6) {
    const ult = soma(completos.slice(-3));
    const ant = soma(completos.slice(-6, -3));
    variacao = ant ? (ult - ant) / ant : ult ? 1 : 0;
  }
  // o mesmo período do ano anterior (últimos 12 meses contra os 12 de antes)
  let anual = null;
  if (completos.length >= 24) {
    const ult = soma(completos.slice(-12));
    const ant = soma(completos.slice(-24, -12));
    anual = ant ? (ult - ant) / ant : null;
  }
  // meses do ano que costumam ter mais editais (precisa de pelo menos um ano inteiro)
  let fortes = [];
  if (completos.length >= 12) {
    const porNome = Array.from({ length: 12 }, () => ({ soma: 0, vezes: 0 }));
    for (const m of completos) {
      const i = Number(m.mes.slice(5, 7)) - 1;
      porNome[i].soma += m.n;
      porNome[i].vezes++;
    }
    const media = porNome.map((x, i) => ({ mes: MESES_LONGO[i], media: x.vezes ? x.soma / x.vezes : 0 }));
    const geral = media.reduce((s, x) => s + x.media, 0) / 12;
    fortes = media
      .filter((x) => x.media > geral * 1.15)
      .sort((a, b) => b.media - a.media)
      .slice(0, 3)
      .map((x) => x.mes);
  }
  const status = variacao === null ? 'sem-base' : variacao >= 0.15 ? 'alta' : variacao <= -0.15 ? 'baixa' : 'estavel';
  const ordenar = (m) => [...m.values()].sort((a, b) => b.n - a.n || b.valor - a.valor);
  return {
    meses,
    total: lista.length,
    valor,
    comValor: lista.filter((e) => e.valor).length,
    abertos,
    variacao,
    anual,
    status,
    fortes,
    mediaMensal: completos.length ? soma(completos) / completos.length : 0,
    cidades: ordenar(cidades).slice(0, 8),
    orgaos: ordenar(orgaos).slice(0, 8),
    modalidades: [...modalidades.entries()].map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n),
    recentes: [...lista].sort((a, b) => b.pub.localeCompare(a.pub)).slice(0, 6),
  };
}

/** "2026-03" → "mar/26" */
export const rotuloMes = (mes) => `${MESES_NOME[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;
