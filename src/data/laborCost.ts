// Cálculo do custo de um funcionário para o empregador.
// Todas as alíquotas são editáveis na tela; os valores abaixo são os padrões de cada regime.

export const SALARIO_MINIMO_2026 = 1621;

export type Regime =
  | 'presumido'
  | 'real'
  | 'simples'
  | 'simples_iv'
  | 'mei'
  | 'domestica'
  | 'rural';

export interface Rates {
  patronal: number; // INSS patronal / CPP (%)
  rat: number; // RAT/GILRAT ajustado (%)
  terceiros: number; // Sistema S, salário-educação, INCRA (%)
  fgts: number; // FGTS (%)
  indenizacao: number; // Indenização compensatória do doméstico (%)
}

export interface RegimeInfo {
  id: Regime;
  label: string;
  short: string;
  rates: Rates;
  note: string;
  multaFgts: boolean; // provisiona multa de 40% do FGTS?
}

export const REGIMES: RegimeInfo[] = [
  {
    id: 'presumido',
    label: 'Lucro Presumido',
    short: 'Presumido',
    rates: { patronal: 20, rat: 3, terceiros: 5.8, fgts: 8, indenizacao: 0 },
    note: 'INSS patronal de 20%, RAT de 3% e terceiros de 5,8% sobre a folha, além do FGTS de 8%.',
    multaFgts: true,
  },
  {
    id: 'real',
    label: 'Lucro Real',
    short: 'Real',
    rates: { patronal: 20, rat: 3, terceiros: 5.8, fgts: 8, indenizacao: 0 },
    note: 'Mesmos encargos do Lucro Presumido sobre a folha: 20% de patronal, 3% de RAT, 5,8% de terceiros e 8% de FGTS.',
    multaFgts: true,
  },
  {
    id: 'simples',
    label: 'Simples Nacional (Anexos I, II, III e V)',
    short: 'Simples',
    rates: { patronal: 0, rat: 0, terceiros: 0, fgts: 8, indenizacao: 0 },
    note: 'A contribuição patronal (CPP) já está dentro do DAS. Sobre a folha incide apenas o FGTS de 8%.',
    multaFgts: true,
  },
  {
    id: 'simples_iv',
    label: 'Simples Nacional (Anexo IV)',
    short: 'Simples IV',
    rates: { patronal: 20, rat: 3, terceiros: 0, fgts: 8, indenizacao: 0 },
    note: 'No Anexo IV (construção, vigilância, limpeza, advocacia) a CPP de 20% e o RAT são pagos à parte, sem terceiros.',
    multaFgts: true,
  },
  {
    id: 'mei',
    label: 'MEI',
    short: 'MEI',
    rates: { patronal: 3, rat: 0, terceiros: 0, fgts: 8, indenizacao: 0 },
    note: 'O MEI pode ter 1 empregado com salário mínimo ou piso da categoria. Paga 3% de CPP e 8% de FGTS.',
    multaFgts: true,
  },
  {
    id: 'domestica',
    label: 'Empregador Doméstico',
    short: 'Doméstica',
    rates: { patronal: 8, rat: 0.8, terceiros: 0, fgts: 8, indenizacao: 3.2 },
    note: 'Pelo DAE do eSocial: 8% de INSS patronal, 0,8% de GILRAT, 8% de FGTS e 3,2% de indenização compensatória, que substitui a multa de 40% do FGTS.',
    multaFgts: false,
  },
  {
    id: 'rural',
    label: 'Produtor Rural (contribuição sobre a receita)',
    short: 'Rural',
    rates: { patronal: 0, rat: 0, terceiros: 2.7, fgts: 8, indenizacao: 0 },
    note: 'Com a opção pela receita bruta, o INSS patronal e o RAT são recolhidos sobre a comercialização da produção (Funrural), e não sobre a folha. Sobre a folha ficam terceiros (2,5% de salário-educação + 0,2% de INCRA) e o FGTS. Adicional noturno rural de 25%.',
    multaFgts: true,
  },
];

export type Adicional = 'nenhum' | 'insal10' | 'insal20' | 'insal40' | 'peric30';

export interface LaborInput {
  regime: Regime;
  rates: Rates;
  salario: number;
  adicional: Adicional;
  outrosAdicionais: number; // gratificações, comissões habituais
  jornadaMensal: number; // horas (ex.: 220)
  he1Horas: number;
  he1Perc: number; // ex.: 50
  he2Horas: number;
  he2Perc: number; // ex.: 100
  noturnoHoras: number;
  diasUteis: number;
  domingosFeriados: number;
  valeTransporte: number; // custo total do VT no mês
  valeAlimentacao: number;
  planoSaude: number;
  outrosBeneficios: number;
  provisionarMulta: boolean;
}

export interface Line {
  label: string;
  value: number;
  hint?: string;
}

export interface LaborResult {
  remuneracao: number;
  valorHora: number;
  encargosPerc: number;
  fixos: Line[];
  totalFixos: number;
  provisoes: Line[];
  totalProvisoes: number;
  totalMensal: number;
  totalAnual: number;
  fatorSobreSalario: number;
}

const pct = (n: number) => n / 100;
const fmtPct = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

