// Lembrete da prospecção no Telegram (roda no GitHub Actions nos dias úteis de manhã): quem retornar hoje, os
// retornos atrasados e as empresas mais quentes ainda sem contato (src/lib/funilAviso.js).
//
// Configuração no GitHub (Settings → Secrets and variables → Actions → Secrets):
//   TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID   os mesmos do alerta de editais (PROSPECCAO_TELEGRAM_CHAT_ID para outra conversa)
//   MEUS_EDITAIS_SENHA                      a senha da equipe (SENHA) definida no Apps Script da planilha de Meus editais
// O endereço da planilha é o de src/data/privadoConfig.ts (ou MEUS_EDITAIS_URL, se quiser outro).
// `--teste` manda a mensagem mesmo sem nada para hoje.
import { MEUS_EDITAIS_URL } from '../src/data/privadoConfig.ts';
import { mensagemRetornos, quentesSemContato, retornosDoFunil } from '../src/lib/funilAviso.js';
import { telegram } from './telegram.mjs';

const SITE = 'https://www.agilcm.com.br';
const teste = process.argv.includes('--teste');
const hoje = process.env.FUNIL_HOJE || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

const url = (process.env.MEUS_EDITAIS_URL || MEUS_EDITAIS_URL || '').trim();
const senha = process.env.MEUS_EDITAIS_SENHA || '';
if (!senha) {
  console.log('::warning::Lembrete da prospecção desligado: falta o segredo MEUS_EDITAIS_SENHA (a senha da planilha da equipe) no GitHub.');
  process.exit(0);
}
if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) throw new Error('O endereço da planilha da equipe não é um /exec do Apps Script');

const r = await fetch(`${url}?senha=${encodeURIComponent(senha)}`, { redirect: 'follow' });
const j = await r.json().catch(() => null);
if (!j?.ok)
  throw new Error(
    j?.erro === 'senha' ? 'A planilha da equipe recusou a senha (MEUS_EDITAIS_SENHA)' : `A planilha da equipe não respondeu como esperado (${r.status})`,
  );

let clientes = null;
try {
  const rc = await fetch(`${SITE}/prospeccao/clientes.json?t=${Date.now()}`);
  if (rc.ok) clientes = await rc.json();
} catch {
  /* sem a lista, vai só o funil */
}

const retornos = retornosDoFunil(j.editais, hoje);
const quentes = quentesSemContato(clientes, retornos.noFunil, hoje);
const texto = mensagemRetornos(retornos, quentes, { hoje, site: `${SITE}/licitacoes/#possiveis-clientes` });
console.log(
  `Prospecção ${hoje}: ${retornos.noFunil.size} empresa(s) no funil, ${retornos.hoje.length} para hoje, ${retornos.atrasados.length} atrasada(s), ${quentes.length} quente(s) sem contato.`,
);
if (texto) await telegram(texto);
else if (teste) await telegram(`📞 Lembrete da prospecção conectado. Hoje (${hoje.split('-').reverse().join('/')}) não há retorno marcado.`);
