// DocPref · conferência mensal dos documentos das prestadoras de serviço (co-responsabilidade da tomadora).
// Regras aprendidas nos relatórios "AGIL ANÁLISE DOCUMENTAL":
//   - cada pasta de mês (ex.: 03-2026) é a competência: folha, comprovantes de salário e guias são desse mês;
//   - o prazo de envio termina no último dia do mês seguinte (ou no dia combinado com a prestadora);
//   - a competência de cada documento vem do Período de apuração escrito nele; transmissão e pagamento ficam à parte;
//   - CRF todo mês; certidões federal, estadual, municipal, trabalhista (CNDT) e de falência nos meses pares;
//     certidão que vence num mês é cobrada nesse mês, mesmo ímpar.
// Funções puras: a página (DocPrefPage) e os testes usam as mesmas regras.

/**
 * Situações do mês que ligam ou desligam grupos de documentos. `declaracao`: a declaração que responde a pergunta.
 * `padrao: false`: sem declaração nem pasta, entende-se que não houve (parcelamento, mobilização, desmobilização).
 */
export const SITUACOES = [
  { id: 'admissoes', pergunta: 'Houve admissões ou alocações no contrato?', declaracao: 'decl-admissoes', categoria: 'admissao', forca: 'admissoes' },
  { id: 'demissoes', pergunta: 'Houve demissões?', declaracao: 'decl-demissoes', categoria: 'demissao', forca: 'demissoes' },
  { id: 'ferias', pergunta: 'Houve empregados em férias?', declaracao: 'decl-ferias', categoria: 'ferias' },
  { id: 'acidente', pergunta: 'Houve acidente de trabalho?', declaracao: 'decl-acidente', categoria: 'cat' },
  { id: 'subcontratacao', pergunta: 'Há subcontratação?', declaracao: 'decl-subcontratacao', categoria: 'subcontratadas' },
  { id: 'parcelamento', pergunta: 'Há parcelamento de INSS ou FGTS?', categoria: 'parcelamentos', padrao: false },
  { id: 'mobilizacao', pergunta: 'Início do contrato (mobilização)?', declaracao: 'decl-mobilizacao', categoria: 'mobilizacao', padrao: false },
  { id: 'desmobilizacao', pergunta: 'Fim do contrato (desmobilização)?', declaracao: 'decl-desmobilizacao', categoria: 'desmobilizacao', padrao: false },
];

/**
 * O book do mês, pasta por pasta.
 * `quando`: o grupo só vale se a situação for "sim". `naoSeAplica`: vale, mas a prestadora pode declarar que não se aplica.
 * `eventual` (item): só se houver; não trava o pagamento.
 */
export const GRUPOS = [
  {
    id: 'declaracoes',
    pasta: 'Declarações',
    categorias: ['declaracoes'],
    itens: [
      { id: 'decl-acidente', nome: 'Declaração de ocorrência ou não de acidente de trabalho' },
      { id: 'decl-admissoes', nome: 'Declaração/relação de admissões e alocações' },
      { id: 'decl-demissoes', nome: 'Declaração/relação de demissões' },
      { id: 'decl-transferencias', nome: 'Declaração/relação de transferências' },
      { id: 'decl-ferias', nome: 'Declaração/relação de férias' },
      { id: 'decl-subcontratacao', nome: 'Declaração de subcontratação' },
    ],
  },
  {
    id: 'fopag',
    pasta: 'FOPAG e Comp. de Pgto',
    categorias: ['fopag'],
    itens: [
      { id: 'folha', nome: 'Folha analítica e resumo por rubrica' },
      { id: 'comp-salarios', nome: 'Comprovação dos salários' },
      { id: 'decl-especie', nome: 'Declaração de pagamento em espécie', eventual: true },
      { id: 'adiantamento', nome: 'Comprovação de adiantamento descontado na folha', eventual: true },
      { id: 'desconto-parcelado', nome: 'Consentimento para desconto parcelado', eventual: true },
    ],
  },
  { id: 'ponto', pasta: 'Ponto', categorias: ['ponto'], itens: [{ id: 'ponto', nome: 'Ponto ou declaração de não aplicação' }] },
  {
    id: 'inss',
    pasta: 'INSS',
    categorias: ['inss', 'inss-fgts'],
    itens: [
      { id: 'dctf-completa', nome: 'DCTFWeb - declaração completa' },
      { id: 'dctf-recibo', nome: 'DCTFWeb - recibo de entrega' },
      { id: 'dctf-debitos', nome: 'DCTFWeb - resumo de débitos' },
      { id: 'dctf-creditos', nome: 'DCTFWeb - resumo de créditos' },
      { id: 'darf', nome: 'Guia DARF previdenciário, quando devido', quando: 'darf' },
      { id: 'darf-pagamento', nome: 'Pagamento do DARF ou PER/DCOMP (compensação)', quando: 'darf' },
    ],
  },
  {
    id: 'fgts',
    pasta: 'FGTS',
    categorias: ['fgts', 'inss-fgts'],
    itens: [
      { id: 'fgts-guia', nome: 'Guia FGTS Digital' },
      { id: 'fgts-detalhe', nome: 'Detalhamento da guia FGTS Digital' },
      { id: 'fgts-pagamento', nome: 'Comprovação do pagamento FGTS Digital' },
    ],
  },
  {
    id: 'vavr',
    pasta: 'VA e VR',
    categorias: ['vavr'],
    naoSeAplica: 'vavr-relacao',
    itens: [
      { id: 'vavr-relacao', nome: 'Relação nominal de VA/VR (ou declaração de que não se aplica)' },
      { id: 'vavr-guia', nome: 'Guia ou nota fiscal de VA/VR' },
      { id: 'vavr-pagamento', nome: 'Comprovação de pagamento de VA/VR' },
    ],
  },
  {
    id: 'vt',
    pasta: 'VT',
    categorias: ['vt'],
    naoSeAplica: 'vt-relacao',
    itens: [
      { id: 'vt-relacao', nome: 'Relação nominal dos optantes de VT (ou declaração de que não se aplica)' },
      { id: 'vt-guia', nome: 'Guia, recibo ou nota fiscal de VT' },
      { id: 'vt-pagamento', nome: 'Comprovação de pagamento de VT' },
    ],
  },
  { id: 'forca', pasta: 'Força de trabalho', categorias: ['forca'], itens: [{ id: 'forca', nome: 'Planilha de força de trabalho da competência' }] },
  { id: 'acordo', pasta: 'Acordo Coletivo', categorias: ['acordo'], itens: [{ id: 'convencao', nome: 'Acordo ou convenção coletiva aplicável' }] },
  {
    id: 'admissao',
    pasta: 'Admissão-alocação',
    categorias: ['admissao'],
    quando: 'admissoes',
    itens: [
      { id: 'adm-contrato', nome: 'Contrato de trabalho' },
      { id: 'adm-ficha', nome: 'Ficha de registro' },
      { id: 'adm-ctps', nome: 'CTPS ou eSocial de admissão' },
      { id: 'adm-aso', nome: 'ASO admissional' },
      { id: 'adm-epi', nome: 'Ficha de EPI assinada, quando exigida' },
      { id: 'adm-entrega-ctps', nome: 'Entrega/devolução da CTPS física, quando aplicável', eventual: true },
      { id: 'adm-vt', nome: 'Opção (ou não) pelo vale-transporte' },
    ],
  },
  {
    id: 'demissao',
    pasta: 'Demissão-transferência',
    categorias: ['demissao'],
    quando: 'demissoes',
    itens: [
      { id: 'dem-trct', nome: 'TRCT assinado e datado' },
      { id: 'dem-comp', nome: 'Comprovação do pagamento da rescisão' },
      { id: 'dem-aviso', nome: 'Aviso de dispensa ou pedido de demissão' },
      { id: 'dem-multa', nome: 'Guia da multa (GRRF) e demonstrativo por trabalhador' },
      { id: 'dem-multa-comp', nome: 'Comprovação do pagamento da multa rescisória' },
      { id: 'dem-baixa', nome: 'Baixa na CTPS ou eSocial de desligamento' },
      { id: 'dem-aso', nome: 'ASO demissional' },
      { id: 'dem-seguro', nome: 'Protocolo do seguro-desemprego, quando aplicável', eventual: true },
    ],
  },
  {
    id: 'ferias',
    pasta: 'Férias',
    categorias: ['ferias'],
    quando: 'ferias',
    itens: [
      { id: 'fer-aviso', nome: 'Aviso de férias assinado' },
      { id: 'fer-recibo', nome: 'Recibo de férias' },
      { id: 'fer-pagamento', nome: 'Comprovação do pagamento das férias' },
    ],
  },
  { id: 'cat', pasta: 'CAT', categorias: ['cat'], quando: 'acidente', itens: [{ id: 'cat', nome: 'CAT da ocorrência' }] },
  {
    id: 'parcelamentos',
    pasta: 'Parcelamentos',
    categorias: ['parcelamentos'],
    quando: 'parcelamento',
    itens: [
      { id: 'parc-requerimento', nome: 'Requerimento/termo do parcelamento (INSS no e-CAC; FGTS na Caixa)' },
      { id: 'parc-parcela', nome: 'Guia e comprovante da parcela do mês (ou tela do parcelamento)' },
    ],
  },
  {
    id: 'mobilizacao',
    pasta: 'Mobilização',
    categorias: ['mobilizacao'],
    quando: 'mobilizacao',
    itens: [{ id: 'decl-mobilizacao', nome: 'Declaração de mobilização com os admitidos/alocados' }],
  },
  {
    id: 'desmobilizacao',
    pasta: 'Desmobilização',
    categorias: ['desmobilizacao'],
    quando: 'desmobilizacao',
    itens: [{ id: 'decl-desmobilizacao', nome: 'Declaração de desmobilização com demitidos e transferidos' }],
  },
  {
    id: 'subcontratadas',
    pasta: 'Subcontratadas',
    categorias: ['subcontratadas'],
    quando: 'subcontratacao',
    itens: [{ id: 'sub-book', nome: 'Os mesmos documentos de cada subcontratada, numa pasta para cada uma' }],
  },
];

/** Nomes curtos (relatório rápido): "Declarações: acidente, admissões" */
export const CURTO = {
  'decl-acidente': 'acidente',
  'decl-admissoes': 'admissões',
  'decl-demissoes': 'demissões',
  'decl-transferencias': 'transferências',
  'decl-ferias': 'férias',
  'decl-subcontratacao': 'subcontratação',
  folha: 'folha analítica',
  'comp-salarios': 'comprovantes de salário',
  'decl-especie': 'declaração de pagamento em espécie',
  adiantamento: 'adiantamento',
  'desconto-parcelado': 'desconto parcelado',
  ponto: 'folhas de ponto',
  'dctf-completa': 'DCTFWeb completa',
  'dctf-recibo': 'recibo da DCTFWeb',
  'dctf-debitos': 'resumo de débitos',
  'dctf-creditos': 'resumo de créditos',
  darf: 'DARF',
  'darf-pagamento': 'pagamento do DARF ou PER/DCOMP',
  'fgts-guia': 'guia',
  'fgts-detalhe': 'detalhamento',
  'fgts-pagamento': 'comprovante',
  'vavr-relacao': 'relação',
  'vavr-guia': 'nota/guia',
  'vavr-pagamento': 'comprovante',
  'vt-relacao': 'relação',
  'vt-guia': 'nota/recibo',
  'vt-pagamento': 'comprovante',
  forca: 'planilha do mês',
  convencao: 'convenção coletiva',
  'adm-contrato': 'contrato',
  'adm-ficha': 'ficha de registro',
  'adm-ctps': 'CTPS/eSocial',
  'adm-aso': 'ASO admissional',
  'adm-epi': 'ficha de EPI',
  'adm-entrega-ctps': 'entrega da CTPS',
  'adm-vt': 'opção de VT',
  'dem-trct': 'TRCT',
  'dem-comp': 'pagamento da rescisão',
  'dem-aviso': 'aviso/pedido',
  'dem-multa': 'guia da multa',
  'dem-multa-comp': 'pagamento da multa',
  'dem-baixa': 'baixa CTPS/eSocial',
  'dem-aso': 'ASO demissional',
  'dem-seguro': 'seguro-desemprego',
  'fer-aviso': 'aviso',
  'fer-recibo': 'recibo',
  'fer-pagamento': 'pagamento',
  cat: 'CAT',
  'parc-requerimento': 'requerimento',
  'parc-parcela': 'parcela do mês',
  'decl-mobilizacao': 'declaração',
  'decl-desmobilizacao': 'declaração',
  'sub-book': 'documentos da subcontratada',
  crf: 'CRF',
  'cert-federal': 'federal',
  'cert-estadual': 'estadual',
  'cert-municipal': 'municipal',
  cndt: 'CNDT',
  'cert-falencia': 'falência',
};

/** Certidões: `pares` = apresentação nos meses pares; as demais todo mês */
export const CERTIDOES = [
  { id: 'crf', nome: 'Certificado de regularidade do FGTS (CRF)', pares: false },
  { id: 'cert-federal', nome: 'Certidão federal', pares: true },
  { id: 'cert-estadual', nome: 'Certidão estadual', pares: true },
  { id: 'cert-municipal', nome: 'Certidão municipal', pares: true },
  { id: 'cndt', nome: 'Certidão negativa de débitos trabalhistas (CNDT)', pares: true },
  { id: 'cert-falencia', nome: 'Certidão de falência e concordata', pares: true },
];

