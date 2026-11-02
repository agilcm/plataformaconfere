// Alerta diário de editais (roda no GitHub Actions toda manhã) e avisa pelo Telegram:
// editais abertos novos na Zona da Mata ligados aos CNAEs da Ágil CM (e aos segmentos escolhidos).
//
// Configuração no GitHub (Settings → Secrets and variables → Actions):
//   segredos  TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID (os mesmos do monitor de pregões)
//   variável  ALERTA_SEGMENTOS  opcional: ids de segmentos, separados por vírgula (ex.: "uniformes,eventos")
// O estado (editais já avisados) fica em alerta-estado.json, guardado pelo cache do Actions.
import fs from 'node:fs';
import { PNCP_MUNICIPIOS_ZM } from '../src/data/pncpMunicipiosZM.js';
import { SEGMENTO_POR_ID } from '../src/data/segmentos.js';
import { filtrarPorCnaes, filtrarPorSegmento } from '../src/lib/agilCnae.js';
import { fetchMunicipios, fixText } from '../src/lib/pncp.js';
import { esc, telegram } from './telegram.mjs';

const ARQUIVO_ESTADO = process.env.ALERTA_ESTADO || 'alerta-estado.json';
const MAX_NA_MENSAGEM = 40;
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

/** Editais da Ágil (CNAEs + segmentos), sem repetir: id → edital com a lista do que casou */
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

/** Texto da mensagem (HTML do Telegram) */
export function mensagem(novos, { hoje = new Date() } = {}) {
  const dia = hoje.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
  if (!novos.length) return `📋 <b>Editais da Ágil · Zona da Mata · ${dia}</b>\nNenhum edital novo ligado aos CNAEs da Ágil desde o último aviso.`;
  const porCidade = new Map();
  for (const e of novos) porCidade.set(e.municipio, [...(porCidade.get(e.municipio) || []), e]);
  const linhas = [`📋 <b>Editais da Ágil · Zona da Mata · ${dia}</b>`, `${novos.length} ${novos.length === 1 ? 'edital novo ligado' : 'editais novos ligados'} aos CNAEs da Ágil.`];
  let n = 0;
  for (const [cidade, lista] of [...porCidade].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'pt-BR'))) {
    if (n >= MAX_NA_MENSAGEM) break;
    linhas.push('', `📍 <b>${esc(cidade)}</b>`);
    for (const e of lista) {
      if (n++ >= MAX_NA_MENSAGEM) break;
      const prazo = dataHora(e.propostasAte);
      linhas.push(
        `• ${esc(curto(e.objeto || e.titulo, 160))}`,
        `  ${[esc(curto(e.orgao, 60)), e.valor ? brl(e.valor) : '', prazo ? `propostas até ${prazo}` : ''].filter(Boolean).join(' · ')}`,
        `  <i>${esc([...new Set(e.motivos)].slice(0, 3).join(', '))}</i> · <a href="${esc(e.link)}">ver edital</a>`,
      );
    }
  }
  if (novos.length > MAX_NA_MENSAGEM) linhas.push('', `… e mais ${novos.length - MAX_NA_MENSAGEM}. Veja todos em ${SITE}`);
  return linhas.join('\n');
}

async function main() {
  if (process.argv.includes('--teste')) {
    await telegram('✅ Alerta diário de editais da Ágil conectado. Todo dia de manhã chegam aqui os editais novos da Zona da Mata.');
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
  // o PNCP oscila: tenta algumas vezes antes de desistir do dia
  let r = null;
  for (let t = 0; t < 5 && !r; t++) {
    try {
      r = await fetchMunicipios(Object.values(PNCP_MUNICIPIOS_ZM));
    } catch (e) {
      console.log(`PNCP não respondeu (tentativa ${t + 1}): ${e.message}`);
      await new Promise((ok) => setTimeout(ok, 60_000));
    }
  }
  if (!r) {
    await telegram('⚠️ O PNCP está fora do ar agora e não consegui buscar os editais de hoje. Tento de novo amanhã; enquanto isso, veja no site: ' + SITE);
    return;
  }
  if (r.paginasComErro) console.log(`${r.paginasComErro} página(s) do PNCP não responderam; os editais delas ficam para amanhã.`);
  const daAgil = editaisDaAgil(r.items, segmentos);
  const vistos = new Set(estado?.vistos || []);
  // primeira execução: avisa só o que foi publicado nas últimas 24 horas (e guarda o resto como visto)
  const ontem = new Date(Date.now() - 24 * 3600e3).toISOString();
  const novos = daAgil.filter((e) => (estado ? !vistos.has(e.id) : (e.publicadoEm || '') >= ontem));
  console.log(`${r.items.length} editais abertos na Zona da Mata, ${daAgil.length} da Ágil, ${novos.length} novos.`);
  await telegram(mensagem(novos));
  // guarda o que já foi avisado (os mais recentes por último; limite para o arquivo não crescer sem fim)
  const todos = [...new Set([...vistos, ...daAgil.map((e) => e.id)])].slice(-5000);
  fs.writeFileSync(ARQUIVO_ESTADO, JSON.stringify({ vistos: todos, atualizadoEm: new Date().toISOString() }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
