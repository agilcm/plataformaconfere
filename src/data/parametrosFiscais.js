// Parâmetros fiscais usados nos simuladores da área /dados/.
// Tudo num lugar só para conferir e atualizar todo ano. Vigência: 2026.
// Fontes: LC 123/2006 (Anexos I a V, redação da LC 155/2016), Lei 9.249/95 e 9.718/98 (presunções),
// Lei 15.270/2025 (redução do IRRF a partir de jan/2026), tabela do INSS 2026.

export const VIGENCIA = '2026';

export const SALARIO_MINIMO = 1621;
/** Teto do salário de contribuição do INSS */
export const TETO_INSS = 8475.55;
/** Contribuinte individual (sócio com pró-labore): 11% até o teto */
export const INSS_PRO_LABORE = 0.11;

// IRRF mensal (tabela vigente desde mai/2025, mantida em 2026)
export const IRRF_FAIXAS = [
  { ate: 2428.8, aliq: 0, deduzir: 0 },
  { ate: 2826.65, aliq: 0.075, deduzir: 182.16 },
  { ate: 3751.05, aliq: 0.15, deduzir: 394.16 },
  { ate: 4664.68, aliq: 0.225, deduzir: 675.49 },
  { ate: Infinity, aliq: 0.275, deduzir: 908.73 },
];
export const IRRF_DEPENDENTE = 189.59;
/** Desconto simplificado mensal (substitui INSS e dependentes quando for melhor) */
export const IRRF_DESCONTO_SIMPLIFICADO = 607.2;
/** Lei 15.270/2025: rendimentos até R$ 5.000 ficam isentos; entre R$ 5.000,01 e R$ 7.350 a redução é 978,62 − 0,133145 × rendimentos */
export const IRRF_REDUCAO = { isentoAte: 5000, faixaAte: 7350, a: 978.62, b: 0.133145, maxReducao: 312.89 };

// Simples Nacional: [receita bruta em 12 meses até, alíquota nominal, parcela a deduzir]
export const SIMPLES_ANEXOS = {
  I: [[180000, 0.04, 0], [360000, 0.073, 5940], [720000, 0.095, 13860], [1800000, 0.107, 22500], [3600000, 0.143, 87300], [4800000, 0.19, 378000]],
  II: [[180000, 0.045, 0], [360000, 0.078, 5940], [720000, 0.1, 13860], [1800000, 0.112, 22500], [3600000, 0.147, 85500], [4800000, 0.3, 720000]],
  III: [[180000, 0.06, 0], [360000, 0.112, 9360], [720000, 0.135, 17640], [1800000, 0.16, 35640], [3600000, 0.21, 125640], [4800000, 0.33, 648000]],
  IV: [[180000, 0.045, 0], [360000, 0.09, 8100], [720000, 0.102, 12420], [1800000, 0.14, 39780], [3600000, 0.22, 183780], [4800000, 0.33, 828000]],
  V: [[180000, 0.155, 0], [360000, 0.18, 4500], [720000, 0.195, 9900], [1800000, 0.205, 17100], [3600000, 0.23, 62100], [4800000, 0.305, 540000]],
};
export const SIMPLES_LIMITE = 4800000;
/** Acima deste valor o ICMS e o ISS saem do DAS e são pagos por fora */
export const SIMPLES_SUBLIMITE = 3600000;
/** Fator R: folha de 12 meses ÷ receita de 12 meses ≥ 28% → Anexo III; abaixo → Anexo V */
export const FATOR_R_MINIMO = 0.28;

// Encargos sobre a folha (%)
export const ENCARGOS = {
  patronal: 0.2, // INSS patronal / CPP
  terceiros: 0.058, // Sistema S, salário-educação, INCRA
  fgts: 0.08,
  ratPadrao: 0.02, // RAT ajustado pelo FAP: 1% a 3% conforme a atividade
};

// Lucro Presumido e Lucro Real
export const IRPJ = { aliq: 0.15, adicional: 0.1, limiteAdicionalMes: 20000 };
export const CSLL = 0.09;
export const PIS_COFINS = { cumulativo: { pis: 0.0065, cofins: 0.03 }, naoCumulativo: { pis: 0.0165, cofins: 0.076 } };
