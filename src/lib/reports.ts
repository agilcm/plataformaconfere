// Conteúdo dos relatórios em PDF no layout da Ágil CM.
import { COMPANY_PROFILE, formatBRL } from '../data/servicesData.ts';
import { REGIMES, type LaborInput, type LaborResult } from '../data/laborCost.ts';
import { dateText, type Block, type Cell } from './pdfReport.ts';

const brl = (n: number) => formatBRL(n, 2);
const right = (text: string): Cell => ({ text, align: 'right' });
const pct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

const signature = (): Block => ({
  type: 'signature',
  name: COMPANY_PROFILE.representative,
  role: COMPANY_PROFILE.representativeRole,
});

// ---------- Relatório de custo do funcionário ----------

export interface EmployeeReportMeta {
  empresa?: string;
  cargo?: string;
}

const ADICIONAL_LABEL: Record<string, string> = {
  nenhum: 'Nenhum',
  insal10: 'Insalubridade grau mínimo (10% do salário mínimo)',
  insal20: 'Insalubridade grau médio (20% do salário mínimo)',
  insal40: 'Insalubridade grau máximo (40% do salário mínimo)',
  peric30: 'Periculosidade (30% do salário-base)',
};

export function employeeReport(i: LaborInput, r: LaborResult, meta: EmployeeReportMeta): Block[] {
  const regime = REGIMES.find((x) => x.id === i.regime)!;

  const params: string[][] = [
    ['Regime tributário', regime.label],
    ['Salário-base', brl(i.salario)],
    ['Insalubridade / periculosidade', ADICIONAL_LABEL[i.adicional]],
  ];
  if (i.outrosAdicionais) params.push(['Gratificações e outros adicionais', brl(i.outrosAdicionais)]);
  params.push(['Jornada mensal (divisor)', `${i.jornadaMensal} h`]);
  if (i.he1Horas) params.push([`Horas extras (${i.he1Perc}%)`, `${i.he1Horas} h`]);
  if (i.he2Horas) params.push([`Horas em domingos/feriados (${i.he2Perc}%)`, `${i.he2Horas} h`]);
  if (i.noturnoHoras) params.push(['Horas noturnas', `${i.noturnoHoras} h`]);
  params.push([
    'Alíquotas aplicadas',
    `INSS ${pct(i.rates.patronal)} · RAT ${pct(i.rates.rat)} · Terceiros ${pct(i.rates.terceiros)} · FGTS ${pct(i.rates.fgts)}${
      i.rates.indenizacao ? ` · Indenização ${pct(i.rates.indenizacao)}` : ''
    }`,
  ]);

  const quem = meta.cargo ? `do cargo de ${meta.cargo}` : 'de um funcionário';
  const para = meta.empresa ? `à ${meta.empresa} ` : '';

  const blocks: Block[] = [{ type: 'date', text: dateText() }, { type: 'title', text: 'Relatório de Custo de Funcionário' }];
  if (meta.empresa) blocks.push({ type: 'rich', parts: [{ text: 'Empresa: ', bold: true }, { text: meta.empresa }] });
  if (meta.cargo) blocks.push({ type: 'rich', parts: [{ text: 'Cargo / funcionário: ', bold: true }, { text: meta.cargo }] });
  if (meta.empresa || meta.cargo) blocks.push({ type: 'space', h: 8 });

  blocks.push(
    {
      type: 'para',
      indent: true,
      text: `Apresentamos ${para}a estimativa do custo mensal ${quem}, considerando o regime ${regime.label}. Os valores estão separados entre custos fixos, que saem do caixa todo mês, e custos provisionados, que devem ser reservados mensalmente para férias, 13º salário e rescisão.`,
      gapAfter: 10,
    },
    { type: 'heading', text: 'Resumo' },
    {
      type: 'table',
      widths: [64, 36],
      header: ['Indicador', 'Valor'],
      rows: [
        ['Custos fixos mensais', right(brl(r.totalFixos))],
        ['Custos mensais provisionados', right(brl(r.totalProvisoes))],
        ['Custo anual estimado (12 meses)', right(brl(r.totalAnual))],
        [
          'Custo em relação ao salário-base',
          right(`${r.fatorSobreSalario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} vezes`),
        ],
        ['Custo total mensal', right(brl(r.totalMensal))],
      ],
      totalRows: 1,
    },
    { type: 'heading', text: 'Parâmetros da simulação' },
    { type: 'table', widths: [38, 62], rows: params },
    { type: 'heading', text: '1. Custos fixos mensais' },
    {
      type: 'table',
      widths: [70, 30],
      header: ['Descrição', 'Valor mensal'],
      rows: [...r.fixos.map((l) => [l.label, right(brl(l.value))]), ['Total de custos fixos', right(brl(r.totalFixos))]],
      totalRows: 1,
    },
    { type: 'heading', text: '2. Custos mensais provisionados' },
    {
      type: 'table',
      widths: [70, 30],
      header: ['Descrição', 'Valor mensal'],
      rows: [...r.provisoes.map((l) => [l.label, right(brl(l.value))]), ['Total de provisões', right(brl(r.totalProvisoes))]],
      totalRows: 1,
    },
    {
      type: 'note',
      text: `Estimativa referencial com base no salário mínimo de 2026 para o cálculo da insalubridade. Não inclui convenção coletiva, aviso prévio, afastamentos ou desoneração da folha. Os descontos do empregado (INSS e IRRF) são retidos do salário e não aumentam o custo da empresa. ${regime.note}`,
    },
    signature(),
  );
  return blocks;
}

