// BancoDoc · conferência mensal dos documentos das prestadoras de serviço (co-responsabilidade da tomadora).
// O "book" de documentos segue a cartilha de fornecedores usada por grandes tomadoras (pastas por competência,
// prazo até o dia 25 do mês seguinte, bloqueio do pagamento enquanto houver pendência). Funções puras.

/**
 * Situações do mês que ligam ou desligam grupos de documentos.
 * @type {{ id: string, pergunta: string }[]}
 */
export const SITUACOES = [
  { id: 'admissoes', pergunta: 'Houve admissões ou alocações no contrato?' },
  { id: 'demissoes', pergunta: 'Houve demissões ou transferências?' },
  { id: 'ferias', pergunta: 'Houve empregados em férias?' },
  { id: 'parcelamento', pergunta: 'Há parcelamento de INSS ou FGTS?' },
  { id: 'subcontratacao', pergunta: 'Há subcontratação?' },
];

/**
 * O book padrão, pasta por pasta. `quando`: só entra se a situação do mês for "sim".
 * @type {{ id: string, pasta: string, quando?: string, itens: { id: string, nome: string }[] }[]}
 */
export const BOOK = [
  {
    id: 'acordo',
    pasta: 'Acordo Coletivo',
    itens: [{ id: 'convencao', nome: 'Acordo ou convenção coletiva da categoria vigente (se vencida, a última)' }],
  },
  {
    id: 'declaracoes',
    pasta: 'Declarações',
    itens: [
      { id: 'decl-acidente', nome: 'Declaração de ocorrência ou não de acidente de trabalho (com a CAT, se houve)' },
      { id: 'decl-admitidos', nome: 'Declaração dos novos empregados alocados no contrato no mês' },
      { id: 'decl-demitidos', nome: 'Declaração dos empregados demitidos no mês' },
      { id: 'decl-ferias', nome: 'Declaração dos empregados em férias' },
      { id: 'decl-transferidos', nome: 'Declaração dos transferidos do contrato (não demitidos)' },
      { id: 'decl-subcontratacao', nome: 'Declaração de subcontratação' },
    ],
  },
  {
    id: 'fopag',
    pasta: 'FOPAG e Comp. de Pgto',
    itens: [
      { id: 'folha', nome: 'Folha de pagamento analítica (com resumo por rubrica)' },
      { id: 'comp-salarios', nome: 'Comprovantes bancários do pagamento dos salários (ou holerites assinados + declaração de pagamento em espécie)' },
    ],
  },
  {
    id: 'inss-fgts',
    pasta: 'INSS + FGTS',
    itens: [
      { id: 'dctfweb', nome: 'DCTFWeb: declaração completa, recibo de entrega, resumo de débitos e de créditos' },
      { id: 'darf', nome: 'Guia DARF previdenciária (INSS)' },
      { id: 'comp-darf', nome: 'Comprovante de pagamento do DARF (ou PER/DCOMP e requerimento da compensação)' },
      { id: 'guia-fgts', nome: 'Guia do FGTS Digital' },
      { id: 'comp-fgts', nome: 'Comprovante de pagamento do FGTS Digital' },
      { id: 'detalhe-fgts', nome: 'Detalhamento da guia do FGTS Digital' },
      { id: 'crf', nome: 'Certificado de Regularidade do FGTS (CRF)' },
    ],
  },
  {
    id: 'ponto',
    pasta: 'Ponto',
    itens: [{ id: 'ponto', nome: 'Folhas de ponto de todos os empregados (ou declaração de que não se aplica)' }],
  },
  {
    id: 'va-vr',
    pasta: 'VA e VR',
    itens: [{ id: 'va-vr', nome: 'Relatório/extrato e comprovante de pagamento de vale-alimentação/refeição/cesta (ou declaração)' }],
  },
  {
    id: 'vt',
    pasta: 'VT',
    itens: [{ id: 'vt', nome: 'Relatório/extrato e comprovante de pagamento de vale-transporte (ou declaração)' }],
  },
  {
    id: 'forca',
    pasta: 'Força de trabalho',
    itens: [{ id: 'forca', nome: 'Planilha de força de trabalho atualizada (admissões, demissões, transferências e afastamentos do mês)' }],
  },
  {
    id: 'admissao',
    pasta: 'Admissão-alocação',
    quando: 'admissoes',
    itens: [
      { id: 'adm-contrato', nome: 'Contrato de trabalho' },
      { id: 'adm-ficha', nome: 'Ficha de registro' },
      { id: 'adm-ctps', nome: 'CTPS Digital / eSocial' },
      { id: 'adm-aso', nome: 'ASO admissional' },
      { id: 'adm-epi', nome: 'Ficha de entrega de EPIs assinada' },
      { id: 'adm-entrega-ctps', nome: 'Comprovante de entrega e devolução da CTPS' },
      { id: 'adm-vt', nome: 'Declaração de opção (ou não) pelo vale-transporte' },
    ],
  },
  {
    id: 'demissao',
    pasta: 'Demissão-transferência',
    quando: 'demissoes',
    itens: [
      { id: 'dem-trct', nome: 'TRCT assinado e datado' },
      { id: 'dem-comp', nome: 'Comprovante de pagamento da rescisão' },
      { id: 'dem-aviso', nome: 'Aviso de dispensa ou pedido de demissão' },
      { id: 'dem-grrf', nome: 'Guia e comprovante da GRRF (multa de 40%) e demonstrativo por trabalhador' },
      { id: 'dem-ctps', nome: 'CTPS: página de baixa' },
      { id: 'dem-aso', nome: 'ASO demissional' },
      { id: 'dem-seguro', nome: 'Protocolo do seguro-desemprego' },
    ],
  },
  {
    id: 'ferias',
    pasta: 'Férias',
    quando: 'ferias',
    itens: [
      { id: 'fer-aviso', nome: 'Aviso de férias assinado' },
      { id: 'fer-recibo', nome: 'Recibo e comprovante de pagamento das férias' },
    ],
  },
  {
    id: 'parcelamentos',
    pasta: 'Parcelamentos',
    quando: 'parcelamento',
    itens: [
      { id: 'parc-requerimento', nome: 'Requerimento/termo do parcelamento (INSS no e-CAC; FGTS na Caixa)' },
      { id: 'parc-parcela', nome: 'Guia e comprovante da parcela do mês (ou tela do parcelamento no e-CAC/FGTS Digital)' },
    ],
  },
  {
    id: 'subcontratada',
    pasta: 'Subcontratadas',
    quando: 'subcontratacao',
    itens: [{ id: 'sub-book', nome: 'Os mesmos documentos acima de cada empresa subcontratada, numa pasta para cada uma' }],
  },
];

