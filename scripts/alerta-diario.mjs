// Alerta diário de editais (roda no GitHub Actions toda manhã) e avisa pelo Telegram, em dois blocos:
//   1) Zona da Mata: todos os editais abertos ligados aos CNAEs da Ágil CM, repetidos todo dia até a data do pregão
//      (🆕 nos que apareceram desde o último aviso);
//   2) Minas Gerais (fora da Zona da Mata): só os editais novos do dia.
//
// Configuração no GitHub (Settings → Secrets and variables → Actions):
//   segredos  TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID (os mesmos do monitor de pregões)
//   variável  ALERTA_SEGMENTOS  opcional: ids de segmentos, separados por vírgula (ex.: "uniformes,eventos")
// O estado (editais já avisados) fica em alerta-estado.json, guardado pelo cache do Actions.
import fs from 'node:fs';
import { PNCP_MUNICIPIOS_ZM } from '../src/data/pncpMunicipiosZM.js';
import { SEGMENTO_POR_ID } from '../src/data/segmentos.js';
import { filtrarPorCnaes, filtrarPorSegmento } from '../src/lib/agilCnae.js';
import { fetchAllMG, fetchMunicipios, fixText } from '../src/lib/pncp.js';
import { esc, telegram } from './telegram.mjs';

const ARQUIVO_ESTADO = process.env.ALERTA_ESTADO || 'alerta-estado.json';
const MAX_MG = 40;
const SITE = 'https://www.agilcm.com.br/licitacoes/#agil-cnae';

