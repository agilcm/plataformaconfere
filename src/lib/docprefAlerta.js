// DocPref: junta as contratadas lidas no Drive com o cadastro do órgão e escolhe o que avisar no Telegram
// (scripts/docpref-alerta.mjs). Puro: sem tela e sem rede, para testar e para a página usar a mesma regra.
import { avaliarEmpresa, compBR, dataBR } from './docpref.js';
import { norm } from './docprefLeitor.js';

const digitos = (s) => String(s || '').replace(/\D/g, '');

/** Junta as prestadoras lidas no Drive com as cadastradas no DocPref (pelo nome da pasta, CNPJ ou razão social) */
export function unirEmpresas(leitura, prestadoras = []) {
  const usadas = new Set();
  const out = [];
  for (const e of leitura?.empresas || []) {
    const p = prestadoras.find(
      (x) =>
        !usadas.has(x.id) &&
        ((x.drive && norm(x.drive) === norm(e.nome)) ||
          (digitos(x.cnpj) && digitos(x.cnpj) === digitos(e.cnpj)) ||
          (norm(e.nome).length >= 4 && ` ${norm(x.razao)} `.includes(` ${norm(e.nome)} `))),
    );
    if (p) usadas.add(p.id);
    out.push({
      chave: p ? p.id : `drive:${e.id}`,
      nome: p?.razao || e.nome,
      razao: p?.razao || e.razao || '',
      cnpj: p?.cnpj || e.cnpj || '',
      contrato: p?.contrato || e.contrato || '',
      prestadora: p,
      drive: e,
    });
  }
  for (const p of prestadoras.filter((x) => !usadas.has(x.id)))
    out.push({ chave: p.id, nome: p.razao, razao: p.razao, cnpj: p.cnpj, contrato: p.contrato, prestadora: p });
  return out;
}

/** Avalia os meses de uma contratada com o cadastro, as conferências e os ajustes do DocPref */
export function avaliarUnida(e, dados, hoje) {
  const confs = {};
  for (const [k, v] of Object.entries(dados?.conferencias || {})) if (k.startsWith(`${e.chave}|`)) confs[k.slice(e.chave.length + 1)] = v;
  return avaliarEmpresa(e.drive || { meses: [] }, {
    hoje,
    dia: e.prestadora?.dia || 0,
    inicio: e.prestadora?.inicio || undefined,
    conferencias: confs,
    naoAplica: dados?.ajustes?.[e.chave]?.naoAplica,
  });
}

/** Dias antes do prazo em que o aviso sai (0 = no dia do prazo) */
export const DIAS_AVISO = [5, 2, 0];

/**
 * O que avisar hoje:
 *   aVencer       contratadas com documentos pendentes cujo prazo vence em 5 dias, em 2 dias ou hoje;
 *   condicionados meses cujo prazo venceu ontem com pendência (passaram a "Pagamento condicionado").
 * Cada aviso é preso a um dia do calendário, então não precisa guardar o que já foi avisado.
 * Com `todos`, lista a situação de hoje sem olhar o dia (prévia do teste).
 */
export function alertasDocPref({ empresas, dados, hoje, dias = DIAS_AVISO, todos = false }) {
  const aVencer = [];
  const condicionados = [];
  for (const e of empresas) {
    for (const av of avaliarUnida(e, dados, hoje)) {
      const item = {
        chave: e.chave,
        nome: e.nome,
        comp: av.comp,
        prazo: av.prazo,
        dias: av.diasParaPrazo,
        nadaEnviado: av.resumo.arquivos === 0,
        pendencias: av.pendencias.map((i) => i.nome),
        recusados: av.recusados.map((i) => i.nome),
      };
      if (av.sinal === 'aguardando' && (todos || dias.includes(av.diasParaPrazo))) aVencer.push(item);
      else if (av.sinal === 'travar' && (todos || av.diasParaPrazo === -1)) condicionados.push(item);
    }
  }
  const ordem = (a, b) => a.dias - b.dias || a.nome.localeCompare(b.nome, 'pt-BR') || a.comp.localeCompare(b.comp);
  aVencer.sort(ordem);
  condicionados.sort((a, b) => b.dias - a.dias || a.nome.localeCompare(b.nome, 'pt-BR') || a.comp.localeCompare(b.comp));
  return { aVencer, condicionados };
}

const escHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
const quando = (d) => (d <= 0 ? '<b>vence hoje</b>' : d === 1 ? 'vence amanhã' : `vence em ${d} dias`);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function linhaPendencias(a) {
  if (a.nadaEnviado) return 'nada enviado ainda';
  const partes = [];
  if (a.pendencias.length) partes.push(plural(a.pendencias.length, 'pendência', 'pendências'));
  if (a.recusados.length) partes.push(plural(a.recusados.length, 'documento recusado', 'documentos recusados'));
  const nomes = [...a.recusados, ...a.pendencias].slice(0, 3);
  const resto = a.recusados.length + a.pendencias.length - nomes.length;
  return `${partes.join(' e ')}: ${nomes.join('; ')}${resto > 0 ? `; e mais ${resto}` : ''}`;
}

/**
 * Texto do aviso (HTML do Telegram). Sem nada a avisar, devolve ''.
 * @param {{ aVencer: any[], condicionados: any[] }} alertas
 * @param {{ orgao?: string, site?: string, previa?: boolean }} [o]
 */
export function mensagemAlerta(alertas, o = {}) {
  const { aVencer, condicionados } = alertas;
  if (!aVencer.length && !condicionados.length) return '';
  const site = o.site || 'https://www.agilcm.com.br/docpref/';
  const link = (a) => `${site}#empresa=${encodeURIComponent(a.chave)}&mes=${a.comp}`;
  const L = [`📋 <b>DocPref${o.orgao ? ` · ${escHtml(o.orgao)}` : ''}</b>${o.previa ? ' (prévia)' : ''}`];
  if (aVencer.length) {
    L.push('', `⏳ <b>Prazo dos documentos chegando</b> (${plural(aVencer.length, 'mês', 'meses')} ainda sem tudo)`);
    for (const a of aVencer)
      L.push(
        `• <b>${escHtml(a.nome)}</b> · ${compBR(a.comp)} · prazo ${dataBR(a.prazo)}, ${quando(a.dias)}`,
        `  ${escHtml(linhaPendencias(a))}`,
        `  <a href="${link(a)}">Abrir no DocPref</a>`,
      );
    L.push('Cobre a contratada antes do prazo para o pagamento não ficar condicionado.');
  }
  if (condicionados.length) {
    L.push('', `🔴 <b>Pagamento condicionado</b> (o prazo venceu com pendência)`);
    for (const a of condicionados)
      L.push(
        `• <b>${escHtml(a.nome)}</b> · ${compBR(a.comp)} · prazo era ${dataBR(a.prazo)}`,
        `  ${escHtml(linhaPendencias(a))}`,
        `  <a href="${link(a)}">Abrir e emitir a notificação</a>`,
      );
    L.push('O pagamento desses meses fica condicionado à regularização (art. 121, § 3º, da Lei nº 14.133/2021, quando previsto no contrato).');
  }
  return L.join('\n');
}