export const STATUS = {
  pendente: { nome: 'Pendente', cor: 'bg-slate-100 text-slate-700 border-slate-300' },
  ok: { nome: 'Recebido e conferido', cor: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  recusado: { nome: 'Recusado', cor: 'bg-red-50 text-red-800 border-red-300' },
  na: { nome: 'Não se aplica', cor: 'bg-slate-50 text-slate-500 border-slate-200' },
};

/** "2026-10" → "outubro/2026" */
export function nomeCompetencia(comp) {
  const [a, m] = String(comp).split('-').map(Number);
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return a && m ? `${meses.at(m - 1)}/${a}` : String(comp);
}

/** Prazo de envio: dia `dia` do mês seguinte à competência ("2026-10", 25 → "2026-11-25") */
export function prazoDe(comp, dia = 25) {
  const [a, m] = String(comp).split('-').map(Number);
  const d = new Date(Date.UTC(a, m, 1)); // mês seguinte
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`;
}

/** A competência anterior ao mês de hoje ("2026-11-07" → "2026-10"): é a que está sendo cobrada agora */
export function competenciaAtual(hoje = new Date()) {
  const d = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Os itens que valem neste mês, conforme as situações marcadas */
export function itensDoMes(situacoes = {}) {
  return BOOK.filter((g) => !g.quando || situacoes[g.quando]).flatMap((g) => g.itens.map((i) => ({ ...i, pasta: g.pasta, grupo: g.id })));
}

/**
 * Situação da prestadora no mês.
 * @param {{ situacoes?: Record<string, boolean>, itens?: Record<string, { status: string, motivo?: string }> }} conf
 * @param {string} comp  competência "AAAA-MM"
 * @param {{ hoje?: string, dia?: number }} [o]  hoje = "AAAA-MM-DD"
 * @returns {{ sinal: 'pagar'|'aguardando'|'travar', titulo: string, prazo: string, diasParaPrazo: number, total: number, conferidos: number, pendencias: any[], recusados: any[] }}
 */
export function situacaoDoMes(conf, comp, o = {}) {
  const hoje = o.hoje || new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const prazo = prazoDe(comp, o.dia || 25);
  const diasParaPrazo = Math.round((Date.parse(prazo) - Date.parse(hoje)) / 86400e3);
  const itens = itensDoMes(conf?.situacoes);
  const st = (i) => conf?.itens?.[i.id]?.status || 'pendente';
  const pendencias = itens.filter((i) => st(i) === 'pendente');
  const recusados = itens.filter((i) => st(i) === 'recusado').map((i) => ({ ...i, motivo: conf.itens[i.id].motivo || '' }));
  const conferidos = itens.filter((i) => st(i) === 'ok' || st(i) === 'na').length;
  let sinal;
  let titulo;
  if (!pendencias.length && !recusados.length) {
    sinal = 'pagar';
    titulo = 'Pode pagar: todos os documentos do mês foram conferidos';
  } else if (diasParaPrazo >= 0) {
    sinal = 'aguardando';
    titulo = `Não pagar ainda: ${pendencias.length + recusados.length} ${pendencias.length + recusados.length === 1 ? 'documento pendente' : 'documentos pendentes'}${
      recusados.length ? ` (${recusados.length} ${recusados.length === 1 ? 'recusado' : 'recusados'})` : ''
    } · prazo ${prazo.split('-').reverse().join('/')}`;
  } else {
    sinal = 'travar';
    titulo = `Travar o pagamento: ${pendencias.length + recusados.length} ${pendencias.length + recusados.length === 1 ? 'pendência' : 'pendências'}`;
  }
  return { sinal, titulo, prazo, diasParaPrazo, total: itens.length, conferidos, pendencias, recusados };
}

/** Texto da cobrança para e-mail ou WhatsApp */
export function mensagemPendencias(prestadora, comp, s) {
  const linhas = [
    `Prezados, ${prestadora?.razao || ''}${prestadora?.contrato ? ` (contrato ${prestadora.contrato})` : ''},`,
    '',
    `Na conferência dos documentos da competência ${nomeCompetencia(comp)}, identificamos as pendências abaixo. O prazo de envio é ${s.prazo.split('-').reverse().join('/')}; enquanto houver pendência, o pagamento fica bloqueado.`,
    '',
  ];
  if (s.recusados.length) {
    linhas.push('Documentos recusados (enviar de novo):');
    for (const r of s.recusados) linhas.push(`- [${r.pasta}] ${r.nome}${r.motivo ? `: ${r.motivo}` : ''}`);
    linhas.push('');
  }
  if (s.pendencias.length) {
    linhas.push('Documentos não recebidos:');
    for (const p of s.pendencias) linhas.push(`- [${p.pasta}] ${p.nome}`);
    linhas.push('');
  }
  linhas.push('Após enviar, por favor nos avise por este canal.', '', 'Atenciosamente.');
  return linhas.join('\n');
}

/** Blocos do PDF da notificação de pendências (layout Ágil CM, lib/pdfReport.ts) */
export function blocosNotificacao(prestadora, comp, s, tomadora = '') {
  const linhas = [
    ...s.recusados.map((r) => [r.pasta, `${r.nome}${r.motivo ? ` — recusado: ${r.motivo}` : ' — recusado'}`]),
    ...s.pendencias.map((p) => [p.pasta, p.nome]),
  ];
  return [
    { type: 'title', text: 'Notificação de pendências documentais' },
    {
      type: 'para',
      text: `${tomadora ? `${tomadora} · ` : ''}Prestadora: ${prestadora?.razao || '—'}${prestadora?.cnpj ? ` (CNPJ ${prestadora.cnpj})` : ''}${prestadora?.contrato ? ` · contrato ${prestadora.contrato}` : ''}`,
    },
    {
      type: 'para',
      text: `Na conferência dos documentos trabalhistas e previdenciários da competência ${nomeCompetencia(comp)}, foram identificadas as pendências abaixo. Prazo de envio: ${s.prazo.split('-').reverse().join('/')}. Enquanto houver pendência, o pagamento permanece bloqueado, conforme o contrato.`,
    },
    {
      type: 'table',
      widths: [1.2, 4],
      header: ['Pasta', 'Documento'],
      rows: linhas.length ? linhas : [['—', 'Nenhuma pendência']],
      size: 9,
    },
    { type: 'note', text: `${s.conferidos} de ${s.total} documentos do mês conferidos.` },
  ];
}
