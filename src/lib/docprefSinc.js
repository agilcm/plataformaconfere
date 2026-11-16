// DocPref: sincronização com a planilha compartilhada do órgão (scripts/apps-script/docpref.gs).
// Cada parte dos dados vira um registro da planilha, com a data da última mudança:
//   "orgao"                      os dados do órgão contratante
//   "contrato:<id>"              o cadastro de uma contratada
//   "conferencia:<chave>|<mês>"  as marcações do fiscal num mês
//   "ajuste:<chave>"             as exigências que não se aplicam a uma contratada
// Vale sempre a mudança mais recente de cada registro; um registro apagado vira "removido" (para a remoção chegar a
// todos). Puro: sem tela e sem rede, para testar.

/** Data dada aos registros que já existiam antes de ligar a planilha: perdem para qualquer versão da planilha */
export const ANTIGO = '2000-01-01T00:00:00.000Z';

/** Os dados do DocPref como registros { id: { tipo, dados } } */
export function paraRegistros(d) {
  const out = { orgao: { tipo: 'orgao', dados: d.config } };
  for (const p of d.prestadoras || []) out[`contrato:${p.id}`] = { tipo: 'contrato', dados: p };
  for (const [k, c] of Object.entries(d.conferencias || {})) out[`conferencia:${k}`] = { tipo: 'conferencia', dados: c };
  for (const [k, a] of Object.entries(d.ajustes || {})) out[`ajuste:${k}`] = { tipo: 'ajuste', dados: a };
  return out;
}

/** Volta dos registros para os dados do DocPref */
export function deRegistros(regs, configPadrao = {}) {
  const d = { prestadoras: [], conferencias: {}, config: { ...configPadrao }, ajustes: {} };
  for (const [id, r] of Object.entries(regs)) {
    if (!r || r.dados == null) continue;
    if (id === 'orgao') d.config = { ...configPadrao, ...r.dados };
    else if (id.startsWith('contrato:')) d.prestadoras.push(r.dados);
    else if (id.startsWith('conferencia:')) d.conferencias[id.slice(12)] = r.dados;
    else if (id.startsWith('ajuste:')) d.ajustes[id.slice(7)] = r.dados;
  }
  d.prestadoras.sort((a, b) => String(a.razao || '').localeCompare(String(b.razao || ''), 'pt-BR'));
  return d;
}

const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Marca a data de cada registro que mudou entre `antes` e `depois` (os removidos ganham a data da remoção)
 * @returns {{ carimbos: Record<string,string>, removidos: Record<string,string> }}
 */
export function carimbar(antes, depois, carimbos = {}, removidos = {}, agora = new Date().toISOString()) {
  const a = paraRegistros(antes);
  const b = paraRegistros(depois);
  const C = { ...carimbos };
  const R = { ...removidos };
  for (const [id, r] of Object.entries(b))
    if (!a[id] || !igual(a[id].dados, r.dados)) {
      C[id] = agora;
      delete R[id];
    }
  for (const id of Object.keys(a))
    if (!b[id]) {
      R[id] = agora;
      delete C[id];
    }
  return { carimbos: C, removidos: R };
}

/**
 * Junta a planilha com este navegador: em cada registro vale a mudança mais recente.
 * @param {{ dados: any, carimbos: Record<string,string>, removidos: Record<string,string> }} local
 * @param {Record<string, { tipo: string, dados: any, atualizadoEm: string, removido?: boolean }>} servidor
 * @param {any} [configPadrao]
 * @returns {{ dados: any, carimbos: Record<string,string>, removidos: Record<string,string>, enviar: { id: string, tipo: string, dados: any, atualizadoEm: string, removido: boolean }[] }}
 */
export function mesclarDocPref(local, servidor, configPadrao = {}) {
  const regs = paraRegistros(local.dados);
  // o órgão sem nenhum dado preenchido não é registro: não apaga o da planilha
  if (!local.carimbos?.orgao && igual(regs.orgao.dados, configPadrao)) delete regs.orgao;
  const C = { ...local.carimbos };
  const R = { ...local.removidos };
  const enviar = [];
  for (const id of new Set([...Object.keys(servidor), ...Object.keys(regs), ...Object.keys(R)])) {
    const s = servidor[id];
    const existe = !!regs[id];
    const tMeu = existe ? C[id] || ANTIGO : R[id] || '';
    const tS = s?.atualizadoEm || '';
    if (tMeu && (!s || tMeu > tS)) {
      enviar.push({
        id,
        tipo: existe ? regs[id].tipo : s?.tipo || id.split(':')[0],
        dados: existe ? regs[id].dados : null,
        atualizadoEm: tMeu,
        removido: !existe,
      });
      if (existe) C[id] = tMeu;
    } else if (s && tS > tMeu) {
      if (s.removido) {
        delete regs[id];
        delete C[id];
        R[id] = tS;
      } else {
        regs[id] = { tipo: s.tipo, dados: s.dados };
        C[id] = tS;
        delete R[id];
      }
    }
  }
  return { dados: deRegistros(regs, configPadrao), carimbos: C, removidos: R, enviar };
}

/** Remoções com mais de 180 dias já chegaram a todos: saem da lista */
export function limparRemovidos(removidos, agora = new Date()) {
  const limite = new Date(agora.getTime() - 180 * 86400e3).toISOString();
  return Object.fromEntries(Object.entries(removidos).filter(([, t]) => t > limite));
}

/** Uma linha legível de cada registro, para a coluna "Resumo" da planilha (quem abre a planilha entende o que é) */
export function resumoRegistro(id, dados, nomes = {}) {
  if (dados == null) return 'removido';
  if (id === 'orgao') return [dados.contratante || 'Órgão sem nome', dados.unidade, dados.cidade].filter(Boolean).join(' · ');
  if (id.startsWith('contrato:'))
    return [dados.razao, dados.cnpj && `CNPJ ${dados.cnpj}`, dados.contrato && `contrato ${dados.contrato}`, dados.fiscal && `fiscal: ${dados.fiscal}`]
      .filter(Boolean)
      .join(' · ');
  if (id.startsWith('conferencia:')) {
    const [chave, comp] = id.slice(12).split('|');
    const itens = Object.values(dados.itens || {}).filter((i) => i && i.status && i.status !== 'pendente');
    const conta = (st) => itens.filter((i) => i.status === st).length;
    const partes = [
      conta('ok') && `${conta('ok')} recebido(s)`,
      conta('recusado') && `${conta('recusado')} recusado(s)`,
      conta('na') && `${conta('na')} não se aplica`,
    ].filter(Boolean);
    const mes = comp ? `${comp.slice(5, 7)}/${comp.slice(0, 4)}` : '';
    return `${nomes[chave] || chave} · ${mes} · ${partes.length ? partes.join(', ') : 'sem marcações'}`;
  }
  if (id.startsWith('ajuste:')) {
    const chave = id.slice(7);
    const n = (dados.naoAplica || []).length;
    return `${nomes[chave] || chave} · ${n} ${n === 1 ? 'exigência não se aplica' : 'exigências não se aplicam'}`;
  }
  return '';
}