/**
 * Documentos da empresa com validade (não mensais): entram no controle de vencimentos quando aparecem na pasta,
 * como no relatório "A vencer" das plataformas de gestão de terceiros.
 */
export const DOCUMENTOS_EMPRESA = [
  { id: 'pgr', nome: 'PGR - Programa de Gerenciamento de Riscos' },
  { id: 'pcmso', nome: 'PCMSO - Programa de Controle Médico de Saúde Ocupacional' },
  { id: 'ltcat', nome: 'LTCAT - Laudo Técnico das Condições Ambientais' },
  { id: 'alvara', nome: 'Alvará de funcionamento' },
  { id: 'cartao-cnpj', nome: 'Cartão CNPJ' },
  { id: 'contrato-social', nome: 'Contrato social' },
];

/** Situação de cada exigência */
export const STATUS = {
  ok: { nome: 'Recebido · competência correta', curto: 'Recebido', cor: 'bg-emerald-50 text-emerald-800 border-emerald-300', trava: false },
  conferir: { nome: 'Recebido · conferir', curto: 'Conferir', cor: 'bg-teal-50 text-teal-800 border-teal-300', trava: false },
  divergencia: { nome: 'Divergência a tratar', curto: 'Divergência', cor: 'bg-orange-50 text-orange-800 border-orange-300', trava: true },
  candidato: { nome: 'Arquivo a classificar', curto: 'Classificar', cor: 'bg-amber-50 text-amber-800 border-amber-300', trava: true },
  ocorrencia: { nome: 'Definir ocorrência', curto: 'Definir', cor: 'bg-amber-50 text-amber-800 border-amber-300', trava: true },
  faltando: { nome: 'Não localizado', curto: 'Não localizado', cor: 'bg-red-50 text-red-800 border-red-300', trava: true },
  vencida: { nome: 'Certidão vencida', curto: 'Vencida', cor: 'bg-red-50 text-red-800 border-red-300', trava: true },
  renovar: { nome: 'Renovação no mês', curto: 'Renovar', cor: 'bg-red-50 text-red-800 border-red-300', trava: true },
  recusado: { nome: 'Recusado', curto: 'Recusado', cor: 'bg-red-50 text-red-800 border-red-300', trava: true },
  eventual: { nome: 'Só se houver', curto: 'Só se houver', cor: 'bg-slate-50 text-slate-500 border-slate-200', trava: false },
  na: { nome: 'Não se aplica', curto: 'Não se aplica', cor: 'bg-slate-50 text-slate-500 border-slate-200', trava: false },
};

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "2026-10" → "outubro/2026" */
export function nomeCompetencia(comp) {
  const [a, m] = String(comp).split('-').map(Number);
  return a && m ? `${MESES.at(m - 1)}/${a}` : String(comp);
}
/** "2026-10" → "10/2026" */
export const compBR = (comp) => (comp ? `${String(comp).slice(5, 7)}/${String(comp).slice(0, 4)}` : '');
/** "2026-11-30" → "30/11/2026" */
export const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');

