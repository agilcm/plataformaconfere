// Aviso do DocPref no Telegram (roda no GitHub Actions toda manhã):
//   ⏳ 5 dias antes, 2 dias antes e no dia do prazo: as contratadas que ainda não enviaram tudo do mês;
//   🔴 no dia seguinte ao prazo: os meses que passaram a "Pagamento condicionado".
// Lê a pasta do Drive já publicada (www.agilcm.com.br/docpref/leitura.json) e, se a planilha do órgão estiver ligada,
// o cadastro das contratadas (dia do prazo, início do contrato) e as conferências do fiscal.
//
// Configuração no GitHub (Settings → Secrets and variables → Actions → Secrets):
//   TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID   os mesmos do alerta de editais
//   DOCPREF_TELEGRAM_CHAT_ID                opcional: outra conversa só para o DocPref (ex.: grupo dos fiscais)
//   DOCPREF_PLANILHA_URL                    opcional: endereço /exec do Apps Script da planilha do órgão
//   DOCPREF_PLANILHA_SENHA                  opcional: a senha (SENHA) definida no Apps Script
// Sem a planilha, o aviso usa só o que está no Drive, com o prazo padrão (último dia do mês seguinte).
// Cada aviso é preso a um dia do calendário: não há estado guardado. `--teste` manda uma prévia da situação de hoje.
import { deRegistros } from '../src/lib/docprefSinc.js';
import { alertasDocPref, mensagemAlerta, unirEmpresas } from '../src/lib/docprefAlerta.js';
import { telegram } from './telegram.mjs';

const SITE = process.env.DOCPREF_SITE || 'https://www.agilcm.com.br/docpref/';
const teste = process.argv.includes('--teste');
/** Data de hoje em Brasília (AAAA-MM-DD) */
const hoje = process.env.DOCPREF_HOJE || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

async function lerJson(url, nome) {
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) throw new Error(`${nome} respondeu ${r.status}`);
  return r.json();
}

async function lerPlanilha() {
  const url = (process.env.DOCPREF_PLANILHA_URL || '').trim();
  const senha = process.env.DOCPREF_PLANILHA_SENHA || '';
  if (!url || !senha) return null;
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) throw new Error('DOCPREF_PLANILHA_URL não é um endereço /exec do Apps Script');
  const j = await lerJson(`${url}?senha=${encodeURIComponent(senha)}`, 'A planilha do órgão');
  if (!j?.ok)
    throw new Error(j?.erro === 'senha' ? 'A planilha do órgão recusou a senha (DOCPREF_PLANILHA_SENHA)' : 'A planilha do órgão não respondeu como esperado');
  return deRegistros(j.registros || {}, {});
}

const leitura = await lerJson(`${SITE}leitura.json?t=${Date.now()}`, 'A leitura do Drive');
let dados = { prestadoras: [], conferencias: {}, ajustes: {}, config: {} };
let fonte = 'só o Drive (planilha do órgão não configurada)';
try {
  const p = await lerPlanilha();
  if (p) {
    dados = p;
    fonte = `Drive + planilha do órgão (${p.prestadoras.length} contratada(s) cadastrada(s))`;
  }
} catch (e) {
  // sem a planilha o aviso ainda vale, com o prazo padrão; o erro fica no log e na mensagem de teste
  fonte = `só o Drive: ${e.message}`;
  console.error(e.message);
}

const empresas = unirEmpresas(leitura, dados.prestadoras);
const alertas = alertasDocPref({ empresas, dados, hoje, todos: teste });
const orgao = (dados.config?.contratante || '').trim();
let texto = mensagemAlerta(alertas, { orgao, site: SITE, previa: teste });
console.log(
  `DocPref ${hoje}: ${empresas.length} contratada(s), ${alertas.aVencer.length} a vencer, ${alertas.condicionados.length} condicionado(s). Fonte: ${fonte}`,
);

if (teste) {
  const cab = `✅ <b>Aviso do DocPref ligado.</b>\nFonte: ${fonte}.\nVocê recebe aqui: 5 dias antes, 2 dias antes e no dia do prazo, quem ainda não enviou tudo; e no dia seguinte, os meses com pagamento condicionado.`;
  texto = texto ? `${cab}\n\nSituação de hoje:\n${texto}` : `${cab}\n\nHoje não há documento pendente perto do prazo.`;
}
if (texto) await telegram(texto);
else console.log('Nada a avisar hoje.');