export function calcLaborCost(i: LaborInput): LaborResult {
  const r = i.rates;
  const sm = SALARIO_MINIMO_2026;

  // Adicionais de insalubridade (sobre o salário mínimo) ou periculosidade (sobre o salário-base). Não acumulam.
  const insalubridade =
    i.adicional === 'insal10' ? sm * 0.1 : i.adicional === 'insal20' ? sm * 0.2 : i.adicional === 'insal40' ? sm * 0.4 : 0;
  const periculosidade = i.adicional === 'peric30' ? i.salario * 0.3 : 0;

  // Hora normal integrada pelas parcelas salariais habituais (Súmula 264 do TST)
  const baseHora = i.salario + insalubridade + periculosidade + i.outrosAdicionais;
  const valorHora = i.jornadaMensal > 0 ? baseHora / i.jornadaMensal : 0;

  const he1 = i.he1Horas * valorHora * (1 + pct(i.he1Perc));
  const he2 = i.he2Horas * valorHora * (1 + pct(i.he2Perc));
  const percNoturno = i.regime === 'rural' ? 0.25 : 0.2;
  const noturno = i.noturnoHoras * valorHora * percNoturno;
  const variaveis = he1 + he2 + noturno;
  const dsr = i.diasUteis > 0 ? (variaveis / i.diasUteis) * i.domingosFeriados : 0;

  const remuneracao = baseHora + variaveis + dsr;

  const encargosPerc = r.patronal + r.rat + r.terceiros + r.fgts + r.indenizacao;
  const vtEmpresa = Math.max(0, i.valeTransporte - i.salario * 0.06);

  const fixos: Line[] = [
    { label: 'Salário-base', value: i.salario },
  ];
  if (insalubridade) fixos.push({ label: `Adicional de insalubridade (${i.adicional.replace('insal', '')}% do mínimo)`, value: insalubridade });
  if (periculosidade) fixos.push({ label: 'Adicional de periculosidade (30%)', value: periculosidade });
  if (i.outrosAdicionais) fixos.push({ label: 'Gratificações e outros adicionais', value: i.outrosAdicionais });
  if (he1) fixos.push({ label: `Horas extras ${i.he1Perc}% (${i.he1Horas} h)`, value: he1 });
  if (he2) fixos.push({ label: `Horas extras ${i.he2Perc}% (${i.he2Horas} h)`, value: he2 });
  if (noturno) fixos.push({ label: `Adicional noturno ${percNoturno * 100}% (${i.noturnoHoras} h)`, value: noturno });
  if (dsr) fixos.push({ label: 'DSR sobre horas extras e adicional noturno', value: dsr });

  const enc = (label: string, rate: number) => {
    if (rate > 0) fixos.push({ label: `${label} (${fmtPct(rate)})`, value: remuneracao * pct(rate) });
  };
  enc(i.regime === 'mei' ? 'CPP do MEI' : 'INSS patronal', r.patronal);
  enc(i.regime === 'domestica' ? 'GILRAT' : 'RAT', r.rat);
  enc('Terceiros (Sistema S, salário-educação, INCRA)', r.terceiros);
  enc('FGTS', r.fgts);
  enc('Indenização compensatória (FGTS doméstico)', r.indenizacao);

  if (vtEmpresa) fixos.push({ label: 'Vale-transporte (parte da empresa)', value: vtEmpresa, hint: 'Valor que passa de 6% do salário-base' });
  if (i.valeAlimentacao) fixos.push({ label: 'Vale-alimentação / refeição', value: i.valeAlimentacao });
  if (i.planoSaude) fixos.push({ label: 'Plano de saúde', value: i.planoSaude });
  if (i.outrosBeneficios) fixos.push({ label: 'Outros benefícios', value: i.outrosBeneficios });

  const totalFixos = fixos.reduce((s, l) => s + l.value, 0);

  // Provisões mensais (1/12 avos) — viram desembolso nas férias, no 13º e na rescisão
  const ferias = remuneracao / 12;
  const terco = ferias / 3;
  const decimo = remuneracao / 12;
  const baseProvisao = ferias + terco + decimo;
  const encargosProvisao = baseProvisao * pct(encargosPerc);
  const multa =
    i.provisionarMulta && REGIMES.find((x) => x.id === i.regime)?.multaFgts
      ? (remuneracao + baseProvisao) * pct(r.fgts) * 0.4
      : 0;

  const provisoes: Line[] = [
    { label: 'Férias (1/12)', value: ferias },
    { label: '1/3 constitucional de férias', value: terco },
    { label: '13º salário (1/12)', value: decimo },
    { label: `Encargos sobre férias, 1/3 e 13º (${fmtPct(encargosPerc)})`, value: encargosProvisao },
  ];
  if (multa) provisoes.push({ label: 'Multa de 40% do FGTS (rescisão sem justa causa)', value: multa });

  const totalProvisoes = provisoes.reduce((s, l) => s + l.value, 0);
  const totalMensal = totalFixos + totalProvisoes;

  return {
    remuneracao,
    valorHora,
    encargosPerc,
    fixos,
    totalFixos,
    provisoes,
    totalProvisoes,
    totalMensal,
    totalAnual: totalMensal * 12,
    fatorSobreSalario: i.salario > 0 ? totalMensal / i.salario : 0,
  };
}
