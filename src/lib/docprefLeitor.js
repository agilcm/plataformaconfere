// DocPref · leitura de cada arquivo da pasta de uma prestadora: em que pasta está, que documento é e de que competência.
// Funções puras: o GitHub Actions (scripts/docpref-dados.mjs) baixa os arquivos, tira o texto dos PDFs e chama estas
// funções; o site só recebe o resultado (sem CPF, sem nome de empregado e sem link dos arquivos).
//
// Regra aprendida nos relatórios "AGIL ANÁLISE DOCUMENTAL": a competência vem do Período de apuração escrito no
// documento. Datas de transmissão e de pagamento aparecem à parte e não mudam a competência.

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** minúsculas, sem acento e com espaços simples */
export const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const comp = (a, m) => (a && m >= 1 && m <= 12 ? `${a}-${String(m).padStart(2, '0')}` : null);
const mesDoNome = (s) => {
  const n = norm(s).slice(0, 3);
  const i = MESES.findIndex((m) => m.startsWith(n));
  return i >= 0 ? i + 1 : 0;
};
const isoDe = (d, m, a) => (a && m && d ? `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null);
/** "3.861,16" → 3861.16 */
export const valorBR = (s) => {
  const v = Number(
    String(s || '')
      .replace(/[^\d,]/g, '')
      .replace(',', '.'),
  );
  return Number.isFinite(v) ? v : null;
};

/** Pasta do mês: "03-2026", "03.2026", "2026-03", "Março 2026", "03 - MARÇO - 2026" → "2026-03" */
export function compDaPasta(nome) {
  const n = norm(nome);
  let m = n.match(/^(\d{1,2})\s*[-_./ ]\s*(\d{4})$/);
  if (m) return comp(+m[2], +m[1]);
  m = n.match(/^(\d{4})\s*[-_./ ]\s*(\d{1,2})$/);
  if (m) return comp(+m[1], +m[2]);
  m = n.match(/(\d{4})/);
  const nomeMes = n.match(/(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*/);
  if (m && nomeMes) return comp(+m[1], mesDoNome(nomeMes[1]));
  m = n.match(/^(\d{1,2})\s*[-_. ]+\s*[a-z]+\s*[-_. ]+\s*(\d{4})$/);
  if (m) return comp(+m[2], +m[1]);
  return null;
}

/** Subpasta do book → chave da categoria */
export function categoriaDaPasta(nome) {
  const n = norm(nome);
  if (!n) return 'raiz';
  if (/certid/.test(n)) return 'certidoes';
  if (/desmobiliz/.test(n)) return 'desmobilizacao';
  if (/mobiliz/.test(n)) return 'mobilizacao';
  if (/subcontrat/.test(n)) return 'subcontratadas';
  if (/parcel/.test(n)) return 'parcelamentos';
  if (/acordo|conven/.test(n)) return 'acordo';
  if (/declara/.test(n)) return 'declaracoes';
  if (/admiss|aloca/.test(n)) return 'admissao';
  if (/demiss|transfer|deslig|rescis/.test(n)) return 'demissao';
  if (/ferias/.test(n)) return 'ferias';
  if (/\bcat\b|acidente/.test(n)) return 'cat';
  if (/inss/.test(n) && /fgts/.test(n)) return 'inss-fgts';
  if (/fgts/.test(n)) return 'fgts';
  if (/inss|dctf|darf|previd/.test(n)) return 'inss';
  if (/fopag|folha de pag|comp\.? de pg|salari|holerite/.test(n)) return 'fopag';
  if (/ponto/.test(n)) return 'ponto';
  if (/\bva\b|\bvr\b|aliment|refei|cesta/.test(n)) return 'vavr';
  if (/\bvt\b|transporte/.test(n)) return 'vt';
  if (/forca/.test(n)) return 'forca';
  return 'outros';
}

/** Categorias com documentos de pessoas: no site o nome do arquivo vira "Tipo · código" */
export const CATEGORIAS_PESSOAIS = new Set(['admissao', 'demissao', 'ferias', 'ponto', 'fopag', 'cat']);

const temTexto = (t) => norm(t).replace(/[^a-z0-9]/g, '').length > 40;

/** Primeira data dd/mm/aaaa depois de um rótulo */
function dataApos(texto, rotulo) {
  const i = texto.search(rotulo);
  if (i < 0) return null;
  const m = texto.slice(i, i + 160).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? isoDe(+m[1], +m[2], +m[3]) : null;
}

/** Período de apuração "MM/AAAA" logo depois do rótulo */
function compApos(texto, rotulo, alcance = 80) {
  const i = texto.search(rotulo);
  if (i < 0) return null;
  const m = texto.slice(i, i + alcance).match(/(?<![\d/])(\d{2})\/(\d{4})(?![\d/])/);
  return m ? comp(+m[2], +m[1]) : null;
}

const valorApos = (texto, rotulo, alcance = 120) => {
  const i = texto.search(rotulo);
  if (i < 0) return null;
  const m = texto.slice(i, i + alcance).match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/);
  return m ? valorBR(m[1]) : null;
};

/** Mês citado na declaração ("no mês de março") */
function mesDeclarado(texto, compPasta) {
  const m = norm(texto).match(/no mes de ([a-z]+)(?: de (\d{4}))?/);
  if (!m) return null;
  const mes = mesDoNome(m[1]);
  if (!mes) return null;
  const ano = m[2] ? +m[2] : compPasta ? +compPasta.slice(0, 4) : 0;
  return comp(ano, mes);
}

/** "Comprovante de Transação Pix" / TEV / TED / boleto pago: { valor, pagoEm, situacao, destino, detalhes } */
function lerComprovante(texto) {
  const t = texto;
  const ehPix =
    /Transa[cç][aã]o Pix|Comprovante de Pagamento|TEV Enviada|TED|Comprovante de Transfer|Comprovante de Pagamento de Boleto|Comprovante de Arrecada/i.test(t);
  if (!ehPix) return null;
  const valor = valorApos(t, /Valor Original:|Valor Nominal do Boleto:|Valor Total:|Valor do Pagamento:|Valor:|Valor pago/i) ?? valorApos(t, /Valor/i);
  // o ID do Pix (E + ISPB + AAAAMMDDhhmm) guarda a data do pagamento; a data no alto da página é a da impressão
  const e2e = t.match(/\bE\d{8}(20\d{2})(\d{2})(\d{2})\d{4}/);
  const pagoEm =
    dataApos(t, /Data e Hora:\s*\d|Data de Efetiva[cç][aã]o|Data do Pagamento|Data de d[eé]bito:|Data\/hora da opera[cç][aã]o/i) ||
    (e2e ? isoDe(+e2e[3], +e2e[2], +e2e[1]) : null);
  const situacao = /EFETIVADA|Liquidado|Opera[cç][aã]o realizada com sucesso|Pagamento efetuado/i.test(t) ? 'efetivada' : null;
  const destino = (t.match(/Destino\s*\n\s*Nome:\s*([^\n]+)/i)?.[1] || t.match(/Nome destinat[aá]rio:\s*([^\n]+)/i)?.[1] || '').trim();
  const detalhes = (t.match(/Detalhes:\s*([^\n]+)/i)?.[1] || '').trim();
  return { valor, pagoEm, situacao, destino, detalhes };
}

/** Validade de certidão (fim) */
function validadeCertidao(texto) {
  const t = texto;
  let m = t.match(/Validade:?\s*(\d{2})\/(\d{2})\/(\d{4})\s*a\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  if (m) return isoDe(+m[4], +m[5], +m[6]);
  m = t.match(/(?:V[aá]lida at[eé]|Validade:?|v[aá]lida por \d+ dias?,? at[eé]|Data de validade:?)\s*(?:o dia\s*)?(\d{2})\/(\d{2})\/(\d{4})/i);
  if (m) return isoDe(+m[1], +m[2], +m[3]);
  return null;
}

/**
 * Lê um arquivo do book.
 * @param {{ nome: string, categoria: string, texto?: string, compPasta?: string }} a
 * @returns {{ tipo: string|null, comp?: string|null, evidencia?: string, valor?: number|null, pagoEm?: string|null, situacao?: string|null,
 *   transmissao?: string|null, vencimento?: string|null, saldo?: number|null, encargos?: number|null, mesDeclarado?: string|null,
 *   houve?: boolean|null, validade?: string|null, vigencia?: [string, string]|null, detalhes?: string, destino?: string, semTexto?: boolean }}
 */
export function lerDocumento({ nome, categoria, texto = '', compPasta = null }) {
  const t = String(texto || '');
  const n = norm(nome);
  const nt = norm(t);
  const semTexto = !temTexto(t);
  const r = (tipo, extra = {}) => ({ tipo, semTexto, ...extra });

  // ---- certidões (podem vir em qualquer pasta)
  if (/certificado de regularidade do fgts|\bcrf\b/.test(nt) || /\bcrf\b|regularidade.*fgts/.test(n))
    return r('crf', { validade: validadeCertidao(t), evidencia: 'Certificado de Regularidade do FGTS' });
  if (/debitos trabalhistas|\bcndt\b/.test(nt) || /\bcndt\b|trabalhista/.test(n))
    return r('cndt', { validade: validadeCertidao(t), evidencia: 'Certidão negativa de débitos trabalhistas' });
  if (/certid/.test(nt + n) && /falencia|concordata|recuperacao judicial/.test(nt + n))
    return r('cert-falencia', { validade: validadeCertidao(t), evidencia: 'Certidão de falência e concordata' });
  if (/certid/.test(nt + n) && /tributos federais|divida ativa da uniao|receita federal|federal/.test(nt + n) && !/dctfweb|darf/.test(nt))
    return r('cert-federal', { validade: validadeCertidao(t), evidencia: 'Certidão federal' });
  if (/certid/.test(nt + n) && /estadual|secretaria de estado de fazenda|sef\/?mg|fazenda estadual/.test(nt + n))
    return r('cert-estadual', { validade: validadeCertidao(t), evidencia: 'Certidão estadual' });
  if (/certid/.test(nt + n) && /municip|prefeitura/.test(nt + n))
    return r('cert-municipal', { validade: validadeCertidao(t), evidencia: 'Certidão municipal' });

  // ---- planilha de força de trabalho
  if (/forca de trabalho/.test(n) || categoria === 'forca') return r('forca', { semTexto: false });

  // ---- DCTFWeb
  if (/relatorio da declaracao completa.*dctfweb|declaracao completa - dctfweb/.test(nt) || (/declaracao ?completa|declaracao - dctfweb/.test(n) && !t)) {
    const c = compApos(t, /Per[ií]odo (?:de )?apura[cç][aã]o/i);
    const saldos = [...t.matchAll(/Saldo a Pagar\s*(\d{1,3}(?:\.\d{3})*,\d{2})/gi)].map((m) => valorBR(m[1]));
    return r('dctf-completa', {
      comp: c,
      transmissao: dataApos(t, /Data\/Hora da/i),
      saldo: saldos.length ? Math.round(saldos.reduce((a, b) => a + b, 0) * 100) / 100 : null,
      evidencia: c ? `DCTFWeb: período de apuração ${c.slice(5)}/${c.slice(0, 4)}` : '',
    });
  }
  if (/recibo de entrega da declaracao de debitos e creditos tributarios federais - dctfweb/.test(nt) || (/recibo.*dctf/.test(n) && !t)) {
    const c = compApos(t, /Per[ií]odo de apura[cç][aã]o/i);
    const tot = t.match(/TOTAL\s+R\$\s*([\d.,]+)\s+R\$\s*([\d.,]+)/);
    return r('dctf-recibo', {
      comp: c,
      saldo: tot ? valorBR(tot[2]) : null,
      valor: tot ? valorBR(tot[1]) : null,
      evidencia: c ? `Recibo DCTFWeb: período de apuração ${c.slice(5)}/${c.slice(0, 4)}` : '',
    });
  }
  if (/resumo de debitos - dctfweb/.test(nt) || /resumodebitos/.test(n.replace(/\s/g, ''))) {
    const c = compApos(t, /Per[ií]odo de Apura[cç][aã]o/i);
    return r('dctf-debitos', {
      comp: c,
      transmissao: dataApos(t, /Data\/Hora da Transmiss/i),
      evidencia: c ? `Resumo de débitos: período ${c.slice(5)}/${c.slice(0, 4)}` : '',
    });
  }
  if (/resumo de creditos - dctfweb/.test(nt) || /resumocreditos/.test(n.replace(/\s/g, ''))) {
    const c = compApos(t, /Per[ií]odo de Apura[cç][aã]o/i);
    return r('dctf-creditos', {
      comp: c,
      transmissao: dataApos(t, /Data\/Hora da Transmiss/i),
      evidencia: c ? `Resumo de créditos: período ${c.slice(5)}/${c.slice(0, 4)}` : '',
    });
  }
  // ---- PER/DCOMP (compensação ou restituição da retenção): tratamento documentado do INSS
  if (/perdcomp|per\/dcomp|pedido de restituicao|declaracao de compensacao/.test(nt) || /perdcomp|per-dcomp/.test(n)) {
    const c = compApos(t, /Compet[eê]ncia:/i) || compApos(t, /Per[ií]odo de Apura[cç][aã]o/i);
    return r('darf-pagamento', {
      comp: c,
      transmissao: dataApos(t, /Data de Transmiss[aã]o/i),
      valor: valorApos(t, /Valor do Pedido:|Valor do Cr[eé]dito|Total do Cr[eé]dito/i),
      evidencia: `PER/DCOMP${c ? ` da competência ${c.slice(5)}/${c.slice(0, 4)}` : ''}`,
    });
  }
  // ---- DARF previdenciário
  if (/documento de arrecadacao de receitas federais|\bdarf\b/.test(nt) && !/comprovante de (transacao|pagamento|arrecadacao)/.test(nt)) {
    let c = null;
    const pa = t.match(/PA[:\s]*(\d{2})\/(\d{4})/);
    if (pa) c = comp(+pa[2], +pa[1]);
    if (!c) {
      const m = t.match(/Per[ií]odo de Apura[cç][aã]o\s*:?\s*(?:(\d{2})\/)?(\d{2})\/(\d{4})/i);
      if (m) c = comp(+m[3], +m[2]);
    }
    if (!c) {
      const m = nt.match(/periodo de apuracao\s*:?\s*([a-z]+)\/(\d{4})/);
      if (m) c = comp(+m[2], mesDoNome(m[1]));
    }
    return r('darf', {
      comp: c,
      vencimento: dataApos(t, /Pagar este documento at[eé]|Data de Vencimento|Vencimento/i),
      valor: valorApos(t, /Valor Total do Documento|Valor Total|Total a Recolher|Valor a recolher/i),
      evidencia: c ? `DARF: período de apuração ${c.slice(5)}/${c.slice(0, 4)}` : '',
    });
  }
  // ---- FGTS Digital
  if (/gfd - guia do fgts digital|guia do fgts digital/.test(nt)) {
    let c = null;
    const tag = t.match(/(\d{2})\/(\d{4})\s+MENSAL/);
    if (tag) c = comp(+tag[2], +tag[1]);
    if (!c) {
      const m = t.match(/Compet[eê]ncia[\s\S]{0,200}?\n\s*(\d{2})\/(\d{4})\s/);
      if (m) c = comp(+m[2], +m[1]);
    }
    const encargos = t.match(/Total FGTS:\s*[\d.,]+\s+[\d.,]+\s+[\d.,]+\s+([\d.,]+)/);
    return r('fgts-guia', {
      comp: c,
      vencimento: dataApos(t, /Pagar este documento at[eé]/i),
      valor: valorApos(t, /Total da Guia:/i) ?? valorApos(t, /Valor a recolher/i),
      encargos: encargos ? valorBR(encargos[1]) : null,
      evidencia: c ? `Guia FGTS Digital: competência mensal ${c.slice(5)}/${c.slice(0, 4)}` : '',
    });
  }
  if ((/detalhamento/.test(n) && /fgts/.test(n + nt)) || (categoria !== 'fopag' && /detalhe da guia emitida|gestao de guias/.test(nt))) {
    let c = compApos(t, /Compet[eê]ncia/i);
    const m = n.match(/(?<!\d)(\d{2})[-_ ]?(20\d{2})(?!\d)/);
    if (!c && m) c = comp(+m[2], +m[1]);
    return r('fgts-detalhe', {
      comp: c,
      valor: valorApos(t, /Total da Guia \(FGTS \+ Consignado\):/i),
      evidencia: c ? `Detalhamento FGTS Digital: apuração/referência ${c.slice(5)}/${c.slice(0, 4)}` : '',
    });
  }

  // ---- folha analítica e lote de pagamento da conta salário
  if (
    /folha de pagamento analitica|folha analitica|resumo (geral )?da folha|resumo por rubrica/.test(nt) ||
    /folha de pagamento|folha analitica|fopag/.test(n)
  ) {
    let c = null;
    const ref = t.match(/(?:Ref\.?|Per[ií]odo|Compet[eê]ncia)\s*:?\s*\d{2}\/(\d{2})\/(\d{4})\s*a\s*\d{2}\/(\d{2})\/(\d{4})/i);
    if (ref) c = comp(+ref[2], +ref[1]);
    if (!c) c = compApos(t, /Compet[eê]ncia/i) || compApos(t, /M[eê]s\/Ano/i);
    return r('folha', {
      comp: c,
      evidencia: c ? `Folha de pagamento: período ${c.slice(5)}/${c.slice(0, 4)} no cabeçalho` : '',
      rubricas: /resumo/i.test(t),
    });
  }
  if (/consulta detalhes da folha/.test(nt)) {
    const mes = nt.match(/folha (?:mes|do mes|ref\.?) ?(\d{1,2})/);
    const anoPg = t.match(/M[eê]s\/Ano:\s*(\d{2})\/(\d{4})/i);
    let c = null;
    if (mes && anoPg) {
      const m = +mes[1];
      c = comp(m > +anoPg[1] ? +anoPg[2] - 1 : +anoPg[2], m);
    }
    return r('comp-salarios', {
      comp: c,
      valor: valorApos(t, /Valor Total da Folha:/i),
      pagoEm: dataApos(t, /Data de D[eé]bito:/i),
      situacao: /Liquidado/i.test(t) ? 'efetivada' : null,
      lote: Number(t.match(/Quantidade de Pagamento:\s*(\d+)/i)?.[1]) || null,
      evidencia: c ? `Lote da conta salário: folha do mês ${c.slice(5)}/${c.slice(0, 4)}` : 'Lote de pagamento da conta salário',
    });
  }

  // ---- declarações (pasta Declarações ou nome "Declaração ...")
  if (/^declara/.test(n) || categoria === 'declaracoes' || /^declaracao de /.test(nt)) {
    const tipo = /acidente/.test(n + ' ' + nt.slice(0, 400))
      ? 'decl-acidente'
      : /desmobiliz/.test(n + nt.slice(0, 400))
        ? 'decl-desmobilizacao'
        : /mobiliz/.test(n + nt.slice(0, 400))
          ? 'decl-mobilizacao'
          : /admiss|aloca/.test(n + ' ' + nt.slice(0, 300))
            ? 'decl-admissoes'
            : /demiss|deslig/.test(n + ' ' + nt.slice(0, 300))
              ? 'decl-demissoes'
              : /transfer/.test(n + ' ' + nt.slice(0, 300))
                ? 'decl-transferencias'
                : /ferias/.test(n + ' ' + nt.slice(0, 300))
                  ? 'decl-ferias'
                  : /subcontrat/.test(n + ' ' + nt.slice(0, 300))
                    ? 'decl-subcontratacao'
                    : /especie|dinheiro/.test(n + nt)
                      ? 'decl-especie'
                      : /ponto/.test(n + nt.slice(0, 400))
                        ? 'ponto'
                        : /vale.?transporte|\bvt\b/.test(n + nt.slice(0, 400))
                          ? 'vt-relacao'
                          : /aliment|refeic|\bva\b|\bvr\b/.test(n + nt.slice(0, 400))
                            ? 'vavr-relacao'
                            : null;
    if (tipo) {
      const md = semTexto ? null : mesDeclarado(t, compPasta);
      const houve = semTexto ? null : /nao houve|nao ha |nao possui|nao teve|inexist/.test(nt) ? false : /houve|seguem|conforme relacao/.test(nt) ? true : null;
      return r(tipo, {
        mesDeclarado: md,
        houve,
        evidencia: md ? `Declara o mês ${md.slice(5)}/${md.slice(0, 4)}` : semTexto ? '' : 'Sem mês da competência no corpo da declaração',
      });
    }
  }

  // ---- convenção ou acordo coletivo
  if (/convencao coletiva|acordo coletivo|termo aditivo/.test(nt.slice(0, 600)) || categoria === 'acordo') {
    let vig = null;
    const m = nt.match(/vigencia[^.]{0,160}?(\d{1,2})[ºo°]?\s*de\s*([a-z]+)\s*de\s*(\d{4})\s*a\s*(\d{1,2})[ºo°]?\s*de\s*([a-z]+)\s*de\s*(\d{4})/);
    if (m) vig = [isoDe(+m[1], mesDoNome(m[2]), +m[3]), isoDe(+m[4], mesDoNome(m[5]), +m[6])];
    if (!vig) {
      const a = nt.match(/(?:convencao|acordo) coletiv[oa] de trabalho (\d{4})\/(\d{4})/);
      if (a) vig = [`${a[1]}-01-01`, `${a[2]}-12-31`];
    }
    return r('convencao', {
      vigencia: vig,
      evidencia: vig ? `Vigência de ${vig[0].split('-').reverse().join('/')} a ${vig[1].split('-').reverse().join('/')}` : '',
    });
  }

  // ---- comprovantes bancários: a pasta diz de quê
  const cp = lerComprovante(t);
  if (cp) {
    const extra = { valor: cp.valor, pagoEm: cp.pagoEm, situacao: cp.situacao, detalhes: cp.detalhes, destino: cp.destino };
    if (categoria === 'fgts' || /fgts/.test(norm(cp.detalhes)) || (/caixa economica federal/.test(norm(cp.destino)) && /fgts/.test(n))) {
      const mes = norm(cp.detalhes).match(/fgts (?:mes|ref\.?) ?(\d{1,2})/);
      return r('fgts-pagamento', { ...extra, mesInformado: mes ? +mes[1] : null });
    }
    if (categoria === 'inss' || categoria === 'inss-fgts' || /darf|inss|receita federal/.test(norm(cp.detalhes + ' ' + cp.destino)))
      return r('darf-pagamento', extra);
    if (categoria === 'vavr') return r('vavr-pagamento', extra);
    if (categoria === 'vt') return r('vt-pagamento', extra);
    if (categoria === 'ferias' || /ferias/.test(norm(cp.detalhes))) return r('fer-pagamento', extra);
    if (categoria === 'demissao' || /rescis/.test(norm(cp.detalhes))) {
      if (/multa|grrf|fgts/.test(norm(cp.detalhes))) return r('dem-multa-comp', extra);
      return r('dem-comp', extra);
    }
    if (categoria === 'fopag' || categoria === 'admissao' || /salario|pgto mes|pagamento mes/.test(norm(cp.detalhes))) {
      if (/adiant|vale/.test(norm(cp.detalhes))) return r('adiantamento', extra);
      return r('comp-salarios', extra);
    }
  }

  // ---- notas e guias de VA/VR e VT
  if (categoria === 'vavr' || categoria === 'vt') {
    const pre = categoria === 'vavr' ? 'vavr' : 'vt';
    if (/nota fiscal|nfs-?e|recibo|fatura|boleto|guia/.test(nt.slice(0, 500)) || /nota|nfs|nf[-_ ]|fatura|boleto|recibo/.test(n)) {
      const v = [/VALOR TOTAL RECEBIDO/i, /VALOR DO RECIBO/i, /Valor L[ií]quido da Nota/i, /Valor Total da Nota/i, /VALOR TOTAL DO SERVI[CÇ]O/i]
        .map((re) => valorApos(t, re, 60))
        .find((x) => x);
      return r(`${pre}-guia`, { valor: v || null, emitidaEm: dataApos(t, /Emiss[aã]o|DATA DE VENDA/i) });
    }
    if (/pedido|relacao|relatorio|extrato|beneficiario|colaborador/.test(n + nt.slice(0, 300)) || /\.(xls|xlsx|csv)$/.test(n)) return r(`${pre}-relacao`);
    return r(null);
  }

  // ---- admissão, demissão, férias e CAT: o tipo pelo texto ou pelo nome do arquivo
  const tn = `${n} ${nt.slice(0, 800)}`;
  if (categoria === 'admissao' || categoria === 'mobilizacao') {
    if (/atestado de saude ocupacional|\baso\b/.test(tn)) return r('adm-aso');
    if (/contrato (individual )?de trabalho|contrato de experiencia/.test(tn)) return r('adm-contrato');
    if (/ficha de registro|registro de empregado/.test(tn)) return r('adm-ficha');
    if (/\bepi\b|equipamento de protecao/.test(tn)) return r('adm-epi');
    if (/devolucao da ctps|entrega da ctps|recibo.*ctps/.test(tn)) return r('adm-entrega-ctps');
    if (/vale.?transporte|\bvt\b/.test(tn)) return r('adm-vt');
    if (/ctps|carteira de trabalho|esocial|s-2200|admissao/.test(tn)) return r('adm-ctps');
    return r(null);
  }
  if (categoria === 'demissao' || categoria === 'desmobilizacao') {
    if (/atestado de saude ocupacional|\baso\b/.test(tn)) return r('dem-aso');
    if (/desligamento/.test(nt.slice(0, 600)) && /esocial|motivo|s-2299/.test(nt)) return r('dem-baixa');
    if (/termo de rescisao|\btrct\b|termo de quitacao/.test(nt) || /rescis|trct/.test(n)) return r('dem-trct');
    if (/seguro.?desemprego/.test(tn)) return r('dem-seguro');
    if (/grrf|multa rescisoria|demonstrativo do trabalhador|fgts rescisorio/.test(tn)) return r('dem-multa');
    if (/aviso previo|pedido de demissao|aviso de dispensa|comunicado de dispensa/.test(tn) && !/desligamento\s*\n/.test(nt)) return r('dem-aviso');
    if (/desligamento|s-2299|baixa|ctps/.test(tn)) return r('dem-baixa');
    return r(null);
  }
  if (categoria === 'ferias') {
    if (/aviso de ferias/.test(tn)) return r('fer-aviso');
    if (/recibo de ferias/.test(tn)) return r('fer-recibo');
    return r(null);
  }
  if (categoria === 'cat') return r('cat');
  if (categoria === 'ponto') return r('ponto');
  if (categoria === 'parcelamentos') return r(/requer|termo|adesao|confissao/.test(tn) ? 'parc-requerimento' : 'parc-parcela');
  if (categoria === 'subcontratadas') return r('sub-book');
  if (categoria === 'fopag') {
    if (/holerite|recibo de pagamento de salario|contracheque/.test(tn)) return r('comp-salarios', { holerite: true });
    if (/especie/.test(tn)) return r('decl-especie');
    if (/adiantamento/.test(tn)) return r('adiantamento');
    if (/desconto|consentimento|autorizacao/.test(tn)) return r('desconto-parcelado');
  }
  return r(null);
}

/** Linhas da planilha de força de trabalho → competência e quantos ativos/inativos */
export function lerForcaDeTrabalho(linhas) {
  if (!Array.isArray(linhas) || !linhas.length) return { comp: null, ativos: 0, inativos: 0, linhas: 0 };
  const cab = (linhas[0] || []).map((c) => norm(c));
  const col = (re) => cab.findIndex((c) => re.test(c));
  const iAno = col(/^ano/);
  const iMes = col(/^mes/);
  const iSit = col(/^situacao/);
  const iNome = col(/colaborador|^nome do colab/);
  const corpo = linhas.slice(1).filter((l) => l && (iNome >= 0 ? String(l[iNome] ?? '').trim() : l.some((c) => String(c ?? '').trim())));
  const contagem = new Map();
  for (const l of corpo) {
    const c = comp(Number(l[iAno]), Number(l[iMes]));
    if (c) contagem.set(c, (contagem.get(c) || 0) + 1);
  }
  const compMaisComum = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const sit = (l) => norm(l[iSit]);
  return {
    comp: compMaisComum,
    ativos: iSit >= 0 ? corpo.filter((l) => sit(l) === 'a' || sit(l).startsWith('ativ')).length : corpo.length,
    inativos: iSit >= 0 ? corpo.filter((l) => sit(l) === 'i' || sit(l).startsWith('inat')).length : 0,
    linhas: corpo.length,
  };
}

/** O comprovante de salário foi pago a outra pessoa? (o nome do arquivo é o do empregado) */
export function pagoATerceiro(nomeArquivo, destino) {
  const d = norm(destino);
  if (!d) return false;
  const palavras = norm(nomeArquivo.replace(/\.[a-z0-9]+$/i, ''))
    .replace(/[^a-z ]/g, ' ')
    .split(' ')
    .filter((p) => p.length >= 4 && !/^(comprovante|pagamento|salario|pgto|mes|folha|pix|transferencia|recibo)$/.test(p));
  if (!palavras.length) return false;
  const nomes = d.split(' ');
  const parecido = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.slice(0, 4) === b.slice(0, 4) || distancia(a, b) <= 1));
  return !palavras.some((p) => nomes.some((x) => parecido(p, x)));
}

/** Distância de edição (letras trocadas, a mais ou a menos): "walison" × "wallison" = 1 */
function distancia(a, b) {
  let ant = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    ant = cur;
  }
  return ant[b.length];
}