// ---------- Proposta / relatório de faturamento de serviços ----------

export interface QuoteReportData {
  serviceTitle: string;
  serviceSubtitle: string;
  areaSize: number;
  staffCount: number;
  frequencyLabel: string;
  inclusions: { label: string; included: boolean }[];
  items: { description: string; qty: number; unit: number }[];
  total: number;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
}

export function quoteReport(d: QuoteReportData): Block[] {
  const rows: (string | Cell)[][] = d.items.map((it, idx) => [
    { text: String(idx + 1), align: 'center' },
    it.description,
    { text: String(it.qty), align: 'center' },
    right(brl(it.unit)),
    right(brl(it.unit * it.qty)),
  ]);

  const blocks: Block[] = [
    { type: 'date', text: dateText() },
    { type: 'title', text: 'Proposta Comercial' },
    { type: 'para', text: 'À', gapAfter: 0 },
    { type: 'para', text: d.companyName || 'Empresa / Órgão contratante', bold: true, gapAfter: 0 },
  ];
  if (d.contactName) blocks.push({ type: 'para', text: `A/C ${d.contactName}`, gapAfter: 0 });
  const contato = [d.contactEmail, d.contactPhone].filter(Boolean).join(' · ');
  if (contato) blocks.push({ type: 'para', text: contato, size: 9, color: 'muted', gapAfter: 0 });

  blocks.push(
    { type: 'space', h: 10 },
    { type: 'para', text: 'Prezados,' },
    {
      type: 'para',
      indent: true,
      text: `Esta proposta é apresentada com o objetivo de fornecer uma solução eficaz de ${d.serviceTitle.toLowerCase()}, com equipe qualificada, supervisão constante e o melhor custo-benefício. Os pontos a seguir detalham o escopo, a composição de custos e o faturamento mensal estimado.`,
      gapAfter: 10,
    },
    { type: 'heading', text: 'Escopo do serviço' },
    {
      type: 'table',
      widths: [38, 62],
      rows: [
        ['Serviço', `${d.serviceTitle} — ${d.serviceSubtitle}`],
        ['Área aproximada', `${d.areaSize.toLocaleString('pt-BR')} m²`],
        ['Efetivo operacional', `${d.staffCount} profissional(is)`],
        ['Regime de frequência', d.frequencyLabel],
        ...d.inclusions.map((x) => [x.label, x.included ? 'Incluso' : 'Não incluso']),
        ...(d.notes ? [['Observações', d.notes]] : []),
      ],
    },
    { type: 'heading', text: 'Composição do faturamento mensal' },
    {
      type: 'table',
      widths: [8, 44, 8, 20, 20],
      header: ['Item', 'Descrição', 'Qnt', 'Valor Unitário', 'Total'],
      rows: [...rows, ['', 'Faturamento mensal estimado', '', '', right(brl(d.total))]],
      totalRows: 1,
    },
    { type: 'rich', parts: [{ text: 'Valor anual estimado (12 meses): ', bold: true }, { text: brl(d.total * 12) }], gapAfter: 8 },
    { type: 'heading', text: 'Condições' },
    {
      type: 'bullets',
      items: [
        'Valores incluem salários, encargos trabalhistas, benefícios, insumos e gestão operacional.',
        'Faturamento mensal com emissão de NFS-e acompanhada das certidões negativas (CND Federal, Trabalhista e FGTS).',
        'Valores sujeitos a ajuste após vistoria técnica e análise do termo de referência.',
        'Validade da proposta: 30 dias.',
      ],
    },
    signature(),
  );
  return blocks;
}
