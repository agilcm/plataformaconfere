// Monitor de pregões (roda no GitHub Actions a cada 5 minutos) e avisa pelo Telegram.
// Lê do PNCP, que é público e sem captcha: situação da compra, situação e resultado de cada item
// e documentos novos (esclarecimento, impugnação, suspensão, ata, termos...).
//
// Configuração no GitHub (Settings → Secrets and variables → Actions):
//   variável MONITOR_PREGOES   um pregão por linha: link do PNCP, número de controle ou CNPJ/ANO/SEQ,
//                              com um apelido opcional depois (ex.: "https://pncp.gov.br/app/editais/18338178000102/2026/15 Ubá merenda")
//   segredo  TELEGRAM_BOT_TOKEN token do bot (@BotFather)
//   segredo  TELEGRAM_CHAT_ID   conversa ou grupo que recebe os avisos
// O estado (o que já foi visto) fica em monitor-estado.json, guardado pelo cache do Actions.
import fs from 'node:fs';
import { fetchArquivosCompra, fetchItensCompra, fetchJson, fetchResultadosItem, fixText, parseCompraRef } from '../src/lib/pncp.js';

const AGIL_CNPJ = '51328978000118';
const ARQUIVO_ESTADO = process.env.MONITOR_ESTADO || 'monitor-estado.json';
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const IMPORTANTES = /\b(esclarec|impugna|suspens|revoga|anula|adiamento|adiad|reabert|retifica|errata|ata\b|adjudica|homologa|resultado|recurso|contrarraz|diligencia|convoca|habilita)/i;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const brl = (v) => (v == null ? '' : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const curto = (s, n = 90) => {
  const t = fixText(s);
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t;
};

/** Uma linha da lista -> { ref, apelido } */
export function lerLinha(linha) {
  const t = linha.trim();
  if (!t || t.startsWith('#')) return null;
  const m = t.match(/(\d{14})\/(\d{4})\/(\d+)|(\d{14})-\d-(\d+)\/(\d{4})/);
  const ref = parseCompraRef(m ? m[0] : t);
  if (!ref) return { erro: t };
  const apelido = t.replace(/https?:\/\/\S+/g, '').replace(m ? m[0] : '', '').trim();
  return { ref, apelido };
}

const chave = (r) => `${r.cnpj}/${r.ano}/${r.seq}`;
const controle = (r) => `${r.cnpj}-1-${String(r.seq).padStart(6, '0')}/${r.ano}`;

async function situacaoCompra(r) {
  const p = new URLSearchParams({ q: controle(r), tipos_documento: 'edital', pagina: '1', tam_pagina: '5' });
  const d = await fetchJson(`https://pncp.gov.br/api/search/?${p}`);
  const it = (d?.items || []).find((x) => x.numero_controle_pncp === controle(r)) || null;
  if (!it) return null;
  return {
    situacao: it.cancelado ? 'Cancelada' : it.situacao_nome || '',
    titulo: fixText(it.title),
    orgao: fixText(it.orgao_nome),
    municipio: fixText(it.municipio_nome),
    objeto: fixText(it.description),
    propostasAte: it.data_fim_recebimento_propostas || null,
  };
}

/** Compara o que o PNCP mostra agora com o que já tínhamos visto e devolve os avisos. */
export function compararCompra(antes, agora) {
  const avisos = [];
  if (!antes) {
    avisos.push(`👀 Começando a monitorar: ${agora.itens.length} ${agora.itens.length === 1 ? 'item' : 'itens'}, ${agora.arquivos.length} documento(s).`);
    return avisos;
  }
  if (agora.situacao && antes.situacao && agora.situacao !== antes.situacao) avisos.push(`⚠️ <b>Situação do pregão:</b> ${esc(antes.situacao)} → <b>${esc(agora.situacao)}</b>`);
  for (const it of agora.itens) {
    const a = antes.itens?.[it.numero];
    if (a && a.situacao !== it.situacao) avisos.push(`🔄 Item ${it.numero} (${esc(curto(it.descricao, 60))}): ${esc(a.situacao)} → <b>${esc(it.situacao)}</b>`);
    const vistos = new Set(a?.resultados || []);
    for (const r of it.resultados || []) {
      const k = `${r.fornecedorDoc}|${r.valorTotal}`;
      if (vistos.has(k)) continue;
      const nosso = r.fornecedorDoc === AGIL_CNPJ;
      avisos.push(
        `${nosso ? '🏆 <b>AGIL venceu</b>' : '📊 Resultado'} item ${it.numero} (${esc(curto(it.descricao, 60))}): ${esc(r.fornecedor)}` +
          `${r.quantidade != null ? ` · ${r.quantidade.toLocaleString('pt-BR')} un.` : ''}${r.valorUnitario != null ? ` a ${brl(r.valorUnitario)}` : ''}${r.valorTotal != null ? ` = ${brl(r.valorTotal)}` : ''}`,
      );
    }
  }
  const docs = new Set(antes.arquivos || []);
  for (const d of agora.arquivos) {
    if (docs.has(d.url)) continue;
    const texto = `${d.tipo}: ${d.titulo}`;
    avisos.push(`${IMPORTANTES.test(semAcento(texto).replace(/_/g, ' ')) ? '⚠️ <b>Documento novo</b>' : '📄 Documento novo'}: ${esc(curto(texto, 120))}\n${esc(d.url)}`);
  }
  return avisos;
}

async function lerCompra(ref, antes) {
  const [sit, itens, arquivos] = await Promise.all([situacaoCompra(ref).catch(() => null), fetchItensCompra(ref), fetchArquivosCompra(ref)]);
  const out = { ...(sit || {}), situacao: sit?.situacao || antes?.situacao || '', itens: [], arquivos };
  for (const it of itens) {
    const a = antes?.itens?.[it.numero];
    let resultados = [];
    // só consulta os resultados quando o item tem resultado novo ou mudou de situação
    if (it.temResultado && (!a || a.situacao !== it.situacao || !a.resultados?.length)) {
      resultados = await fetchResultadosItem(ref, it.numero).catch(() => []);
    }
    out.itens.push({ numero: it.numero, descricao: it.descricao, situacao: it.situacao, resultados, _cache: a?.resultados });
  }
  return out;
}

const resumo = (c) => ({
  situacao: c.situacao,
  titulo: c.titulo,
  itens: Object.fromEntries(c.itens.map((i) => [i.numero, { situacao: i.situacao, resultados: [...new Set([...(i._cache || []), ...i.resultados.map((r) => `${r.fornecedorDoc}|${r.valorTotal}`)])] }])),
  arquivos: c.arquivos.map((d) => d.url),
});

async function telegram(texto) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    console.log('[sem Telegram configurado]\n' + texto.replace(/<[^>]+>/g, ''));
    return;
  }
  // limite do Telegram: 4096 caracteres por mensagem
  for (let i = 0; i < texto.length; i += 3900) {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: texto.slice(i, i + 3900), parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!r.ok) throw new Error(`Telegram respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
}

async function main() {
  if (process.argv.includes('--teste')) {
    await telegram('✅ Monitor de pregões da AGIL conectado. Os avisos vão chegar aqui.');
    return;
  }
  const linhas = String(process.env.MONITOR_PREGOES || '').split(/\r?\n|;/).map(lerLinha).filter(Boolean);
  if (!linhas.length) {
    console.log('Nenhum pregão em MONITOR_PREGOES.');
    return;
  }
  for (const l of linhas.filter((x) => x.erro)) console.log(`Linha ignorada (não reconheci o pregão): ${l.erro}`);
  let estado = {};
  try {
    estado = JSON.parse(fs.readFileSync(ARQUIVO_ESTADO, 'utf8'));
  } catch {
    /* primeira execução */
  }
  const novo = {};
  for (const { ref, apelido } of linhas.filter((x) => x.ref)) {
    const k = chave(ref);
    try {
      const agora = await lerCompra(ref, estado[k]);
      const avisos = compararCompra(estado[k], agora);
      novo[k] = resumo(agora);
      if (avisos.length) {
        const cab = `<b>${esc(apelido || agora.titulo || controle(ref))}</b>\n${esc(agora.orgao || '')}${agora.municipio ? ` · ${esc(agora.municipio)}` : ''}\nhttps://pncp.gov.br/app/editais/${k}`;
        await telegram(`${cab}\n\n${avisos.join('\n\n')}`);
        console.log(`${k}: ${avisos.length} aviso(s)`);
      } else console.log(`${k}: sem novidades`);
    } catch (e) {
      // PNCP instável: mantém o que já sabíamos e tenta de novo na próxima rodada
      if (estado[k]) novo[k] = estado[k];
      console.log(`${k}: PNCP não respondeu (${e.message})`);
    }
  }
  fs.writeFileSync(ARQUIVO_ESTADO, JSON.stringify(novo));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