const brl = (v) => (v == null ? '' : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const curto = (s, n) => {
  const t = fixText(s);
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};
const dataHora = (s) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[3]}/${m[2]} às ${m[4]}:${m[5]}` : '';
};
/** Dias até o prazo (0 = hoje), contando em dias do calendário de Brasília */
function diasAte(prazo, hoje) {
  const m = String(prazo || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d0 = hoje.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.parse(`${d0}T00:00:00Z`)) / 86400e3);
}
const quando = (dias) => (dias == null ? '' : dias <= 0 ? '⏰ <b>hoje</b>' : dias === 1 ? '⏰ <b>amanhã</b>' : `faltam ${dias} dias`);

/** Editais da Ágil (CNAEs + segmentos), sem repetir; cada um com a lista do que casou em `motivos` */
export function editaisDaAgil(editais, segmentos = []) {
  const out = new Map();
  const juntar = (lista, rotulo) => {
    for (const e of lista) {
      const atual = out.get(e.id) || { ...e, motivos: [] };
      atual.motivos.push(...rotulo(e));
      out.set(e.id, atual);
    }
  };
  juntar(filtrarPorCnaes(editais), (e) => e.termos.slice(0, 2));
  for (const id of segmentos) juntar(filtrarPorSegmento(editais, id), () => [SEGMENTO_POR_ID.get(id)?.nome || id]);
  return [...out.values()];
}

const linkEdital = (e) => `<a href="${esc(e.link)}">ver edital</a>`;
const motivo = (e) => esc([...new Set(e.motivos || [])].slice(0, 3).join(', '));

/**
 * Texto da mensagem (HTML do Telegram).
 * @param {{ zm: any[], novosZm: Set<string>, mg: any[] | null, hoje?: Date }} o
 *   zm: editais da Zona da Mata ainda abertos; novosZm: ids que apareceram desde o último aviso;
 *   mg: editais novos de Minas fora da Zona da Mata (null = o PNCP não respondeu)
 */
export function mensagem({ zm, novosZm = new Set(), mg = [], hoje = new Date() }) {
  const dia = hoje.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
  const l = [`📋 <b>Editais da Ágil · ${dia}</b>`];

  // 1) Zona da Mata: todos os abertos, do prazo mais próximo para o mais distante
  const abertos = zm
    .map((e) => ({ ...e, dias: diasAte(e.propostasAte, hoje) }))
    .filter((e) => e.dias == null || e.dias >= 0)
    .sort((a, b) => (a.dias ?? 999) - (b.dias ?? 999) || (a.propostasAte || '').localeCompare(b.propostasAte || ''));
  const qtdNovos = abertos.filter((e) => novosZm.has(e.id)).length;
  l.push(
    '',
    `🟢 <b>ZONA DA MATA</b> · ${abertos.length} ${abertos.length === 1 ? 'edital aberto' : 'editais abertos'}${qtdNovos ? ` (${qtdNovos} ${qtdNovos === 1 ? 'novo' : 'novos'} 🆕)` : ''}`,
  );
  if (!abertos.length) l.push('Nenhum edital aberto ligado aos CNAEs da Ágil.');
  for (const e of abertos) {
    const prazo = dataHora(e.propostasAte);
    l.push(
      '',
      `${novosZm.has(e.id) ? '🆕 ' : ''}<b>${esc(e.municipio)}</b> · ${esc(curto(e.objeto || e.titulo, 120))}`,
      `${[e.valor ? brl(e.valor) : '', prazo ? `até ${prazo}` : '', quando(e.dias)].filter(Boolean).join(' · ')} · ${linkEdital(e)}`,
    );
  }

  // 2) Minas Gerais fora da Zona da Mata: só os novos
  l.push('', '', `🔵 <b>MINAS GERAIS</b> (fora da Zona da Mata) · novos de hoje`);
  if (mg == null) l.push('O PNCP não respondeu para Minas Gerais hoje; amanhã os novos de hoje aparecem aqui.');
  else if (!mg.length) l.push('Nenhum edital novo ligado aos CNAEs da Ágil.');
  else {
    const lista = [...mg].sort((a, b) => (a.propostasAte || '').localeCompare(b.propostasAte || ''));
    for (const e of lista.slice(0, MAX_MG)) {
      const prazo = dataHora(e.propostasAte);
      l.push(
        '',
        `<b>${esc(e.municipio)}</b> · ${esc(curto(e.objeto || e.titulo, 120))}`,
        `${[e.valor ? brl(e.valor) : '', prazo ? `até ${prazo}` : '', `<i>${motivo(e)}</i>`].filter(Boolean).join(' · ')} · ${linkEdital(e)}`,
      );
    }
    if (lista.length > MAX_MG) l.push('', `… e mais ${lista.length - MAX_MG}. Veja todos em ${SITE}`);
  }
  return l.join('\n');
}

/** O PNCP oscila: tenta algumas vezes antes de desistir */
async function insistir(fn, nome) {
  for (let t = 0; t < 5; t++) {
    try {
      return await fn();
    } catch (e) {
      console.log(`PNCP não respondeu para ${nome} (tentativa ${t + 1}): ${e.message}`);
      await new Promise((ok) => setTimeout(ok, 60_000));
    }
  }
  return null;
}

async function main() {
  if (process.argv.includes('--teste')) {
    await telegram('✅ Alerta diário de editais da Ágil conectado. Todo dia de manhã chegam aqui os editais da Zona da Mata e os novos de Minas Gerais.');
    return;
  }
  const segmentos = String(process.env.ALERTA_SEGMENTOS || '')
    .split(/[,;\s]+/)
    .filter((s) => SEGMENTO_POR_ID.has(s));
  let estado = null;
  try {
    estado = JSON.parse(fs.readFileSync(ARQUIVO_ESTADO, 'utf8'));
  } catch {
    /* primeira execução */
  }
  const vistos = new Set(estado?.vistos || []);
  const ontem = new Date(Date.now() - 24 * 3600e3).toISOString();
  // primeira execução: "novo" é o que foi publicado nas últimas 24 horas
  const ehNovo = (e) => (estado ? !vistos.has(e.id) : (e.publicadoEm || '') >= ontem);

  const rZm = await insistir(() => fetchMunicipios(Object.values(PNCP_MUNICIPIOS_ZM)), 'a Zona da Mata');
  if (!rZm) {
    await telegram(`⚠️ O PNCP está fora do ar agora e não consegui buscar os editais de hoje. Tento de novo amanhã; enquanto isso, veja no site: ${SITE}`);
    return;
  }
  const zm = editaisDaAgil(rZm.items, segmentos);
  // Minas inteira (cerca de 120 páginas do PNCP); se falhar, a Zona da Mata vai assim mesmo
  const rMg = await insistir(() => fetchAllMG({ concurrency: 4 }), 'Minas Gerais');
  const mgAgil = rMg ? editaisDaAgil(rMg.items.filter((e) => !e.microrregiao), segmentos) : [];
  const mgNovos = rMg ? mgAgil.filter(ehNovo) : null;
  const novosZm = new Set(zm.filter(ehNovo).map((e) => e.id));
  console.log(`Zona da Mata: ${zm.length} da Ágil (${novosZm.size} novos). Minas: ${rMg ? `${mgAgil.length} da Ágil, ${mgNovos.length} novos` : 'sem resposta'}.`);

  await telegram(mensagem({ zm, novosZm, mg: mgNovos }));

  // guarda o que já foi avisado (os mais recentes por último; limite para o arquivo não crescer sem fim).
  // Se Minas não respondeu, os novos de Minas ficam para amanhã.
  const todos = [...new Set([...vistos, ...zm.map((e) => e.id), ...mgAgil.map((e) => e.id)])].slice(-8000);
  fs.writeFileSync(ARQUIVO_ESTADO, JSON.stringify({ vistos: todos, atualizadoEm: new Date().toISOString() }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