/** Competência seguinte ("2026-12" → "2027-01") */
export function proximaComp(comp, n = 1) {
  const [a, m] = String(comp).split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
const fimDoMes = (comp) => {
  const [a, m] = String(comp).split('-').map(Number);
  return `${comp}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}`;
};

/** Prazo de envio: último dia do mês seguinte (dia 0) ou o dia combinado ("2026-10", 25 → "2026-11-25") */
export function prazoDe(comp, dia = 0) {
  const seg = proximaComp(comp);
  const ultimo = fimDoMes(seg);
  if (!dia) return ultimo;
  return `${seg}-${String(Math.min(Number(dia), Number(ultimo.slice(8)))).padStart(2, '0')}`;
}

/** A competência anterior ao mês de hoje ("2026-11-07" → "2026-10"): é a que está sendo cobrada agora */
export function competenciaAtual(hoje = new Date()) {
  const d = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const hojeISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const somaDias = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);

/** Domingo de Páscoa (algoritmo de Meeus) */
export function pascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
const cacheFeriados = new Map();
/** Dias sem expediente bancário no país: feriados nacionais, Carnaval, Sexta-feira Santa e Corpus Christi */
export function feriadosNacionais(ano) {
  if (!cacheFeriados.has(ano)) {
    const p = pascoa(ano);
    cacheFeriados.set(
      ano,
      new Set([
        `${ano}-01-01`,
        somaDias(p, -48),
        somaDias(p, -47),
        somaDias(p, -2),
        `${ano}-04-21`,
        `${ano}-05-01`,
        somaDias(p, 60),
        `${ano}-09-07`,
        `${ano}-10-12`,
        `${ano}-11-02`,
        `${ano}-11-15`,
        `${ano}-11-20`,
        `${ano}-12-25`,
      ]),
    );
  }
  return cacheFeriados.get(ano);
}
/** Dia útil: segunda a sexta, fora dos feriados nacionais */
export const diaUtil = (iso) => {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return dow !== 0 && dow !== 6 && !feriadosNacionais(+iso.slice(0, 4)).has(iso);
};
/** Dia `dia` do mês seguinte à competência; se não for dia útil, antecipa (FGTS e INSS dia 20, DCTFWeb dia 15) */
export function vencimentoLegal(comp, dia) {
  let d = `${proximaComp(comp)}-${String(dia).padStart(2, '0')}`;
  while (!diaUtil(d)) d = somaDias(d, -1);
  return d;
}
/** 5º dia útil do mês seguinte (prazo do salário, art. 459 da CLT), contando de segunda a sexta */
export function quintoDiaUtil(comp) {
  let d = `${proximaComp(comp)}-01`;
  let n = diaUtil(d) ? 1 : 0;
  while (n < 5) {
    d = somaDias(d, 1);
    if (diaUtil(d)) n++;
  }
  return d;
}

/**
 * Prazos legais do mês, pelos documentos lidos: salário até o 5º dia útil, DCTFWeb até o dia 15, FGTS e INSS até o
 * dia 20 do mês seguinte (antecipados se não houver expediente bancário).
 * @returns {{ id: string, nome: string, prazo: string, data: string|null, situacao: 'ok'|'atraso'|'sem-data'|'retificadora', texto: string }[]}
 */
export function prazosLegais(comp, arquivos = []) {
  const out = [];
  const ultimo = (lista) => lista.sort().at(-1) || null;
  const salario = arquivos.filter((a) => a.tipo === 'comp-salarios' && a.pagoEm);
  if (arquivos.some((a) => a.tipo === 'comp-salarios')) {
    const prazo = quintoDiaUtil(comp);
    const atrasados = salario.filter((a) => a.pagoEm > prazo);
    const data = ultimo(salario.map((a) => a.pagoEm));
    out.push({
      id: 'salario',
      nome: 'Salários (5º dia útil)',
      prazo,
      data,
      situacao: !data ? 'sem-data' : atrasados.length ? 'atraso' : 'ok',
      texto: !data
        ? 'Comprovantes sem data de pagamento legível.'
        : atrasados.length
          ? `${atrasados.length} ${atrasados.length === 1 ? 'pagamento depois' : 'pagamentos depois'} do 5º dia útil (${dataBR(prazo)}); último em ${dataBR(data)}.`
          : `Pagos até ${dataBR(data)}, dentro do 5º dia útil (${dataBR(prazo)}).`,
    });
  }
  const dctf = arquivos.filter((a) => (a.tipo === 'dctf-completa' || a.tipo === 'dctf-recibo') && (a.comp === comp || !a.comp));
  if (dctf.length) {
    const prazo = vencimentoLegal(comp, 15);
    const retificadora = dctf.some((a) => a.retificadora);
    const data = ultimo(dctf.map((a) => a.transmissao).filter(Boolean));
    out.push({
      id: 'dctfweb',
      nome: 'DCTFWeb (dia 15)',
      prazo,
      data,
      situacao: !data ? 'sem-data' : retificadora && data > prazo ? 'retificadora' : data > prazo ? 'atraso' : 'ok',
      texto: !data
        ? 'Data de transmissão não identificada.'
        : retificadora && data > prazo
          ? `Retificadora transmitida em ${dataBR(data)}; conferir se a original foi entregue até ${dataBR(prazo)}.`
          : data > prazo
            ? `Transmitida em ${dataBR(data)}, depois do prazo (${dataBR(prazo)}).`
            : `Transmitida em ${dataBR(data)}, dentro do prazo (${dataBR(prazo)}).`,
    });
  }
  for (const [id, nome, guiaTipo, pagoTipo] of [
    ['fgts', 'FGTS (dia 20)', 'fgts-guia', 'fgts-pagamento'],
    ['inss', 'DARF previdenciário (dia 20)', 'darf', 'darf-pagamento'],
  ]) {
    const guias = arquivos.filter((a) => a.tipo === guiaTipo && (a.comp === comp || !a.comp));
    const pagos = arquivos.filter((a) => a.tipo === pagoTipo && a.pagoEm);
    if (!guias.length && !pagos.length) continue;
    const prazo = vencimentoLegal(comp, 20);
    const data = ultimo(pagos.map((a) => a.pagoEm));
    const venc = ultimo(guias.map((a) => a.vencimento).filter(Boolean));
    const encargos = guias.reduce((s2, a) => s2 + (a.encargos || 0), 0);
    const atraso = (data && data > prazo) || (venc && venc > prazo) || encargos > 0;
    out.push({
      id,
      nome,
      prazo,
      data,
      situacao: atraso ? 'atraso' : data ? 'ok' : 'sem-data',
      texto: atraso
        ? `Recolhimento fora do prazo legal (${dataBR(prazo)})${venc && venc > prazo ? `: guia com vencimento em ${dataBR(venc)}` : ''}${data ? `${venc && venc > prazo ? ',' : ':'} pago em ${dataBR(data)}` : ''}${encargos > 0 ? `, com ${moeda(encargos)} de encargos` : ''}.`
        : data
          ? `Pago em ${dataBR(data)}, dentro do prazo (${dataBR(prazo)}).`
          : `Guia localizada; falta o comprovante para conferir o prazo (${dataBR(prazo)}).`,
    });
  }
  return out;
}

/**
 * Comprovantes e detalhamentos sem competência escrita são ligados à guia do mês pelo valor (mesmo valor = mesmo
 * recolhimento). VA/VR e VT não têm competência: guia e comprovante com o mesmo valor ficam "vinculados".
 */
export function vincularPorValor(arquivos = []) {
  const igual = (a, b) => a != null && b != null && Math.abs(a - b) < 0.01;
  const out = arquivos.map((a) => ({ ...a }));
  for (const [pagoTipo, guiaTipo, nome] of [
    ['fgts-pagamento', 'fgts-guia', 'guia FGTS'],
    ['darf-pagamento', 'darf', 'DARF'],
  ]) {
    const guias = out.filter((a) => a.tipo === guiaTipo && a.comp && a.valor);
    for (const a of out.filter((x) => x.tipo === pagoTipo && !x.comp && x.valor)) {
      const g = guias.find((x) => igual(x.valor, a.valor));
      if (g) {
        a.comp = g.comp;
        a.vinculo = `Mesmo valor da ${nome} de ${compBR(g.comp)} (${moeda(g.valor)}).`;
        if (!a.evidencia) a.evidencia = a.vinculo;
      }
    }
  }
  for (const [pagoTipo, guiaTipo] of [
    ['vavr-pagamento', 'vavr-guia'],
    ['vt-pagamento', 'vt-guia'],
  ]) {
    const guias = out.filter((a) => a.tipo === guiaTipo && a.valor);
    for (const a of out.filter((x) => x.tipo === pagoTipo && x.valor)) {
      const g = guias.find((x) => igual(x.valor, a.valor));
      if (g) {
        a.vinculado = g.vinculado = true;
        a.vinculo = g.vinculo = `Guia/nota e comprovante com o mesmo valor (${moeda(a.valor)}).`;
        if (!a.evidencia) a.evidencia = a.vinculo;
        if (!g.evidencia) g.evidencia = g.vinculo;
      }
    }
  }
  return out;
}

export const PAGAMENTO = {
  pago: { nome: 'Pago', cor: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  'nao-devido': { nome: 'Não devido', cor: 'bg-slate-50 text-slate-600 border-slate-200' },
  'sem-comprovante': { nome: 'Sem comprovante', cor: 'bg-red-50 text-red-800 border-red-300' },
  falta: { nome: 'Pagamento incompleto', cor: 'bg-red-50 text-red-800 border-red-300' },
  diferente: { nome: 'Valor diferente', cor: 'bg-orange-50 text-orange-800 border-orange-300' },
  'sem-guia': { nome: 'Sem guia', cor: 'bg-amber-50 text-amber-800 border-amber-300' },
  'sem-documentos': { nome: 'Sem documentos', cor: 'bg-red-50 text-red-800 border-red-300' },
  conferir: { nome: 'Conferir', cor: 'bg-teal-50 text-teal-800 border-teal-300' },
};

/**
 * Guias e pagamentos do mês: cada guia tem o comprovante do banco com o mesmo valor? Salários: os comprovantes
 * cobrem o líquido da folha? Sem comprovante, a providência é "colocar o comprovante do banco" na pasta.
 * @returns {{ id: string, nome: string, guia: number|null, pago: number|null, data: string|null, situacao: string, texto: string, ocr: boolean }[]}
 */
export function pagamentosDoMes(arquivos = [], { darfDevido = null, situacoes = {} } = {}) {
  const linhas = [];
  const soma = (l) => Math.round(l.reduce((s2, a) => s2 + (a.valor || 0), 0) * 100) / 100;
  const igual = (a, b) => Math.abs(a - b) < 0.01;
  const ultimo = (l) =>
    l
      .map((a) => a.pagoEm)
      .filter(Boolean)
      .sort()
      .at(-1) || null;
  const tipo = (t) => arquivos.filter((a) => a.tipo === t || a.tambem?.includes(t));
  const linha = (id, nome, guias, pagos, pasta) => {
    const vg = soma(guias);
    const vp = soma(pagos);
    const data = ultimo(pagos);
    let situacao;
    let texto;
    if (!guias.length && !pagos.length) {
      situacao = 'sem-documentos';
      texto = `Sem guia e sem comprovante: colocar a guia e o comprovante do banco na pasta ${pasta}.`;
    } else if (!pagos.length) {
      situacao = 'sem-comprovante';
      texto = `Guia${vg ? ` de ${moeda(vg)}` : ''} sem comprovante de pagamento: colocar o comprovante do banco na pasta ${pasta}.`;
    } else if (!guias.length) {
      situacao = 'sem-guia';
      texto = `Comprovante${vp ? ` de ${moeda(vp)}` : ''}${data ? ` (${dataBR(data)})` : ''} sem a guia: colocar a guia na pasta ${pasta}.`;
    } else if (vg && vp && (igual(vg, vp) || pagos.some((p) => guias.some((g) => igual(g.valor || 0, p.valor || 0))))) {
      situacao = 'pago';
      texto = `Pago: comprovante de ${moeda(vp)}${data ? ` em ${dataBR(data)}` : ''}, igual à guia.`;
    } else if (vg && vp) {
      situacao = 'diferente';
      texto = `Guia de ${moeda(vg)} e comprovante de ${moeda(vp)}: valores diferentes, conferir.`;
    } else {
      situacao = 'conferir';
      texto = 'Guia e comprovante localizados, mas sem valor legível: conferir.';
    }
    linhas.push({ id, nome, guia: vg || null, pago: vp || null, data, situacao, texto, ocr: [...guias, ...pagos].some((a) => a.ocr) });
  };

  // salários: o líquido da folha (todos os departamentos) × a soma dos comprovantes
  const folha = arquivos.find((a) => a.tipo === 'folha');
  const pagosSal = tipo('comp-salarios').filter((a) => !a.declaracaoBanco && !a.holerite);
  const vp = soma(pagosSal);
  const liq = folha?.liquido || null;
  const data = ultimo(pagosSal);
  let sal;
  if (!folha && !pagosSal.length) sal = ['sem-documentos', 'Sem folha e sem comprovantes de salário: colocar a folha analítica e os comprovantes do banco.'];
  else if (!pagosSal.length)
    sal = [
      'sem-comprovante',
      `Folha${liq ? ` com líquido de ${moeda(liq)}` : ''} sem comprovantes de pagamento: colocar os comprovantes do banco na pasta da folha.`,
    ];
  else if (!liq) sal = ['conferir', `Comprovantes somam ${moeda(vp)}; a folha não traz o total líquido para comparar.`];
  else if (vp + Math.max(1, liq * 0.005) >= liq)
    sal = [
      'pago',
      `Comprovantes somam ${moeda(vp)} para o líquido da folha de ${moeda(liq)}${vp - liq > Math.max(1, liq * 0.005) ? ` (${moeda(vp - liq)} a mais: adiantamentos, férias ou rescisões?)` : ''}.`,
    ];
  else sal = ['falta', `Comprovantes somam ${moeda(vp)} de ${moeda(liq)} líquidos da folha: faltam ${moeda(liq - vp)}. Colocar os comprovantes do banco.`];
  linhas.push({ id: 'salarios', nome: 'Salários', guia: liq, pago: vp || null, data, situacao: sal[0], texto: sal[1], ocr: pagosSal.some((a) => a.ocr) });

  linha('fgts', 'FGTS', tipo('fgts-guia'), tipo('fgts-pagamento'), 'FGTS');
  const darf = tipo('darf');
  const pagosDarf = tipo('darf-pagamento');
  if (darfDevido === false && !darf.length)
    linhas.push({
      id: 'inss',
      nome: 'INSS (DARF)',
      guia: null,
      pago: null,
      data: null,
      situacao: 'nao-devido',
      texto: 'A DCTFWeb não tem saldo a pagar: não há DARF no mês.',
      ocr: false,
    });
  else if (darfDevido || darf.length) {
    const perdcomp = pagosDarf.filter((a) => /PER\/DCOMP/.test(a.evidencia || ''));
    linha(
      'inss',
      'INSS (DARF)',
      darf,
      pagosDarf.filter((a) => !perdcomp.includes(a)),
      'INSS',
    );
    if (perdcomp.length && linhas.at(-1).situacao === 'sem-comprovante') {
      linhas.at(-1).situacao = 'conferir';
      linhas.at(-1).texto = 'DARF compensado por PER/DCOMP: conferir o recibo da compensação.';
    }
  }
  for (const [id, nome, pre, pasta] of [
    ['vavr', 'VA/VR', 'vavr', 'VA e VR'],
    ['vt', 'Vale-transporte', 'vt', 'VT'],
  ]) {
    const naoSeAplica = arquivos.some((a) => a.tipo === `${pre}-relacao` && a.houve === false);
    if (naoSeAplica) continue;
    linha(id, nome, tipo(`${pre}-guia`), tipo(`${pre}-pagamento`), pasta);
  }
  if (situacoes.demissoes?.valor) {
    const pagos = tipo('dem-comp');
    linhas.push({
      id: 'rescisoes',
      nome: 'Rescisões',
      guia: null,
      pago: soma(pagos) || null,
      data: ultimo(pagos),
      situacao: pagos.length ? 'pago' : 'sem-comprovante',
      texto: pagos.length
        ? `${pagos.length} ${pagos.length === 1 ? 'comprovante' : 'comprovantes'} de pagamento de rescisão${soma(pagos) ? ` (${moeda(soma(pagos))})` : ''}.`
        : 'Houve desligamento e não há comprovante de pagamento da rescisão: colocar o comprovante do banco.',
      ocr: pagos.some((a) => a.ocr),
    });
  }
  if (situacoes.ferias?.valor) {
    const pagos = tipo('fer-pagamento');
    linhas.push({
      id: 'ferias',
      nome: 'Férias',
      guia: null,
      pago: soma(pagos) || null,
      data: ultimo(pagos),
      situacao: pagos.length ? 'pago' : 'sem-comprovante',
      texto: pagos.length
        ? `Comprovante de pagamento de férias${soma(pagos) ? ` (${moeda(soma(pagos))})` : ''}.`
        : 'Houve férias e não há comprovante de pagamento: colocar o comprovante do banco.',
      ocr: pagos.some((a) => a.ocr),
    });
  }
  return linhas;
}

/**
 * Pessoas do mês: empregados na planilha × comprovantes de salário × folhas de ponto, e admissões/desligamentos
 * pela planilha, pela declaração e pelas subpastas de pessoas. Só números.
 */
export function coberturaDoMes(arquivos = [], pessoasPastas = {}) {
  const f = arquivos.find((a) => a.tipo === 'forca' && (a.ativos || a.linhas));
  const ativos = f ? f.ativos || 0 : null;
  const devidos = ativos == null ? null : Math.max(0, ativos - (f.afastados || 0));
  const salario = arquivos.filter((a) => a.tipo === 'comp-salarios' && !a.declaracaoBanco);
  const pagamentos = salario.reduce((s2, a) => s2 + (a.lote || (a.holerite ? 0 : 1)), 0);
  const holerites = salario.filter((a) => a.holerite).length;
  const folha = arquivos.find((a) => a.tipo === 'folha' && a.liquido);
  const somaSalarios = Math.round(salario.filter((a) => !a.holerite).reduce((s2, a) => s2 + (a.valor || 0), 0) * 100) / 100;
  const ponto = arquivos.filter((a) => a.tipo === 'ponto').length;
  const decl = (tipo) => {
    const d = arquivos.find((a) => a.tipo === tipo && a.houve != null);
    return d ? (d.houve ? d.pessoas || null : 0) : null;
  };
  return {
    temPlanilha: !!f,
    ativos,
    devidos,
    pagamentos,
    holerites,
    ponto,
    liquidoFolha: folha ? folha.liquido : null,
    funcionariosFolha: folha ? folha.funcionarios || null : null,
    somaSalarios,
    // subpastas só contam quando a prestadora organiza por pessoa; arquivos soltos na pasta não dizem quantas pessoas são
    admissoes: { planilha: f ? f.admissoes || 0 : null, declaracao: decl('decl-admissoes'), pastas: pessoasPastas.admissao || null },
    demissoes: { planilha: f ? f.demissoes || 0 : null, declaracao: decl('decl-demissoes'), pastas: pessoasPastas.demissao || null },
  };
}
const moeda = (v) => (v == null ? '' : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export { moeda };

/** Situações do mês: o que a prestadora declarou, o que tem nas pastas e o que a equipe marcou (manual vence) */
export function situacoesDoMes(arquivos = [], manual = {}) {
  /** @type {Record<string, { valor: boolean | null, fonte: string, contraditorio: boolean }>} */
  const out = {};
  for (const s of SITUACOES) {
    /** @type {boolean | null} */
    let v = null;
    let fonte = '';
    const decl = s.declaracao ? arquivos.filter((a) => a.tipo === s.declaracao && a.houve != null) : [];
    if (decl.length) {
      v = decl.some((a) => a.houve);
      fonte = 'declaração';
    }
    const naPasta = arquivos.some((a) => a.categoria === s.categoria);
    if (naPasta && v !== true) {
      v = true;
      fonte = decl.length ? 'pasta (a declaração diz que não houve)' : 'pasta';
    }
    // a planilha de força de trabalho mostra admissões e demissões com data no mês
    const naPlanilha = s.forca ? arquivos.some((a) => a.tipo === 'forca' && a[s.forca] > 0) : false;
    if (naPlanilha && v !== true) {
      v = true;
      fonte = decl.length ? 'planilha de força de trabalho (a declaração diz que não houve)' : 'planilha de força de trabalho';
    }
    if (v == null && s.padrao === false) {
      v = false;
      fonte = 'sem pasta no mês';
    }
    if (typeof manual[s.id] === 'boolean') {
      v = manual[s.id];
      fonte = 'marcado pela equipe';
    }
    out[s.id] = { valor: v, fonte, contraditorio: decl.length > 0 && !decl.some((a) => a.houve) && (naPasta || naPlanilha) };
  }
  return out;
}

/** Status de uma exigência a partir das evidências (arquivos do tipo) e da competência esperada */
function statusPorEvidencia(evid, comp) {
  if (evid.some((a) => a.semEscolha))
    return { status: 'divergencia', detalhe: 'A declaração não diz se houve ou não houve: apagar a opção que não se aplica e enviar de novo.' };
  const comComp = evid.filter((a) => a.comp);
  const certo = comComp.find((a) => a.comp === comp);
  if (certo) return { status: 'ok', detalhe: certo.vinculo || `Competência ${compBR(comp)} compatível com este mês.` };
  const vinculado = evid.find((a) => a.vinculado);
  if (vinculado) return { status: 'ok', detalhe: vinculado.vinculo };
  if (comComp.length) {
    const outra = comComp[0].comp;
    return { status: 'divergencia', detalhe: `O documento traz a competência ${compBR(outra)}, diferente da pasta ${compBR(comp)}.` };
  }
  const vig = evid.find((a) => a.vigencia);
  if (vig) {
    const [ini, fim] = vig.vigencia;
    if (ini <= fimDoMes(comp) && fim >= `${comp}-01`) return { status: 'ok', detalhe: `Vigente no mês (${dataBR(ini)} a ${dataBR(fim)}).` };
    return { status: 'divergencia', detalhe: `Vigência de ${dataBR(ini)} a ${dataBR(fim)}: não cobre ${compBR(comp)}.` };
  }
  const mes = Number(String(comp).slice(5));
  const informado = evid.find((a) => a.mesInformado);
  if (informado?.mesInformado === mes) return { status: 'ok', detalhe: `A descrição do pagamento informa o mês ${mes}.` };
  const decl = evid.filter((a) => a.mesDeclarado);
  if (decl.some((a) => a.mesDeclarado === comp)) return { status: 'ok', detalhe: `Declara o mês ${compBR(comp)}.` };
  if (decl.length) return { status: 'divergencia', detalhe: `A declaração cita ${nomeCompetencia(decl[0].mesDeclarado)}, não ${nomeCompetencia(comp)}.` };
  if (evid.every((a) => a.semTexto || a.imagem))
    return { status: 'conferir', detalhe: 'Digitalização ou imagem: conferir visualmente o conteúdo, o período e as assinaturas.' };
  return { status: 'conferir', detalhe: `Confirmar no conteúdo a competência ${compBR(comp)}; a pasta não comprova o período.` };
}

/**
 * Avalia um mês da prestadora.
 * @param {{ comp: string, arquivos?: any[] }} mes  arquivos lidos da pasta do mês (scripts/docpref-dados.mjs)
 * @param {{ hoje?: string, dia?: number, conf?: { situacoes?: Record<string, boolean>, itens?: Record<string, { status: string, motivo?: string }> },
 *   certAnteriores?: Record<string, string>, antesDoInicio?: boolean, naoAplica?: string[] }} [o]
 *   naoAplica: exigências que não se aplicam a esta prestadora em nenhum mês (ajuste do cadastro)
 */
export function avaliarMes(mes, o = {}) {
  const comp = mes.comp;
  const arquivos = vincularPorValor(mes.arquivos || []);
  const hoje = o.hoje || hojeISO();
  const prazo = prazoDe(comp, o.dia || 0);
  const diasParaPrazo = Math.round((Date.parse(prazo) - Date.parse(hoje)) / 86400e3);
  const manual = o.conf?.itens || {};
  const sit = situacoesDoMes(arquivos, o.conf?.situacoes || {});
  const mesEmCurso = hoje.slice(0, 7) <= comp; // o mês ainda não terminou: nada é cobrado
  const semArquivos = arquivos.length === 0;

  // DARF: devido se a DCTFWeb tem saldo a pagar
  const dctf = arquivos.filter((a) => (a.tipo === 'dctf-completa' || a.tipo === 'dctf-recibo') && a.saldo != null);
  const darfDevido = dctf.length ? dctf.some((a) => a.saldo > 0) : null;

  const itens = [];
  for (const g of GRUPOS) {
    const situacao = g.quando ? sit[g.quando] : null;
    const doGrupo = arquivos.filter((a) => g.categorias.includes(a.categoria));
    const soltos = doGrupo.filter((a) => !a.tipo);
    // VA/VR e VT: declaração de que não se aplica
    const declNa = g.naoSeAplica ? arquivos.some((a) => a.tipo === g.naoSeAplica && a.houve === false && a.categoria === 'declaracoes') : false;
    for (const i of g.itens) {
      const evid = arquivos.filter((a) => a.tipo === i.id || a.tambem?.includes(i.id));
      let st;
      if (o.naoAplica?.includes(i.id)) st = { status: 'na', detalhe: 'Não se aplica a esta prestadora (ajuste do cadastro).' };
      else if (evid.length) st = statusPorEvidencia(evid, comp);
      else if (g.quando && situacao?.valor === false) st = { status: 'na', detalhe: `Não houve (${situacao.fonte}).` };
      else if (i.quando === 'darf' && darfDevido === false) st = { status: 'na', detalhe: 'A DCTFWeb não tem saldo a pagar no mês.' };
      else if (declNa) st = { status: 'na', detalhe: 'A prestadora declarou que não se aplica.' };
      else if (soltos.length && !i.eventual)
        st = { status: 'candidato', detalhe: `Há ${soltos.length} ${soltos.length === 1 ? 'arquivo' : 'arquivos'} na pasta a classificar.` };
      else if (i.eventual) st = { status: 'eventual', detalhe: 'Enviar só se houve no mês.' };
      else if (g.quando && situacao?.valor == null) st = { status: 'ocorrencia', detalhe: 'Informar se houve no mês.' };
      else if (i.quando === 'darf' && darfDevido == null) st = { status: 'ocorrencia', detalhe: 'Sem a DCTFWeb não dá para saber se há DARF a pagar.' };
      else if (g.naoSeAplica) st = { status: 'faltando', detalhe: 'Enviar os documentos ou a declaração de que não se aplica.' };
      else st = { status: 'faltando', detalhe: 'Solicitar o documento da competência ou esclarecer a aplicação.' };
      const m = manual[i.id];
      const auto = st.status;
      if (m && m.status && m.status !== 'pendente')
        st = { status: m.status, detalhe: m.status === 'recusado' ? m.motivo || 'Recusado na conferência.' : 'Marcado pela equipe.' };
      itens.push({
        ...i,
        grupo: g.id,
        pasta: g.pasta,
        status: st.status,
        auto,
        manual: !!(m && m.status && m.status !== 'pendente'),
        marcadoEm: m && m.status && m.status !== 'pendente' ? m.em || null : null,
        detalhe: st.detalhe,
        evidencias: evid.map((a) => a.rotulo),
        competenciaLida: evid.find((a) => a.comp)?.comp || evid.find((a) => a.mesDeclarado)?.mesDeclarado || null,
      });
    }
  }

  // certidões
  const par = Number(comp.slice(5)) % 2 === 0;
  const certidoes = CERTIDOES.map((c) => {
    const evid = arquivos.filter((a) => a.tipo === c.id);
    const exigida = !c.pares || par;
    const anterior = o.certAnteriores?.[c.id] || null; // validade da última apresentada antes deste mês
    let status;
    let detalhe;
    const validade =
      evid
        .map((a) => a.validade)
        .filter(Boolean)
        .sort()
        .at(-1) || null;
    if (o.naoAplica?.includes(c.id)) {
      status = 'na';
      detalhe = 'Não se aplica a esta prestadora (ajuste do cadastro).';
    } else if (evid.length) {
      if (validade && validade < fimDoMes(comp)) {
        status = 'vencida';
        detalhe = `Validade até ${dataBR(validade)}: vencida antes do fim da competência.`;
      } else if (validade) {
        status = 'ok';
        detalhe = `Válida até ${dataBR(validade)}.`;
      } else {
        status = 'conferir';
        detalhe = 'Validade não identificada no arquivo: registrar a data.';
      }
    } else if (exigida) {
      status = 'faltando';
      detalhe = `Apresentar uma certidão válida no pacote ${compBR(comp)} até ${dataBR(prazo)} (${c.pares ? 'meses pares' : 'todo mês'}). Uma certidão ainda válida pode ser reapresentada.`;
    } else if (anterior && anterior <= fimDoMes(comp)) {
      status = 'renovar';
      detalhe = `A última apresentada vale até ${dataBR(anterior)}: renovar neste mês.`;
    } else {
      status = 'na';
      detalhe = anterior ? `Apresentação nos meses pares; a última vale até ${dataBR(anterior)}.` : 'Apresentação nos meses pares.';
    }
    const m = manual[c.id];
    const auto = status;
    if (m && m.status && m.status !== 'pendente') {
      status = m.status;
      detalhe = m.status === 'recusado' ? m.motivo || 'Recusada na conferência.' : 'Marcado pela equipe.';
    }
    const manualC = !!(m && m.status && m.status !== 'pendente');
    return { ...c, exigida, status, auto, manual: manualC, marcadoEm: manualC ? m.em || null : null, detalhe, validade, evidencias: evid.map((a) => a.rotulo) };
  });

  // guias e pagamentos; pagamento incompleto ou com valor diferente da guia vira divergência (a equipe pode marcar como conferido)
  const pagamentos = pagamentosDoMes(arquivos, { darfDevido, situacoes: sit });
  for (const [pagId, itemId] of [
    ['salarios', 'comp-salarios'],
    ['fgts', 'fgts-pagamento'],
    ['inss', 'darf-pagamento'],
    ['vavr', 'vavr-pagamento'],
    ['vt', 'vt-pagamento'],
  ]) {
    const pg = pagamentos.find((x) => x.id === pagId);
    const it = itens.find((x) => x.id === itemId);
    if (!pg || !it || it.manual || !['falta', 'diferente'].includes(pg.situacao) || !['ok', 'conferir'].includes(it.status)) continue;
    it.status = 'divergencia';
    it.auto = 'divergencia';
    it.detalhe = pg.texto;
  }

  const todos = [...itens, ...certidoes];
  const travam = todos.filter((i) => STATUS[i.status]?.trava);
  const pendencias = travam.filter((i) => i.status !== 'recusado');
  const recusados = travam.filter((i) => i.status === 'recusado').map((i) => ({ ...i, motivo: i.detalhe }));
  const conta = (s) => todos.filter((i) => i.status === s).length;
  const recebidos = itens.filter((i) => i.status === 'ok' || i.status === 'conferir').length;
  const naoLocalizados = itens.filter((i) => i.status === 'faltando').length;
  const certPendentes = certidoes.filter((c) => ['faltando', 'vencida', 'renovar'].includes(c.status)).length;

  let sinal;
  let titulo;
  if (o.antesDoInicio) {
    sinal = 'fora';
    titulo = 'Antes do início do contrato: nada a cobrar';
  } else if (mesEmCurso) {
    sinal = 'futuro';
    titulo = `Mês em curso: os documentos vencem em ${dataBR(prazo)}`;
  } else if (semArquivos && diasParaPrazo >= 0) {
    sinal = 'aguardando';
    titulo = `Aguardando o envio: prazo ${dataBR(prazo)}`;
  } else if (!travam.length) {
    sinal = 'pagar';
    titulo = `Pode pagar: documentos do mês recebidos${conta('conferir') ? ` (${conta('conferir')} a conferir o conteúdo)` : ''}`;
  } else if (diasParaPrazo >= 0) {
    sinal = 'aguardando';
    titulo = `Não pagar ainda: ${travam.length} ${travam.length === 1 ? 'pendência' : 'pendências'} · prazo ${dataBR(prazo)}`;
  } else {
    sinal = 'travar';
    titulo = semArquivos ? 'Travar o pagamento: nada foi enviado' : `Travar o pagamento: ${travam.length} ${travam.length === 1 ? 'pendência' : 'pendências'}`;
  }

  const av = {
    comp,
    prazo,
    diasParaPrazo,
    prazoEncerrado: diasParaPrazo < 0,
    sinal,
    titulo,
    situacoes: sit,
    darfDevido,
    itens,
    certidoes,
    pendencias,
    recusados,
    arquivos,
    // "Definir ocorrência" trava, mas não entra na conta de exigidos: ainda não se sabe se o documento é devido
    total: todos.filter((i) => !['na', 'eventual', 'ocorrencia'].includes(i.status)).length,
    conferidos: todos.filter((i) => ['ok', 'conferir'].includes(i.status)).length,
    /** @type {{ nivel: string, titulo: string, texto: string }[]} */
    achados: [],
    pastaExiste: true,
    cobertura: coberturaDoMes(arquivos, mes.pessoas || {}),
    prazosLegais: prazosLegais(comp, arquivos),
    pagamentos,
    /** % de regularidade (exigências recebidas ÷ exigidas), como a "performance" das plataformas de terceiros */
    regularidade: null,
    indicadores: indicadoresDoMes(arquivos, sit),
    resumo: {
      arquivos: arquivos.length,
      recebidos,
      naoLocalizados,
      aDefinir: conta('ocorrencia') + conta('candidato'),
      divergencias: conta('divergencia'),
      certPendentes,
      aConferir: conta('conferir'),
    },
  };
  av.regularidade = o.antesDoInicio || mesEmCurso ? null : av.total ? Math.round((av.conferidos / av.total) * 100) : 100;
  const cob = av.cobertura;
  if (cob.devidos) {
    const sal = itens.find((i) => i.id === 'comp-salarios');
    if (sal && sal.evidencias.length)
      sal.detalhe = `${sal.detalhe} ${cob.pagamentos} ${cob.pagamentos === 1 ? 'pagamento' : 'pagamentos'} para ${cob.devidos} ${cob.devidos === 1 ? 'empregado' : 'empregados'} na planilha.`;
    const pt = itens.find((i) => i.id === 'ponto');
    if (pt && pt.evidencias.length)
      pt.detalhe = `${pt.detalhe} ${cob.ponto} ${cob.ponto === 1 ? 'arquivo' : 'arquivos'} para ${cob.devidos} ${cob.devidos === 1 ? 'empregado' : 'empregados'}.`;
  }
  av.achados = achadosDoMes(av);
  return av;
}

/**
 * Indicadores do mês tirados da planilha de força de trabalho e das declarações (só contagens):
 * ativos, admissões/alocações, desligamentos, afastados, turnover e acidente.
 */
export function indicadoresDoMes(arquivos = [], sit = {}) {
  const f = arquivos.find((a) => a.tipo === 'forca' && (a.ativos || a.linhas));
  const acidente = sit.acidente?.valor ?? null;
  if (!f) return { temPlanilha: false, acidente };
  const ativos = f.ativos || 0;
  const adm = f.admissoes || 0;
  const dem = f.demissoes || 0;
  return {
    temPlanilha: true,
    ativos,
    inativos: f.inativos || 0,
    admissoes: adm,
    demissoes: dem,
    afastados: f.afastados || 0,
    turnover: ativos ? Math.round((((adm + dem) / 2) * 1000) / ativos) / 10 : null,
    acidente,
  };
}

/** O que a leitura encontrou de diferente no conteúdo (sem dados pessoais) */
export function achadosDoMes(av) {
  const { comp, arquivos } = av;
  const out = [];
  const add = (nivel, titulo, texto) => out.push({ nivel, titulo, texto });
  const nomeItem = (id) => GRUPOS.flatMap((g) => g.itens).find((i) => i.id === id)?.nome || id;

  for (const a of arquivos.filter((x) => x.mesDeclarado && x.mesDeclarado !== comp))
    add(
      'alerta',
      `${nomeItem(a.tipo)} cita outro mês`,
      `A declaração arquivada em ${nomeCompetencia(comp)} informa ${nomeCompetencia(a.mesDeclarado)}. A competência declarada não corresponde à pasta.`,
    );
  for (const a of arquivos.filter((x) => x.tipo?.startsWith('decl-') && !x.mesDeclarado && !x.semTexto && x.categoria === 'declaracoes'))
    add(
      'info',
      `${nomeItem(a.tipo)} sem competência explícita`,
      'O corpo da declaração não identifica o mês; a data de assinatura não substitui essa informação.',
    );

  const contradiz = Object.entries(av.situacoes || {}).filter(([, s]) => s.contraditorio);
  for (const [id] of contradiz) {
    const s = SITUACOES.find((x) => x.id === id);
    add(
      'alerta',
      `Declaração e pasta não batem (${s.pergunta.replace(/\?$/, '').toLowerCase()})`,
      `A declaração diz que não houve, mas ${av.situacoes[id].fonte.startsWith('planilha') ? 'a planilha de força de trabalho tem datas' : 'a pasta tem documentos'} do assunto no mês.`,
    );
  }

  // guia x comprovante
  const par = (guiaTipo, compTipo, nome) => {
    const guia = arquivos.find((a) => a.tipo === guiaTipo && a.valor);
    const pagos = arquivos.filter((a) => a.tipo === compTipo && a.valor);
    if (!guia || !pagos.length) return;
    // guia × comprovante (pago, sem comprovante, valor diferente) fica na seção "Guias e pagamentos"
    if (guia.vencimento) {
      const atrasado = pagos.filter((a) => a.pagoEm && a.pagoEm > guia.vencimento);
      if (atrasado.length)
        add(
          'alerta',
          `${nome}: pago depois do vencimento da guia`,
          `Vencimento da guia ${dataBR(guia.vencimento)}; pagamento em ${dataBR(atrasado[0].pagoEm)}.`,
        );
    }
  };
  par('fgts-guia', 'fgts-pagamento', 'FGTS');
  par('darf', 'darf-pagamento', 'DARF');
  par('vavr-guia', 'vavr-pagamento', 'VA/VR');
  par('vt-guia', 'vt-pagamento', 'VT');

  for (const p of av.prazosLegais || []) {
    if (p.situacao === 'atraso') add('alerta', `${p.nome.replace(/ \(.*\)$/, '')} fora do prazo legal`, p.texto);
    else if (p.situacao === 'retificadora') add('info', 'DCTFWeb retificadora', p.texto);
  }
  for (const pg of av.pagamentos || []) {
    if (pg.situacao === 'falta') add('alerta', `${pg.nome}: pagamento incompleto`, pg.texto);
    else if (pg.situacao === 'diferente') add('alerta', `${pg.nome}: comprovante diferente da guia`, pg.texto);
  }
  // retenção de 11% sobre a nota fiscal (art. 31 da Lei 8.212/91): o contratante retém e a prestadora usa na DCTFWeb
  const cred = arquivos.find((a) => a.tipo === 'dctf-creditos' && a.retencao);
  if (cred) {
    const { informada, usada, saldo } = cred.retencao;
    const perdcomp = arquivos.find((a) => a.tipo === 'darf-pagamento' && a.valor && saldo && Math.abs(a.valor - saldo) < 0.01);
    add(
      'info',
      'Retenção de 11% do INSS na nota fiscal',
      `A DCTFWeb declara ${moeda(informada)} retidos pelos contratantes (Lei 9.711/98); ${moeda(usada)} quitaram o INSS do mês${saldo ? ` e sobraram ${moeda(saldo)}${perdcomp ? `, pedidos em restituição no PER/DCOMP` : ''}` : ''}. Conferir com as retenções feitas nas notas fiscais pagas pela contratante.`,
    );
  }
  // declaração do banco reaproveitada de outro mês
  for (const d of arquivos.filter((a) => a.declaracaoBanco && a.emitidaEm)) {
    const mesDoc = d.emitidaEm.slice(0, 7);
    if (![comp, proximaComp(comp), proximaComp(comp, 2)].includes(mesDoc))
      add(
        'alerta',
        'Declaração do banco de outro mês',
        `A declaração de pagamentos do banco foi emitida em ${dataBR(d.emitidaEm)}, mas está na pasta de ${compBR(comp)}. Pedir a declaração ou o extrato do pagamento desta competência.`,
      );
  }
  const cob = av.cobertura;
  if (cob?.devidos) {
    const digitalizados = arquivos.filter((a) => a.categoria === 'fopag' && !a.tipo).length;
    // sem nenhum comprovante, o item "comprovantes de salário" já aparece como não localizado
    if (cob.pagamentos > 0 && cob.pagamentos < cob.devidos)
      add(
        'alerta',
        'Comprovantes de salário não cobrem todos',
        `${cob.pagamentos} ${cob.pagamentos === 1 ? 'pagamento localizado' : 'pagamentos localizados'} para ${cob.devidos} empregados ativos na planilha${cob.holerites ? ` (e ${cob.holerites} holerite(s))` : ''}${digitalizados ? `; há ${digitalizados} arquivo(s) não identificado(s) na pasta da folha` : ''}.`,
      );
    if (cob.ponto > 1 && cob.ponto < cob.devidos)
      add('alerta', 'Folhas de ponto não cobrem todos', `${cob.ponto} arquivos de ponto para ${cob.devidos} empregados ativos na planilha.`);
    else if (cob.ponto === 1 && cob.devidos > 1)
      add('info', 'Ponto em arquivo único', `Conferir se o arquivo cobre os ${cob.devidos} empregados ativos da planilha.`);
  }
  for (const [chave, nome] of [
    ['admissoes', 'Admissões'],
    ['demissoes', 'Desligamentos'],
  ]) {
    const c = cob?.[chave];
    if (!c) continue;
    const fontes = [
      ['planilha', c.planilha],
      ['declaração', c.declaracao],
      ['subpastas de pessoas', c.pastas],
    ].filter(([, v]) => v != null);
    if (fontes.length >= 2 && new Set(fontes.map(([, v]) => v)).size > 1)
      add('alerta', `${nome} não batem`, `${fontes.map(([k, v]) => `${k}: ${v}`).join(' · ')}. Conferir quem entrou ou saiu no mês.`);
  }
  if (av.darfDevido === false) add('info', 'DCTFWeb sem saldo a pagar', 'O débito do mês foi coberto por retenções/compensações: não há DARF a pagar.');
  else if (av.darfDevido) add('info', 'DCTFWeb com saldo a pagar', 'Há DARF previdenciário a pagar: exigir a guia e o comprovante (ou o PER/DCOMP).');

  const cct = arquivos.find((a) => a.tipo === 'convencao' && a.vigencia);
  if (cct) {
    const [ini, fim] = cct.vigencia;
    const cobre = ini <= `${comp}-31` && fim >= `${comp}-01`;
    add(
      cobre ? 'info' : 'alerta',
      cobre ? `Convenção coletiva vigente em ${compBR(comp)}` : 'Convenção coletiva fora da vigência',
      `Vigência de ${dataBR(ini)} a ${dataBR(fim)}.${cobre ? ' Confirmar a categoria e o contrato.' : ' Pedir a versão atual.'}`,
    );
  }

  const terceiros = arquivos.filter((a) => a.terceiro).length;
  if (terceiros)
    add(
      'alerta',
      'Salário pago a outra pessoa',
      `${terceiros} ${terceiros === 1 ? 'comprovante de salário foi pago' : 'comprovantes de salário foram pagos'} a um nome diferente do empregado do arquivo. Pedir a justificativa (conta de terceiro).`,
    );

  const forca = arquivos.find((a) => a.tipo === 'forca' && a.comp);
  if (forca && forca.comp !== comp)
    add('alerta', 'Força de trabalho de outro mês', `A planilha informa a competência ${compBR(forca.comp)}, mas está na pasta de ${compBR(comp)}.`);
  if (forca && forca.ativos)
    add(
      'info',
      'Força de trabalho',
      `${forca.ativos} ativos e ${forca.inativos || 0} inativos na planilha${
        forca.admissoes || forca.demissoes || forca.afastados
          ? `; no mês: ${forca.admissoes || 0} ${forca.admissoes === 1 ? 'admissão/alocação' : 'admissões/alocações'}, ${forca.demissoes || 0} ${forca.demissoes === 1 ? 'desligamento' : 'desligamentos'} e ${forca.afastados || 0} ${forca.afastados === 1 ? 'afastado' : 'afastados'}`
          : ''
      }.`,
    );

  const porOcr = arquivos.filter((a) => a.ocr).length;
  const semLeitura = arquivos.filter((a) => a.semTexto && (a.imagem || a.extensao === 'pdf')).length;
  if (porOcr)
    add(
      'info',
      'Documentos lidos por OCR',
      `${porOcr} ${porOcr === 1 ? 'digitalização ou foto foi lida' : 'digitalizações ou fotos foram lidas'} por reconhecimento de texto: valores e datas podem ter erro de leitura; conferir no documento.`,
    );
  if (semLeitura)
    add(
      'info',
      'Digitalizações exigem conferência visual',
      `${semLeitura} ${semLeitura === 1 ? 'arquivo sem texto legível' : 'arquivos sem texto legível'} (fotos de ponto escritas à mão, imagens ruins). A leitura automática não comprova conteúdo, assinatura nem cobertura de todas as pessoas.`,
    );
  const crf = av.certidoes?.find((c) => c.id === 'crf');
  if (crf && crf.status === 'faltando' && arquivos.length)
    add(
      'alerta',
      'CRF não identificado',
      'Nenhum Certificado de Regularidade do FGTS pelo nome ou pelo texto dos PDFs. Pode estar num documento combinado ou digitalizado: confirmar.',
    );
  return out;
}

/**
 * Avalia todos os meses de uma prestadora (as certidões dependem dos meses anteriores).
 * @param {{ meses: { comp: string, arquivos: any[] }[] }} empresa
 * @param {{ hoje?: string, dia?: number, inicio?: string, ate?: string, conferencias?: Record<string, any>, naoAplica?: string[] }} [o]
 *   conferencias: { "AAAA-MM": conf }
 */
export function avaliarEmpresa(empresa, o = {}) {
  const hoje = o.hoje || hojeISO();
  const porComp = new Map((empresa?.meses || []).map((m) => [m.comp, m]));
  const comArquivos = [...porComp.values()]
    .filter((m) => m.arquivos?.length)
    .map((m) => m.comp)
    .sort();
  const inicio = o.inicio || comArquivos[0] || [...porComp.keys()].sort()[0] || competenciaAtual(new Date(hoje + 'T12:00:00'));
  const todas = [...porComp.keys(), ...(o.ate ? [o.ate] : [])].sort();
  const ultima = [todas.at(-1) || inicio, competenciaAtual(new Date(hoje + 'T12:00:00'))].sort().at(-1);
  const primeira = [...porComp.keys(), inicio].sort()[0];
  const lista = [];
  for (let c = primeira; c <= ultima; c = proximaComp(c)) lista.push(c);
  const certAnteriores = {};
  return lista.map((comp) => {
    const mes = porComp.get(comp) || { comp, arquivos: [] };
    const av = avaliarMes(mes, {
      hoje,
      dia: o.dia,
      conf: o.conferencias?.[comp],
      certAnteriores: { ...certAnteriores },
      antesDoInicio: comp < inicio,
      naoAplica: o.naoAplica,
    });
    av.pastaExiste = porComp.has(comp);
    for (const c of av.certidoes) if (c.validade) certAnteriores[c.id] = c.validade;
    return av;
  });
}

export const VENCIMENTO = {
  vencido: { nome: 'Vencido', cor: 'bg-red-50 text-red-800 border-red-300' },
  'a-vencer': { nome: 'A vencer', cor: 'bg-amber-50 text-amber-800 border-amber-300' },
  valido: { nome: 'Válido', cor: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  'sem-validade': { nome: 'Validade não identificada', cor: 'bg-slate-50 text-slate-600 border-slate-200' },
  nunca: { nome: 'Nunca apresentado', cor: 'bg-red-50 text-red-800 border-red-300' },
};

/**
 * Vencimentos da prestadora: a última certidão (e documento da empresa) apresentada em qualquer mês e quando vence.
 * Válido / a vencer (até `dias` dias) / vencido, como o relatório "A vencer" das plataformas de terceiros.
 * @param {{ meses?: { comp: string, arquivos: any[] }[] }} empresa
 */
export function vencimentos(empresa, { hoje = hojeISO(), dias = 30 } = {}) {
  const todos = [
    ...(empresa?.meses || []).flatMap((m) => (m.arquivos || []).map((a) => ({ ...a, mes: m.comp }))),
    ...(empresa?.documentos || []).map((a) => ({ ...a, mes: '' })),
  ];
  const out = [];
  for (const d of [...CERTIDOES.map((c) => ({ ...c, certidao: true })), ...DOCUMENTOS_EMPRESA]) {
    const lista = todos.filter((a) => a.tipo === d.id);
    if (!lista.length) {
      if (d.certidao) out.push({ id: d.id, nome: d.nome, status: 'nunca', validade: null, mes: null, dias: null });
      continue;
    }
    const comValidade = lista.filter((a) => a.validade).sort((a, b) => a.validade.localeCompare(b.validade));
    const ultimo = comValidade.at(-1) || lista.sort((a, b) => a.mes.localeCompare(b.mes)).at(-1);
    const validade = ultimo.validade || null;
    const faltam = validade ? Math.round((Date.parse(validade) - Date.parse(hoje)) / 86400e3) : null;
    const status = !validade ? 'sem-validade' : faltam < 0 ? 'vencido' : faltam <= dias ? 'a-vencer' : 'valido';
    out.push({ id: d.id, nome: d.nome, status, validade, mes: ultimo.mes, dias: faltam });
  }
  const ordem = ['vencido', 'nunca', 'a-vencer', 'sem-validade', 'valido'];
  return out.sort((a, b) => ordem.indexOf(a.status) - ordem.indexOf(b.status) || String(a.validade).localeCompare(String(b.validade)));
}

/** Performance do período: exigências exigidas × recebidas nos meses com prazo encerrado */
export function performance(avs) {
  const meses = avs.filter((a) => a.sinal !== 'futuro' && a.sinal !== 'fora' && a.prazoEncerrado);
  const exigidos = meses.reduce((s, a) => s + a.total, 0);
  const recebidos = meses.reduce((s, a) => s + a.conferidos, 0);
  return {
    meses: meses.length,
    exigidos,
    recebidos,
    regularidade: exigidos ? Math.round((recebidos / exigidos) * 100) : null,
    travados: meses.filter((a) => a.sinal === 'travar').length,
  };
}

// ---------------------------------------------------------------- planilhas (Excel), como os "Exportar para o Excel"

const pct = (v) => (v == null ? '' : { v, tipo: 'numero' });

/** Excel do ano de uma prestadora: meses, cobranças e achados */
export function abasAno(nomeEmpresa, ano, avs) {
  const doAno = avs.filter((a) => a.comp.startsWith(String(ano)));
  const neutro = (a) => a.sinal === 'futuro' || a.sinal === 'fora';
  return [
    {
      nome: 'Meses',
      colunas: [
        { titulo: 'Mês', largura: 9 },
        { titulo: 'Envio até', largura: 11 },
        { titulo: 'Prazo', largura: 16 },
        { titulo: 'Arquivos', largura: 9, tipo: 'numero' },
        { titulo: 'Exigidos', largura: 9, tipo: 'numero' },
        { titulo: 'Recebidos', largura: 10, tipo: 'numero' },
        { titulo: '% regularidade', largura: 13, tipo: 'numero' },
        { titulo: 'Não localizados', largura: 13, tipo: 'numero' },
        { titulo: 'Divergências', largura: 12, tipo: 'numero' },
        { titulo: 'A definir ou classificar', largura: 14, tipo: 'numero' },
        { titulo: 'Certidões pendentes', largura: 13, tipo: 'numero' },
        { titulo: 'Ativos', largura: 8, tipo: 'numero' },
        { titulo: 'Admissões', largura: 10, tipo: 'numero' },
        { titulo: 'Desligamentos', largura: 12, tipo: 'numero' },
        { titulo: 'Turnover %', largura: 10, tipo: 'numero' },
        { titulo: 'Semáforo', largura: 26 },
      ],
      linhas: doAno.map((a) => [
        compBR(a.comp),
        dataBR(a.prazo),
        neutro(a) ? '' : a.prazoEncerrado ? 'Prazo encerrado' : 'Dentro do prazo',
        a.resumo.arquivos,
        neutro(a) ? '' : a.total,
        neutro(a) ? '' : a.conferidos,
        pct(a.regularidade),
        neutro(a) ? '' : a.resumo.naoLocalizados,
        neutro(a) ? '' : a.resumo.divergencias,
        neutro(a) ? '' : a.resumo.aDefinir,
        neutro(a) ? '' : a.resumo.certPendentes,
        a.indicadores.temPlanilha ? a.indicadores.ativos : '',
        a.indicadores.temPlanilha ? a.indicadores.admissoes : '',
        a.indicadores.temPlanilha ? a.indicadores.demissoes : '',
        a.indicadores.turnover == null ? '' : { v: a.indicadores.turnover, tipo: 'numero' },
        nomeSinal(a.sinal),
      ]),
    },
    {
      nome: 'Cobranças',
      colunas: [
        { titulo: 'Mês', largura: 9 },
        { titulo: 'Pasta', largura: 22 },
        { titulo: 'Exigência', largura: 50 },
        { titulo: 'Situação', largura: 22 },
        { titulo: 'Providência', largura: 70 },
        { titulo: 'Prazo', largura: 11 },
      ],
      linhas: doAno
        .filter((a) => !neutro(a))
        .flatMap((a) =>
          [...a.recusados, ...a.pendencias].map((p) => [
            compBR(a.comp),
            p.pasta || 'Certidões',
            p.nome,
            STATUS[p.status]?.nome || p.status,
            p.detalhe,
            dataBR(a.prazo),
          ]),
        ),
    },
    {
      nome: 'Achados',
      colunas: [
        { titulo: 'Mês', largura: 9 },
        { titulo: 'Nível', largura: 9 },
        { titulo: 'Achado', largura: 45 },
        { titulo: 'Detalhe', largura: 90 },
      ],
      linhas: doAno.flatMap((a) => a.achados.map((x) => [compBR(a.comp), x.nivel === 'alerta' ? 'Atenção' : 'Info', x.titulo, x.texto])),
    },
  ].map((aba) => ({ ...aba, nome: aba.nome.slice(0, 31) }));
}

/** Excel de um mês: exigências, certidões, arquivos e achados */
export function abasMes(av) {
  const linhaItem = (i) => [
    i.pasta || 'Certidões',
    i.nome,
    STATUS[i.status]?.nome || i.status,
    STATUS[i.auto]?.nome || i.auto,
    i.manual ? `Sim${i.marcadoEm ? ` (${dataBR(i.marcadoEm)})` : ''}` : '',
    i.competenciaLida ? compBR(i.competenciaLida) : i.validade ? `validade ${dataBR(i.validade)}` : '',
    (i.evidencias || []).length,
    i.detalhe,
  ];
  return [
    {
      nome: 'Exigências',
      colunas: [
        { titulo: 'Pasta', largura: 22 },
        { titulo: 'Exigência', largura: 50 },
        { titulo: 'Situação', largura: 24 },
        { titulo: 'Leitura automática', largura: 24 },
        { titulo: 'Marcado pela equipe', largura: 16 },
        { titulo: 'Competência / validade', largura: 18 },
        { titulo: 'Arquivos', largura: 9, tipo: 'numero' },
        { titulo: 'Evidência e providência', largura: 80 },
      ],
      linhas: [...av.itens, ...av.certidoes.filter((c) => c.exigida || c.status !== 'na')].map(linhaItem),
    },
    {
      nome: 'Prazos e pessoas',
      colunas: [
        { titulo: 'Conferência', largura: 46 },
        { titulo: 'Prazo', largura: 11 },
        { titulo: 'Data lida', largura: 11 },
        { titulo: 'Situação', largura: 14 },
        { titulo: 'Detalhe', largura: 80 },
      ],
      linhas: [
        ...(av.prazosLegais || []).map((p) => [p.nome, dataBR(p.prazo), dataBR(p.data), PRAZO_NOME[p.situacao] || p.situacao, p.texto]),
        ...linhasCobertura(av.cobertura).map(([k, v]) => [k, '', '', '', v]),
      ],
    },
    {
      nome: 'Arquivos',
      colunas: [
        { titulo: 'Arquivo', largura: 50 },
        { titulo: 'Pasta', largura: 22 },
        { titulo: 'Competência', largura: 12 },
        { titulo: 'Evidência', largura: 60 },
        { titulo: 'Valor', largura: 14, tipo: 'moeda' },
        { titulo: 'Pago em', largura: 11 },
        { titulo: 'Transmissão', largura: 11 },
      ],
      linhas: av.arquivos.map((a) => [
        a.rotulo,
        a.pasta || '',
        a.comp ? compBR(a.comp) : a.imagem ? 'imagem' : a.semTexto ? 'sem texto' : '',
        a.evidencia || '',
        typeof a.valor === 'number' ? a.valor : '',
        dataBR(a.pagoEm),
        dataBR(a.transmissao),
      ]),
    },
    {
      nome: 'Achados',
      colunas: [
        { titulo: 'Nível', largura: 9 },
        { titulo: 'Achado', largura: 45 },
        { titulo: 'Detalhe', largura: 90 },
      ],
      linhas: av.achados.map((x) => [x.nivel === 'alerta' ? 'Atenção' : 'Info', x.titulo, x.texto]),
    },
  ];
}

/**
 * Excel do farol: uma linha por prestadora, uma coluna por mês (semáforo e % de regularidade) e os vencimentos.
 * @param {{ nome: string, avs: any[], venc: any[] }[]} lista
 */
export function abasFarol(lista, comps, { dias = 30 } = {}) {
  return [
    {
      nome: 'Farol',
      colunas: [
        { titulo: 'Prestadora', largura: 34 },
        ...comps.map((c) => ({ titulo: compBR(c), largura: 18 })),
        { titulo: 'Exigidos', largura: 9, tipo: 'numero' },
        { titulo: 'Recebidos', largura: 10, tipo: 'numero' },
        { titulo: '% regularidade', largura: 13, tipo: 'numero' },
        { titulo: 'Meses travados', largura: 13, tipo: 'numero' },
      ],
      linhas: lista.map(({ nome, avs }) => {
        const doPeriodo = avs.filter((a) => comps.includes(a.comp));
        const p = performance(doPeriodo);
        return [
          nome,
          ...comps.map((c) => {
            const a = avs.find((x) => x.comp === c);
            return a ? `${nomeSinal(a.sinal)}${a.regularidade != null ? ` (${a.regularidade}%)` : ''}` : '';
          }),
          p.exigidos,
          p.recebidos,
          pct(p.regularidade),
          p.travados,
        ];
      }),
    },
    {
      nome: 'Vencimentos',
      colunas: [
        { titulo: 'Prestadora', largura: 34 },
        { titulo: 'Documento', largura: 50 },
        { titulo: 'Situação', largura: 22 },
        { titulo: 'Validade', largura: 11 },
        { titulo: 'Dias', largura: 7, tipo: 'numero' },
        { titulo: 'Pasta do mês', largura: 12 },
      ],
      linhas: lista.flatMap(({ nome, venc }) =>
        venc.map((v) => [nome, v.nome, VENCIMENTO[v.status]?.nome || v.status, dataBR(v.validade), v.dias == null ? '' : v.dias, v.mes ? compBR(v.mes) : '']),
      ),
    },
    {
      nome: 'Leia-me',
      colunas: [{ titulo: 'Como ler', largura: 120 }],
      linhas: [
        ['% regularidade = exigências recebidas ÷ exigidas, nos meses com prazo encerrado.'],
        [`A vencer = vence em até ${dias} dias. Vencido = a última apresentada já venceu. Nunca apresentado = nenhuma na pasta.`],
      ],
    },
  ];
}

const SINAL_NOME = {
  pagar: 'Pode pagar',
  aguardando: 'Aguardando / dentro do prazo',
  travar: 'Travar pagamento',
  futuro: 'Mês em curso',
  fora: 'Antes do início',
};
export const nomeSinal = (s) => SINAL_NOME[s] || s;

/**
 * Base legal nos contratos públicos (Lei nº 14.133/2021): art. 50 (comprovação das obrigações trabalhistas e do FGTS nos
 * serviços com dedicação exclusiva de mão de obra) e art. 121, §§ 2º e 3º (responsabilidade da Administração e pagamento
 * condicionado à quitação das obrigações trabalhistas, quando previsto no edital ou no contrato).
 */
export const FUNDAMENTO_LEGAL =
  'Fundamento: art. 50 da Lei nº 14.133/2021 (comprovação mensal das obrigações trabalhistas, previdenciárias e do FGTS) e art. 121, §§ 2º e 3º, II (responsabilidade do contratante e pagamento condicionado à comprovação de quitação das obrigações trabalhistas vencidas, quando previsto no edital ou no contrato).';

/** "no prazo de 5 (cinco) dias úteis" */
const prazoRegularizar = (dias) => {
  const extenso = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze'];
  return dias
    ? `no prazo de ${dias}${extenso[dias] ? ` (${extenso[dias]})` : ''} ${dias === 1 ? 'dia útil' : 'dias úteis'} a contar do recebimento`
    : 'no prazo previsto no contrato';
};

/** Texto da cobrança para e-mail ou WhatsApp */
export function mensagemPendencias(prestadora, av, cfg = {}) {
  const linhas = [
    `Prezados, ${prestadora?.razao || ''}${prestadora?.contrato ? ` (contrato ${prestadora.contrato})` : ''},`,
    '',
    `${cfg.contratante ? `Em nome de ${cfg.contratante}, i` : 'I'}nformamos que, na conferência dos documentos da competência ${nomeCompetencia(av.comp)}, foram identificadas as pendências abaixo. Pedimos regularizar ${prazoRegularizar(cfg.prazoRegularizacao)}, colocando os documentos na pasta compartilhada. O prazo de envio da competência é ${dataBR(av.prazo)}; enquanto houver pendência, o pagamento fica condicionado à comprovação.`,
    '',
  ];
  if (av.recusados.length) {
    linhas.push('Documentos recusados (enviar de novo):');
    for (const r of av.recusados) linhas.push(`- [${r.pasta || 'Certidões'}] ${r.nome}${r.motivo ? `: ${r.motivo}` : ''}`);
    linhas.push('');
  }
  const grupos = [
    ['divergencia', 'Divergências a corrigir'],
    ['faltando', 'Documentos não localizados'],
    ['candidato', 'Arquivos que precisam ser identificados'],
    ['ocorrencia', 'Informar se houve no mês (ou enviar os documentos)'],
    ['vencida', 'Certidões vencidas'],
    ['renovar', 'Certidões a renovar'],
  ];
  for (const [st, titulo] of grupos) {
    const l = av.pendencias.filter((p) => p.status === st);
    if (!l.length) continue;
    linhas.push(`${titulo}:`);
    for (const p of l) linhas.push(`- [${p.pasta || 'Certidões'}] ${p.nome}${st === 'divergencia' ? `: ${p.detalhe}` : ''}`);
    linhas.push('');
  }
  linhas.push(
    'Após enviar, por favor nos avise por este canal.',
    '',
    FUNDAMENTO_LEGAL,
    '',
    `Atenciosamente${cfg.fiscal ? `,\n${cfg.fiscal}\nFiscal do contrato` : '.'}`,
  );
  return linhas.join('\n');
}

/** Blocos do PDF da notificação de pendências (layout Ágil CM, lib/pdfReport.ts) */
export function blocosNotificacao(prestadora, av, cfg = {}) {
  if (typeof cfg === 'string') cfg = { contratante: cfg };
  const linhas = [
    ...av.recusados.map((r) => [r.pasta || 'Certidões', `${r.nome} - recusado${r.motivo ? `: ${r.motivo}` : ''}`]),
    ...av.pendencias.map((p) => [
      p.pasta || 'Certidões',
      `${p.nome} - ${STATUS[p.status].nome.toLowerCase()}${p.status === 'divergencia' ? `: ${p.detalhe}` : ''}`,
    ]),
  ];
  return [
    { type: 'title', text: 'Notificação de pendências documentais' },
    ...(cfg.contratante ? [{ type: 'para', text: `Contratante: ${cfg.contratante}`, bold: true }] : []),
    {
      type: 'para',
      text: `Contratada: ${prestadora?.razao || '-'}${prestadora?.cnpj ? ` (CNPJ ${prestadora.cnpj})` : ''}${prestadora?.contrato ? ` · contrato nº ${prestadora.contrato}` : ''}${cfg.objeto ? ` · objeto: ${cfg.objeto}` : ''}`,
    },
    {
      type: 'para',
      text: `Na fiscalização dos documentos trabalhistas, previdenciários e do FGTS da competência ${nomeCompetencia(av.comp)}, foram identificadas as pendências abaixo. Fica a contratada notificada a regularizá-las ${prazoRegularizar(cfg.prazoRegularizacao)}, colocando os documentos na pasta compartilhada. Prazo de envio da competência: ${dataBR(av.prazo)}. Enquanto houver pendência, o pagamento fica condicionado à comprovação, nos termos do contrato.`,
    },
    { type: 'table', widths: [1.2, 4], header: ['Pasta', 'Documento'], rows: linhas.length ? linhas : [['-', 'Nenhuma pendência']], size: 9 },
    { type: 'note', text: `${av.conferidos} de ${av.total} exigências do mês recebidas.` },
    { type: 'para', text: FUNDAMENTO_LEGAL, size: 8.5, color: 'muted', gapAfter: 26 },
    { type: 'para', text: '__________________________________________' },
    { type: 'para', text: cfg.fiscal || 'Fiscal do contrato', bold: true },
    { type: 'para', text: cfg.fiscal ? 'Fiscal do contrato' : 'Nome e assinatura', color: 'muted', size: 9 },
  ];
}

// ---------------------------------------------------------------- relatório rápido

const LETRAS = 'abcdefghijklmnopqrstuvwxyz';
const letra = (i) => (i < 26 ? LETRAS[i] : `${LETRAS[Math.floor(i / 26) - 1]}${LETRAS[i % 26]}`);
const PERGUNTA_CURTA = {
  admissoes: 'admissões',
  demissoes: 'demissões',
  ferias: 'férias',
  acidente: 'acidente de trabalho',
  subcontratacao: 'subcontratação',
  parcelamento: 'parcelamento',
  mobilizacao: 'mobilização',
  desmobilizacao: 'desmobilização',
};

/** Itens a), b), c)... do que falta num mês, em poucas palavras */
export function pendenciasSinteticas(av) {
  const out = [];
  const curto = (i) => CURTO[i.id] || i.nome;
  for (const g of GRUPOS) {
    const doGrupo = av.itens.filter((i) => i.grupo === g.id);
    const faltam = doGrupo.filter((i) => i.status === 'faltando' || i.status === 'candidato');
    if (!faltam.length) continue;
    const exigidos = doGrupo.filter((i) => !['na', 'eventual', 'ocorrencia'].includes(i.status));
    const tudo = faltam.length === exigidos.length && exigidos.length >= 3;
    const classificar = faltam.some((i) => i.status === 'candidato');
    out.push(`${g.pasta}: ${tudo ? `tudo (${faltam.length})` : faltam.map(curto).join(', ')}${classificar ? ' (há arquivos sem identificação na pasta)' : ''}`);
  }
  const cert = av.certidoes.filter((c) => ['faltando', 'vencida', 'renovar'].includes(c.status));
  if (cert.length)
    out.push(
      `Certidões: ${cert.map((c) => `${CURTO[c.id] || c.nome}${c.status === 'vencida' ? ' (vencida)' : c.status === 'renovar' ? ' (renovar)' : ''}`).join(', ')}`,
    );
  for (const i of [...av.itens, ...av.certidoes].filter((x) => x.status === 'divergencia')) {
    const det =
      i.competenciaLida && i.competenciaLida !== av.comp
        ? `traz ${compBR(i.competenciaLida)}, mas está na pasta de ${compBR(av.comp)}`
        : String(i.detalhe).split(/(?<=\.)\s/)[0];
    out.push(`Divergência em ${curto(i)}: ${det.replace(/\.$/, '')}`);
  }
  for (const r of av.recusados) out.push(`Recusado: ${curto(r)}${r.motivo ? ` (${r.motivo})` : ''}`);
  const informar = Object.entries(av.situacoes || {})
    .filter(([id, s2]) => s2.valor == null && av.itens.some((i) => i.status === 'ocorrencia' && GRUPOS.find((g) => g.id === i.grupo)?.quando === id))
    .map(([id]) => PERGUNTA_CURTA[id] || id);
  if (informar.length) out.push(`Informar se houve: ${informar.join(', ')}`);
  for (const p of av.prazosLegais || []) if (p.situacao === 'atraso') out.push(`${p.nome.replace(/ \(.*\)$/, '')} fora do prazo legal (${dataBR(p.prazo)})`);
  const jaDito = /cita outro mês|CRF não identificado|pagamento incompleto|comprovante diferente|fora do prazo legal/;
  for (const a of av.achados.filter((x) => x.nivel === 'alerta' && !jaDito.test(x.titulo))) out.push(`${a.titulo}`);
  return out;
}

/**
 * Relatório rápido: por prestadora, os meses que travam ou aguardam e, em cada um, o que falta em itens a), b), c).
 * @param {{ nome: string, ident?: { razao?: string, cnpj?: string, contrato?: string }, avs: any[], venc?: any[] }[]} lista
 * @param {{ atualizadoEm?: string, contratante?: string, hoje?: string }} [o]
 * @returns {{ texto: string, blocos: any[] }}
 */
export function relatorioRapido(lista, o = {}) {
  const hoje = o.hoje || hojeISO();
  const linhas = [`RELATÓRIO RÁPIDO · DocPref · ${dataBR(hoje)}`];
  if (o.contratante) linhas.push(`Contratante: ${o.contratante}`);
  if (o.atualizadoEm) linhas.push(`Pasta do Drive lida em ${dataBR(o.atualizadoEm)}`);
  const blocos = [
    { type: 'title', text: lista.length === 1 ? `Relatório rápido - ${lista[0].nome}` : 'Relatório rápido - todas as prestadoras' },
    {
      type: 'para',
      text: `${o.contratante ? `Contratante: ${o.contratante}. ` : ''}O que falta, em poucas palavras, nos meses que travam o pagamento ou aguardam envio.${o.atualizadoEm ? ` Pasta do Drive lida em ${dataBR(o.atualizadoEm)}.` : ''}`,
      color: 'muted',
    },
  ];
  for (const e of lista) {
    const meses = e.avs.filter((a) => a.sinal === 'travar' || a.sinal === 'aguardando');
    const p = performance(e.avs);
    const travados = e.avs.filter((a) => a.sinal === 'travar').length;
    const resumo = `${travados ? `${travados} ${travados === 1 ? 'mês travado' : 'meses travados'}` : 'nenhum mês travado'}${p.regularidade != null ? ` · regularidade ${p.regularidade}%` : ''}`;
    const id = e.ident ? identificacao(e.ident) : '';
    linhas.push('', `${e.nome.toUpperCase()}${id && id !== e.nome ? ` · ${id}` : ''}`, resumo);
    blocos.push({ type: 'heading', text: e.nome }, ...(id ? [{ type: 'para', text: id, size: 9 }] : []), { type: 'para', text: resumo, bold: true });
    if (!meses.length) {
      linhas.push('Tudo em dia nos meses com prazo encerrado.');
      blocos.push({ type: 'para', text: 'Tudo em dia nos meses com prazo encerrado.' });
    }
    for (const a of meses) {
      const titulo = `${compBR(a.comp)} · ${nomeSinal(a.sinal)} (prazo ${dataBR(a.prazo)})`;
      linhas.push('', titulo);
      blocos.push({ type: 'para', text: titulo, bold: true, gapAfter: 2 });
      if (!a.resumo.arquivos) {
        const t = a.sinal === 'travar' ? 'Nada enviado: todos os documentos do mês.' : 'Aguardando o envio dos documentos.';
        linhas.push(t);
        blocos.push({ type: 'para', text: t, indent: true, size: 9.5 });
        continue;
      }
      pendenciasSinteticas(a).forEach((t, k) => {
        linhas.push(`${letra(k)}) ${t}`);
        blocos.push({ type: 'para', text: `${letra(k)}) ${t}`, indent: true, size: 9.5, gapAfter: 2 });
      });
    }
    const venc = (e.venc || []).filter((v) => v.status === 'vencido' || v.status === 'a-vencer');
    if (venc.length) {
      const t = `Vencimentos: ${venc.map((v) => `${v.nome} ${v.status === 'vencido' ? 'vencida' : 'vence'} em ${dataBR(v.validade)}`).join('; ')}`;
      linhas.push('', t);
      blocos.push({ type: 'para', text: t, size: 9.5 });
    }
  }
  return { texto: linhas.join('\n'), blocos };
}

// ---------------------------------------------------------------- relatórios no modelo "AGIL ANÁLISE DOCUMENTAL"

const regraPrazo = (dia) => (dia ? `dia ${dia} do mês seguinte` : 'último dia do mês seguinte');
/** "PILAR EMPREENDIMENTOS... · CNPJ ... · contrato ..." (o que a leitura achou nos documentos ou o cadastro) */
const identificacao = (o) => [o.razao, o.cnpj && `CNPJ ${o.cnpj}`, o.contrato && `contrato ${o.contrato}`].filter(Boolean).join(' · ');
/** "Contratante: Prefeitura ... · Fiscal do contrato: ... · Objeto: ..." */
const linhaContrato = (o) =>
  [o.contratante && `Contratante: ${o.contratante}`, o.fiscal && `Fiscal do contrato: ${o.fiscal}`, o.objeto && `Objeto: ${o.objeto}`]
    .filter(Boolean)
    .join(' · ');
const PRAZO_NOME = { ok: 'No prazo', atraso: 'Fora do prazo', 'sem-data': 'Sem data', retificadora: 'Retificadora' };

/** Linhas de "Pessoas do mês" (planilha × comprovantes × ponto × declarações × pastas) */
function linhasCobertura(c) {
  if (!c) return [];
  const fonte = (x) =>
    [x.planilha != null && `planilha ${x.planilha}`, x.declaracao != null && `declaração ${x.declaracao}`, x.pastas != null && `subpastas ${x.pastas}`]
      .filter(Boolean)
      .join(' · ') || '-';
  return [
    [
      'Empregados ativos na planilha de força de trabalho',
      c.ativos == null ? 'sem planilha' : `${c.ativos}${c.devidos !== c.ativos ? ` (${c.devidos} sem afastados)` : ''}`,
    ],
    ['Pagamentos de salário localizados', `${c.pagamentos}${c.holerites ? ` + ${c.holerites} holerite(s)` : ''}`],
    ['Arquivos de ponto', String(c.ponto)],
    ['Admissões/alocações no mês', fonte(c.admissoes)],
    ['Desligamentos no mês', fonte(c.demissoes)],
  ];
}

/** Relatório mensal de uma prestadora */
export function blocosRelatorioMensal(nomeEmpresa, av, o = {}) {
  const r = av.resumo;
  const base = av.arquivos.length ? 'Pacote enviado e levantamento automático da pasta do Drive' : 'Nenhum arquivo na pasta do mês';
  const linhaItem = (i) => [
    STATUS[i.status]?.nome || i.status,
    i.nome,
    i.competenciaLida
      ? `${compBR(i.competenciaLida)}${i.competenciaLida === av.comp ? ' · correta' : ''}`
      : i.evidencias?.length
        ? 'Período não confirmado'
        : '-',
    `${i.evidencias?.length ? `${i.evidencias.length} evidência(s). ` : ''}${i.detalhe}`,
  ];
  const blocos = [
    { type: 'title', text: `${nomeEmpresa} - Relatório mensal ${compBR(av.comp)}` },
    ...(identificacao(o) ? [{ type: 'para', text: identificacao(o), bold: true }] : []),
    ...(linhaContrato(o) ? [{ type: 'para', text: linhaContrato(o), size: 9.5 }] : []),
    {
      type: 'para',
      text: `Mês da pasta, competência dos documentos, prazos e certidões. Fonte: leitura da pasta compartilhada no Google Drive${o.atualizadoEm ? `, consultada em ${dataBR(o.atualizadoEm)}` : ''}.`,
      color: 'muted',
    },
    { type: 'heading', text: 'Competências e prazo de envio' },
    {
      type: 'bullets',
      items: [
        `Mês da pasta / relatório: ${compBR(av.comp)}. Competência da folha e das guias: ${compBR(av.comp)}; o pagamento das guias pode ocorrer em ${compBR(proximaComp(av.comp))}, sem alterar a competência.`,
        'A competência é conferida pelo Período de apuração escrito no documento. Datas de transmissão e de pagamento aparecem separadas.',
        `Prazo para envio do pacote: ${dataBR(av.prazo)} (${regraPrazo(o.dia)}). Situação: ${av.prazoEncerrado ? 'prazo encerrado' : 'dentro do prazo'}.`,
        `Semáforo do pagamento: ${nomeSinal(av.sinal)}. ${av.titulo}.`,
      ],
    },
    { type: 'heading', text: 'Base e resumo' },
    {
      type: 'para',
      text: `${base}. Arquivos: ${r.arquivos} | Itens recebidos: ${r.recebidos} | Não localizados: ${r.naoLocalizados} | A definir ou classificar: ${r.aDefinir} | Divergências: ${r.divergencias} | Certidões pendentes: ${r.certPendentes}`,
    },
    {
      type: 'note',
      text: 'Recebido significa localizado; cada evidência informa a conferência do período. Conteúdo, valores e cobertura das pessoas seguem em análise. O prazo de envio não é a data de vencimento das certidões.',
    },
    ...(av.prazosLegais?.length
      ? [
          { type: 'heading', text: 'Prazos legais' },
          {
            type: 'table',
            widths: [2, 1, 1, 1.1, 3.6],
            header: ['Obrigação', 'Prazo', 'Data lida', 'Situação', 'Detalhe'],
            rows: av.prazosLegais.map((p) => [p.nome, dataBR(p.prazo), dataBR(p.data) || '-', PRAZO_NOME[p.situacao] || p.situacao, p.texto]),
            size: 8,
          },
        ]
      : []),
    ...(av.pagamentos?.length
      ? [
          { type: 'heading', text: 'Guias e pagamentos' },
          {
            type: 'table',
            widths: [1.4, 1.1, 1.1, 1.3, 4],
            header: ['Obrigação', 'Guia / folha', 'Comprovantes', 'Situação', 'Providência'],
            rows: av.pagamentos.map((p) => [
              p.nome,
              p.guia ? moeda(p.guia) : '-',
              p.pago ? moeda(p.pago) : '-',
              PAGAMENTO[p.situacao]?.nome || p.situacao,
              `${p.texto}${p.ocr ? ' (lido por OCR)' : ''}`,
            ]),
            size: 8,
          },
        ]
      : []),
    ...(av.cobertura?.temPlanilha || av.cobertura?.pagamentos || av.cobertura?.ponto
      ? [
          { type: 'heading', text: 'Pessoas do mês' },
          { type: 'table', widths: [3.4, 3.4], header: ['Conferência', 'Quantidade'], rows: linhasCobertura(av.cobertura), size: 8.5 },
        ]
      : []),
    { type: 'heading', text: 'O que precisa no mês da pasta' },
    {
      type: 'table',
      widths: [1.25, 2.3, 1, 3.2],
      header: ['Situação', 'Exigência', 'Competência lida', 'Evidência e providência'],
      rows: av.itens.filter((i) => i.status !== 'na' || i.evidencias.length).map(linhaItem),
      size: 7.5,
    },
  ];
  const na = av.itens.filter((i) => i.status === 'na' && !i.evidencias.length);
  if (na.length) blocos.push({ type: 'note', text: `Não se aplica neste mês: ${na.map((i) => i.nome).join('; ')}.` });
  blocos.push(
    { type: 'heading', text: 'Certidões: apresentação e renovação' },
    {
      type: 'para',
      text: 'FGTS / CRF: todo mês. Federal, estadual, municipal, trabalhista (CNDT) e falência e concordata: meses pares (fevereiro, abril, junho, agosto, outubro e dezembro). Certidão que vence num mês é cobrada nesse mês, mesmo ímpar; uma certidão ainda válida pode ser reapresentada.',
      size: 9,
    },
    {
      type: 'table',
      widths: [2.4, 1.3, 1.2, 3],
      header: ['Certidão', 'Situação', 'Validade', 'Providência'],
      rows: av.certidoes
        .filter((c) => c.exigida || c.status !== 'na')
        .map((c) => [c.nome, STATUS[c.status]?.nome || c.status, c.validade ? dataBR(c.validade) : 'não registrada', c.detalhe]),
      size: 8,
    },
  );
  const cobrar = [...av.recusados, ...av.pendencias];
  blocos.push({ type: 'heading', text: 'Solicitações e regularizações' });
  blocos.push(
    cobrar.length
      ? {
          type: 'table',
          widths: [3, 4, 1.1],
          header: ['Exigência', 'Providência', 'Prazo'],
          rows: cobrar.map((p) => [p.nome, p.detalhe, dataBR(av.prazo)]),
          size: 8,
        }
      : { type: 'para', text: 'Nenhuma pendência neste mês.' },
  );
  if (av.achados.length) {
    blocos.push({ type: 'heading', text: 'Achados da análise do conteúdo' });
    blocos.push({ type: 'bullets', items: av.achados.map((a) => `${a.nivel === 'alerta' ? '[atenção] ' : ''}${a.titulo} - ${a.texto}`) });
  }
  blocos.push({ type: 'heading', text: 'Arquivos localizados' });
  blocos.push(
    av.arquivos.length
      ? {
          type: 'table',
          widths: [3.2, 1.6, 3],
          header: ['Arquivo', 'Pasta', 'Período e evidência'],
          rows: av.arquivos.map((a) => [
            a.rotulo,
            a.pasta || '-',
            `${a.comp ? `${compBR(a.comp)}${a.comp === av.comp ? ' · competência correta' : ' · outra competência'}` : 'Período não confirmado'}${a.evidencia ? ` | ${a.evidencia}` : ''}${a.transmissao ? ` | transmissão ${dataBR(a.transmissao)}` : ''}${a.pagoEm ? ` | pago em ${dataBR(a.pagoEm)}` : ''}`,
          ]),
          size: 7.5,
        }
      : { type: 'para', text: 'Nenhum arquivo na pasta deste mês.' },
  );
  blocos.push({ type: 'heading', text: 'Fontes e limites' });
  blocos.push({
    type: 'para',
    text: 'Leitura automática dos nomes, das pastas e do texto dos PDFs da pasta compartilhada. Correspondência por nome e pasta não confirma o conteúdo; digitalizações e imagens precisam de conferência visual. Este relatório organiza a conferência e não comprova regularidade só pela presença do arquivo.',
    size: 9,
    color: 'muted',
  });
  return blocos;
}

/** Relatório geral do ano de uma prestadora */
export function blocosRelatorioGeral(nomeEmpresa, ano, avs, o = {}) {
  const doAno = avs.filter((a) => a.comp.startsWith(String(ano)));
  const arquivos = doAno.reduce((s, a) => s + a.resumo.arquivos, 0);
  const comBase = doAno.filter((a) => a.resumo.arquivos > 0).length;
  const blocos = [
    { type: 'title', text: `${nomeEmpresa} - Relatório geral ${ano}` },
    ...(identificacao(o) ? [{ type: 'para', text: identificacao(o), bold: true }] : []),
    ...(linhaContrato(o) ? [{ type: 'para', text: linhaContrato(o), size: 9.5 }] : []),
    {
      type: 'para',
      text: `Visão consolidada dos meses das pastas, competências, prazos, presença documental e certidões. Fonte: leitura da pasta compartilhada no Google Drive${o.atualizadoEm ? `, consultada em ${dataBR(o.atualizadoEm)}` : ''}.`,
      color: 'muted',
    },
    { type: 'heading', text: 'Resumo do período' },
    { type: 'para', text: `Arquivos reunidos: ${arquivos} | Meses com documentos: ${comBase} / ${doAno.length}` },
    ...(() => {
      const p = performance(doAno);
      return p.exigidos
        ? [
            {
              type: 'para',
              text: `Regularidade nos meses com prazo encerrado: ${p.regularidade}% (${p.recebidos} de ${p.exigidos} exigências recebidas em ${p.meses} ${p.meses === 1 ? 'mês' : 'meses'}) | Meses travados: ${p.travados}`,
              bold: true,
            },
          ]
        : [];
    })(),
    {
      type: 'bullets',
      items: [
        `O prazo de cada pacote termina no ${regraPrazo(o.dia)} ao mês da pasta. Folha, comprovantes de salário e guias são do próprio mês da pasta; o pagamento da guia pode ocorrer no mês seguinte, sem alterar a competência.`,
        'A competência é determinada pelo Período de apuração identificado no documento. Datas de transmissão e de pagamento não alteram esse período.',
      ],
    },
    { type: 'heading', text: 'Meses das pastas: competências e prazos' },
    {
      type: 'table',
      widths: [0.75, 0.95, 1.2, 0.7, 0.8, 0.7, 0.85, 0.8, 0.85, 1.35],
      header: ['Mês', 'Envio até', 'Prazo', 'Arquivos', 'Recebidos', '% regul.', 'Não localiz.', 'Divergên.', 'Certidões pend.', 'Semáforo'],
      headerAlign: ['left', 'left', 'left', 'right', 'right', 'right', 'right', 'right', 'right', 'left'],
      rows: doAno.map((a) => {
        const neutro = a.sinal === 'futuro' || a.sinal === 'fora';
        const n = (v) => ({ text: neutro ? '-' : String(v), align: 'right' });
        return [
          compBR(a.comp),
          dataBR(a.prazo),
          neutro ? '-' : a.prazoEncerrado ? 'Prazo encerrado' : 'Dentro do prazo',
          { text: String(a.resumo.arquivos), align: 'right' },
          n(a.resumo.recebidos),
          { text: a.regularidade == null ? '-' : `${a.regularidade}%`, align: 'right' },
          n(a.resumo.naoLocalizados),
          n(a.resumo.divergencias),
          n(a.resumo.certPendentes),
          nomeSinal(a.sinal),
        ];
      }),
      size: 7.5,
    },
    { type: 'heading', text: 'Periodicidade das certidões' },
    {
      type: 'bullets',
      items: [
        'FGTS / CRF: apresentação todo mês.',
        'Certidões federal, estadual, municipal, trabalhista (CNDT) e de falência e concordata: meses pares (fevereiro, abril, junho, agosto, outubro e dezembro).',
        'A apresentação periódica e a renovação por vencimento são controles separados: se uma certidão vencer em abril, a renovação é cobrada em abril.',
      ],
    },
    { type: 'heading', text: 'Cobranças por mês da pasta' },
  ];
  const linhas = doAno
    .filter((a) => a.sinal !== 'futuro' && a.sinal !== 'fora')
    .flatMap((a) => [...a.recusados, ...a.pendencias].map((p) => [compBR(a.comp), p.nome, STATUS[p.status]?.nome || p.status, dataBR(a.prazo)]));
  blocos.push(
    linhas.length
      ? { type: 'table', widths: [0.8, 3.4, 1.6, 1], header: ['Mês', 'Exigência', 'Situação', 'Prazo'], rows: linhas, size: 7.5 }
      : { type: 'para', text: 'Nenhuma cobrança em aberto.' },
  );
  const alertas = doAno.flatMap((a) => a.achados.filter((x) => x.nivel === 'alerta').map((x) => `${compBR(a.comp)} - ${x.titulo}: ${x.texto}`));
  if (alertas.length) {
    blocos.push({ type: 'heading', text: 'Achados de atenção' });
    blocos.push({ type: 'bullets', items: alertas });
  }
  blocos.push({ type: 'heading', text: 'Leitura do resultado' });
  blocos.push({
    type: 'para',
    text: 'Não localizado se refere à pasta daquele mês. Arquivos a classificar precisam de identificação antes de concluir ausência. Os relatórios mensais detalham exigências, evidências e achados de conteúdo.',
    size: 9,
    color: 'muted',
  });
  return blocos;
}
