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
  { id: 'admissoes', pergunta: 'Houve admissões ou alocações no contrato?', declaracao: 'decl-admissoes', categoria: 'admissao' },
  { id: 'demissoes', pergunta: 'Houve demissões?', declaracao: 'decl-demissoes', categoria: 'demissao' },
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

/** Certidões: `pares` = apresentação nos meses pares; as demais todo mês */
export const CERTIDOES = [
  { id: 'crf', nome: 'Certificado de regularidade do FGTS (CRF)', pares: false },
  { id: 'cert-federal', nome: 'Certidão federal', pares: true },
  { id: 'cert-estadual', nome: 'Certidão estadual', pares: true },
  { id: 'cert-municipal', nome: 'Certidão municipal', pares: true },
  { id: 'cndt', nome: 'Certidão negativa de débitos trabalhistas (CNDT)', pares: true },
  { id: 'cert-falencia', nome: 'Certidão de falência e concordata', pares: true },
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
    if (v == null && s.padrao === false) {
      v = false;
      fonte = 'sem pasta no mês';
    }
    if (typeof manual[s.id] === 'boolean') {
      v = manual[s.id];
      fonte = 'marcado pela equipe';
    }
    out[s.id] = { valor: v, fonte, contraditorio: decl.length > 0 && !decl.some((a) => a.houve) && naPasta };
  }
  return out;
}

/** Status de uma exigência a partir das evidências (arquivos do tipo) e da competência esperada */
function statusPorEvidencia(evid, comp) {
  const comComp = evid.filter((a) => a.comp);
  if (comComp.some((a) => a.comp === comp)) return { status: 'ok', detalhe: `Competência ${compBR(comp)} compatível com este mês.` };
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
 *   certAnteriores?: Record<string, string>, antesDoInicio?: boolean }} [o]
 */
export function avaliarMes(mes, o = {}) {
  const comp = mes.comp;
  const arquivos = mes.arquivos || [];
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
      const evid = arquivos.filter((a) => a.tipo === i.id);
      let st;
      if (evid.length) st = statusPorEvidencia(evid, comp);
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
    if (evid.length) {
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
    return { ...c, exigida, status, auto, manual: !!(m && m.status && m.status !== 'pendente'), detalhe, validade, evidencias: evid.map((a) => a.rotulo) };
  });

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
    total: todos.filter((i) => i.status !== 'na' && i.status !== 'eventual').length,
    conferidos: todos.filter((i) => ['ok', 'conferir'].includes(i.status)).length,
    /** @type {{ nivel: string, titulo: string, texto: string }[]} */
    achados: [],
    pastaExiste: true,
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
  av.achados = achadosDoMes(av);
  return av;
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
      'A declaração diz que não houve, mas a pasta tem documentos do assunto.',
    );
  }

  // guia x comprovante
  const par = (guiaTipo, compTipo, nome) => {
    const guia = arquivos.find((a) => a.tipo === guiaTipo && a.valor);
    const pagos = arquivos.filter((a) => a.tipo === compTipo && a.valor);
    if (!guia || !pagos.length) return;
    const soma = Math.round(pagos.reduce((s, a) => s + a.valor, 0) * 100) / 100;
    if (pagos.some((a) => Math.abs(a.valor - guia.valor) < 0.01) || Math.abs(soma - guia.valor) < 0.01) {
      const efetivado = pagos.some((a) => a.situacao === 'efetivada');
      add(
        'info',
        `${nome}: comprovante compatível com a guia`,
        `Guia de ${moeda(guia.valor)} e comprovante de ${moeda(soma)}${efetivado ? ', com situação efetivada' : ''}.`,
      );
    } else add('alerta', `${nome}: comprovante diferente da guia`, `Guia de ${moeda(guia.valor)} e comprovante(s) somando ${moeda(soma)}.`);
    if (guia.vencimento) {
      const atrasado = pagos.filter((a) => a.pagoEm && a.pagoEm > guia.vencimento);
      if (atrasado.length)
        add('alerta', `${nome}: pago depois do vencimento`, `Vencimento ${dataBR(guia.vencimento)}; pagamento em ${dataBR(atrasado[0].pagoEm)}.`);
    }
  };
  par('fgts-guia', 'fgts-pagamento', 'FGTS');
  par('darf', 'darf-pagamento', 'DARF');
  par('vavr-guia', 'vavr-pagamento', 'VA/VR');
  par('vt-guia', 'vt-pagamento', 'VT');

  const fg = arquivos.find((a) => a.tipo === 'fgts-guia' && a.encargos > 0);
  if (fg)
    add(
      'alerta',
      'FGTS com encargos de atraso',
      `A guia FGTS Digital traz ${moeda(fg.encargos)} de encargos: o recolhimento ${fg.comp ? `de ${compBR(fg.comp)} ` : ''}saiu depois do vencimento normal.`,
    );
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
  if (forca && forca.ativos) add('info', 'Força de trabalho', `${forca.ativos} ativos e ${forca.inativos || 0} inativos na planilha.`);

  const semTexto = arquivos.filter((a) => a.semTexto && !a.imagem && a.extensao === 'pdf').length;
  const imagens = arquivos.filter((a) => a.imagem).length;
  if (semTexto || imagens)
    add(
      'info',
      'Digitalizações exigem conferência visual',
      `${semTexto} ${semTexto === 1 ? 'PDF sem texto' : 'PDFs sem texto'} e ${imagens} ${imagens === 1 ? 'imagem' : 'imagens'}. A leitura automática não comprova conteúdo, assinatura nem cobertura de todas as pessoas.`,
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
 * @param {{ hoje?: string, dia?: number, inicio?: string, ate?: string, conferencias?: Record<string, any> }} [o]
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
    const av = avaliarMes(mes, { hoje, dia: o.dia, conf: o.conferencias?.[comp], certAnteriores: { ...certAnteriores }, antesDoInicio: comp < inicio });
    av.pastaExiste = porComp.has(comp);
    for (const c of av.certidoes) if (c.validade) certAnteriores[c.id] = c.validade;
    return av;
  });
}

const SINAL_NOME = {
  pagar: 'Pode pagar',
  aguardando: 'Aguardando / dentro do prazo',
  travar: 'Travar pagamento',
  futuro: 'Mês em curso',
  fora: 'Antes do início',
};
export const nomeSinal = (s) => SINAL_NOME[s] || s;

/** Texto da cobrança para e-mail ou WhatsApp */
export function mensagemPendencias(prestadora, av) {
  const linhas = [
    `Prezados, ${prestadora?.razao || ''}${prestadora?.contrato ? ` (contrato ${prestadora.contrato})` : ''},`,
    '',
    `Na conferência dos documentos da competência ${nomeCompetencia(av.comp)}, identificamos as pendências abaixo. O prazo de envio é ${dataBR(av.prazo)}; enquanto houver pendência, o pagamento fica bloqueado.`,
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
  linhas.push('Após enviar, por favor nos avise por este canal.', '', 'Atenciosamente.');
  return linhas.join('\n');
}

/** Blocos do PDF da notificação de pendências (layout Ágil CM, lib/pdfReport.ts) */
export function blocosNotificacao(prestadora, av, tomadora = '') {
  const linhas = [
    ...av.recusados.map((r) => [r.pasta || 'Certidões', `${r.nome} - recusado${r.motivo ? `: ${r.motivo}` : ''}`]),
    ...av.pendencias.map((p) => [
      p.pasta || 'Certidões',
      `${p.nome} - ${STATUS[p.status].nome.toLowerCase()}${p.status === 'divergencia' ? `: ${p.detalhe}` : ''}`,
    ]),
  ];
  return [
    { type: 'title', text: 'Notificação de pendências documentais' },
    {
      type: 'para',
      text: `${tomadora ? `${tomadora} · ` : ''}Prestadora: ${prestadora?.razao || '-'}${prestadora?.cnpj ? ` (CNPJ ${prestadora.cnpj})` : ''}${prestadora?.contrato ? ` · contrato ${prestadora.contrato}` : ''}`,
    },
    {
      type: 'para',
      text: `Na conferência dos documentos trabalhistas e previdenciários da competência ${nomeCompetencia(av.comp)}, foram identificadas as pendências abaixo. Prazo de envio: ${dataBR(av.prazo)}. Enquanto houver pendência, o pagamento permanece bloqueado, conforme o contrato.`,
    },
    { type: 'table', widths: [1.2, 4], header: ['Pasta', 'Documento'], rows: linhas.length ? linhas : [['-', 'Nenhuma pendência']], size: 9 },
    { type: 'note', text: `${av.conferidos} de ${av.total} exigências do mês recebidas.` },
  ];
}

// ---------------------------------------------------------------- relatórios no modelo "AGIL ANÁLISE DOCUMENTAL"

const regraPrazo = (dia) => (dia ? `dia ${dia} do mês seguinte` : 'último dia do mês seguinte');

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
    {
      type: 'para',
      text: `Mês da pasta, competência dos documentos, prazos e certidões.${o.atualizadoEm ? ` Base consultada em ${dataBR(o.atualizadoEm)}.` : ''}`,
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
    { type: 'para', text: 'Visão consolidada dos meses das pastas, competências, prazos, presença documental e certidões.', color: 'muted' },
    { type: 'heading', text: 'Resumo do período' },
    { type: 'para', text: `Arquivos reunidos: ${arquivos} | Meses com documentos: ${comBase} / ${doAno.length}` },
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
      widths: [0.8, 0.95, 1.3, 0.7, 0.8, 0.9, 0.85, 0.85, 1.4],
      header: ['Mês', 'Envio até', 'Prazo', 'Arquivos', 'Recebidos', 'Não localiz.', 'Divergên.', 'Certidões pend.', 'Semáforo'],
      headerAlign: ['left', 'left', 'left', 'right', 'right', 'right', 'right', 'right', 'left'],
      rows: doAno.map((a) => {
        const neutro = a.sinal === 'futuro' || a.sinal === 'fora';
        const n = (v) => ({ text: neutro ? '-' : String(v), align: 'right' });
        return [
          compBR(a.comp),
          dataBR(a.prazo),
          neutro ? '-' : a.prazoEncerrado ? 'Prazo encerrado' : 'Dentro do prazo',
          { text: String(a.resumo.arquivos), align: 'right' },
          n(a.resumo.recebidos),
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
