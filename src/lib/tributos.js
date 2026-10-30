// Cálculos dos simuladores de /dados/: pró-labore, Simples Nacional (12 meses, com Fator R)
// e comparação com o Lucro Presumido. Puro, sem tela.
import {
  CSLL,
  ENCARGOS,
  FATOR_R_MINIMO,
  INSS_PRO_LABORE,
  IRPJ,
  IRRF_DEPENDENTE,
  IRRF_DESCONTO_SIMPLIFICADO,
  IRRF_FAIXAS,
  IRRF_REDUCAO,
  PIS_COFINS,
  SIMPLES_ANEXOS,
  SIMPLES_LIMITE,
  SIMPLES_SUBLIMITE,
  TETO_INSS,
} from '../data/parametrosFiscais.js';
import { atividade } from '../data/atividadesFiscais.js';

const r2 = (v) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------- pró-labore

/** IRRF mensal com a redução da Lei 15.270/2025 */
export function irrfMensal(bruto, { inss = 0, dependentes = 0 } = {}) {
  const deducaoLegal = inss + dependentes * IRRF_DEPENDENTE;
  const deducao = Math.max(deducaoLegal, IRRF_DESCONTO_SIMPLIFICADO);
  const base = Math.max(0, bruto - deducao);
  const f = IRRF_FAIXAS.find((x) => base <= x.ate);
  const tabela = Math.max(0, base * f.aliq - f.deduzir);
  let reducao = 0;
  if (bruto <= IRRF_REDUCAO.isentoAte) reducao = Math.min(tabela, IRRF_REDUCAO.maxReducao);
  else if (bruto <= IRRF_REDUCAO.faixaAte) reducao = Math.max(0, IRRF_REDUCAO.a - IRRF_REDUCAO.b * bruto);
  return {
    base: r2(base),
    deducao: r2(deducao),
    simplificado: deducao > deducaoLegal,
    aliquota: f.aliq,
    tabela: r2(tabela),
    reducao: r2(Math.min(reducao, tabela)),
    imposto: r2(Math.max(0, tabela - reducao)),
  };
}

/**
 * Pró-labore do sócio: INSS de 11% (até o teto) e IRRF descontados dele; INSS patronal de 20%
 * pago pela empresa quando a CPP não está no DAS (Lucro Presumido, Lucro Real e Simples Anexo IV).
 */
export function proLabore(bruto, { dependentes = 0, cppEmpresa = false } = {}) {
  const inss = r2(Math.min(bruto, TETO_INSS) * INSS_PRO_LABORE);
  const ir = irrfMensal(bruto, { inss, dependentes });
  const patronal = cppEmpresa ? r2(bruto * ENCARGOS.patronal) : 0;
  return {
    bruto,
    inss,
    irrf: ir.imposto,
    ir,
    liquido: r2(bruto - inss - ir.imposto),
    patronal,
    custoEmpresa: r2(bruto + patronal),
  };
}

// ---------------------------------------------------------------- Simples Nacional

/** Alíquota efetiva do Simples: (RBT12 × nominal − parcela a deduzir) ÷ RBT12 */
export function aliquotaSimples(anexo, rbt12) {
  const faixas = SIMPLES_ANEXOS[anexo];
  const receita = Math.max(rbt12, 0.01);
  const i = faixas.findIndex(([ate]) => receita <= ate);
  const [, nominal, deduzir] = faixas[i < 0 ? faixas.length - 1 : i];
  return { faixa: (i < 0 ? faixas.length : i + 1), nominal, efetiva: Math.max(0, (receita * nominal - deduzir) / receita) };
}

/**
 * Folha de salários do Fator R num mês médio (LC 123/2006, art. 18, § 24): remunerações pagas a pessoas físicas
 * (salários, com 13º e 1/3 de férias em média mensal, e pró-labore) mais o FGTS recolhido.
 * A CPP das atividades com Fator R está dentro do DAS (Anexos III e V), por isso não entra aqui.
 */
export function folhaFatorR(folhaMensal, proLaboreMensal) {
  const salarios = folhaMensal || 0;
  const decimoFerias = salarios / 12 + salarios / 36; // 13º (1/12) + 1/3 de férias (1/12 × 1/3)
  const fgts = (salarios + decimoFerias) * ENCARGOS.fgts;
  const proLab = proLaboreMensal || 0;
  return { salarios, decimoFerias, fgts, proLabore: proLab, total: salarios + decimoFerias + fgts + proLab };
}

/** Fator R e a conta passo a passo (12 meses), para conferir */
export function contaFatorR(folhaMensal, proLaboreMensal, rbt12) {
  const f = folhaFatorR(folhaMensal, proLaboreMensal);
  const x12 = (v) => r2(v * 12);
  const folha12 = x12(f.total);
  return {
    salarios12: x12(f.salarios),
    decimoFerias12: x12(f.decimoFerias),
    fgts12: x12(f.fgts),
    proLabore12: x12(f.proLabore),
    folha12,
    rbt12: r2(rbt12),
    fator: rbt12 > 0 ? folha12 / rbt12 : 0,
  };
}

/** Anexo efetivo: atividades com Fator R vão para o III se a folha de 12 meses for ≥ 28% da receita */
export function anexoDe(ativ, fatorR) {
  if (!ativ.fatorR) return ativ.anexo;
  return fatorR >= FATOR_R_MINIMO ? 'III' : 'V';
}

/** Faturamento dos 12 meses: o mesmo valor, com crescimento ao mês, ou digitado mês a mês */
export function faturamentosDe(faturamentoMensal, crescimentoMensal = 0) {
  return Array.from({ length: 12 }, (_, i) => r2(faturamentoMensal * (1 + crescimentoMensal) ** i));
}

/**
 * RBT12 de cada mês (LC 123/2006, art. 18, §§ 1º e 2º): soma da receita dos 12 meses anteriores.
 * Empresa em início de atividade: no 1º mês, receita do próprio mês × 12; do 2º ao 12º, média dos meses anteriores × 12.
 * @param {number[]} faturamentos  receita de cada mês projetado
 * @param {{ tipo: 'existente', receita12: number } | { tipo: 'nova' }} historico
 */
export function rbt12DosMeses(faturamentos, historico) {
  if (historico.tipo === 'nova') {
    return faturamentos.map((f, i) => (i === 0 ? f * 12 : (faturamentos.slice(0, i).reduce((s, v) => s + v, 0) / i) * 12));
  }
  const janela = Array(12).fill((historico.receita12 || 0) / 12);
  return faturamentos.map((f) => {
    const rbt12 = janela.reduce((s, v) => s + v, 0);
    janela.shift();
    janela.push(f);
    return rbt12;
  });
}

/**
 * Projeção do Simples para 12 meses.
 * @param {{ atividadeId: string, faturamentos: number[], historico: { tipo: 'existente', receita12: number } | { tipo: 'nova' },
 *   folhaMensal?: number, proLaboreMensal?: number, rat?: number, dependentes?: number }} p
 */
export function projecaoSimples(p) {
  const ativ = atividade(p.atividadeId);
  const folha = p.folhaMensal || 0;
  const pl = p.proLaboreMensal || 0;
  const rat = p.rat ?? ENCARGOS.ratPadrao;
  const anexoIV = ativ.anexo === 'IV';
  const folhaMes = folhaFatorR(folha, pl).total;
  const plCalc = proLabore(pl, { dependentes: p.dependentes || 0, cppEmpresa: anexoIV });
  const rbts = rbt12DosMeses(p.faturamentos, p.historico);
  const meses = p.faturamentos.map((fat, i) => {
    const rbt12 = rbts[i];
    // a folha do Fator R segue a mesma janela da receita (média mensal × 12)
    const fatorR = rbt12 > 0 ? (folhaMes * 12) / rbt12 : 0;
    const anexo = anexoDe(ativ, fatorR);
    const aliq = aliquotaSimples(anexo, rbt12);
    const das = r2(fat * aliq.efetiva);
    const fgts = r2(folha * ENCARGOS.fgts);
    const cpp = anexoIV ? r2(folha * (ENCARGOS.patronal + rat) + plCalc.patronal) : 0;
    return {
      mes: i + 1,
      faturamento: r2(fat),
      rbt12: r2(rbt12),
      fatorR,
      anexo,
      faixa: aliq.faixa,
      aliquota: aliq.efetiva,
      das,
      fgts,
      cpp,
      inssSocio: plCalc.inss,
      irrfSocio: plCalc.irrf,
      totalEmpresa: r2(das + fgts + cpp),
      acimaSublimite: rbt12 > SIMPLES_SUBLIMITE,
      acimaLimite: rbt12 > SIMPLES_LIMITE,
    };
  });
  const soma = (k) => r2(meses.reduce((s, x) => s + x[k], 0));
  const totais = {
    faturamento: soma('faturamento'),
    das: soma('das'),
    fgts: soma('fgts'),
    cpp: soma('cpp'),
    inssSocio: soma('inssSocio'),
    irrfSocio: soma('irrfSocio'),
    totalEmpresa: soma('totalEmpresa'),
  };
  return { atividade: ativ, meses, totais, proLabore: plCalc, cargaEfetiva: totais.faturamento ? totais.totalEmpresa / totais.faturamento : 0 };
}

// ---------------------------------------------------------------- Lucro Presumido

/** Alíquotas padrão do Lucro Presumido para a atividade (todas editáveis na tela) */
export function aliquotasPresumido(ativ) {
  return {
    pis: PIS_COFINS.cumulativo.pis,
    cofins: PIS_COFINS.cumulativo.cofins,
    presIrpj: ativ.presIrpj,
    presCsll: ativ.presCsll,
    irpj: IRPJ.aliq,
    adicionalIrpj: IRPJ.adicional,
    limiteAdicionalMes: IRPJ.limiteAdicionalMes,
    csll: CSLL,
    local: ativ.localPadrao,
    patronal: ENCARGOS.patronal,
    rat: ENCARGOS.ratPadrao,
    terceiros: ENCARGOS.terceiros,
    fgts: ENCARGOS.fgts,
  };
}

/**
 * Lucro Presumido nos mesmos 12 meses: PIS e COFINS cumulativos, IRPJ e CSLL sobre a presunção,
 * ISS ou ICMS, encargos sobre a folha e INSS patronal sobre o pró-labore.
 * @param {number[]} faturamentos
 * @param {{ folhaMensal?: number, proLaboreMensal?: number }} p
 * @param {ReturnType<typeof aliquotasPresumido>} a
 */
export function projecaoPresumido(faturamentos, p, a) {
  const folha = p.folhaMensal || 0;
  const pl = p.proLaboreMensal || 0;
  const meses = faturamentos.map((fat, i) => {
    const pisCofins = fat * (a.pis + a.cofins);
    const baseIrpj = fat * a.presIrpj;
    // adicional de 10% sobre a base que passa de R$ 60 mil no trimestre (R$ 20 mil por mês)
    const irpj = baseIrpj * a.irpj + Math.max(0, baseIrpj - a.limiteAdicionalMes) * a.adicionalIrpj;
    const csll = fat * a.presCsll * a.csll;
    const local = fat * a.local;
    const encargosFolha = folha * (a.patronal + a.rat + a.terceiros + a.fgts);
    const patronalPl = pl * a.patronal;
    const total = pisCofins + irpj + csll + local + encargosFolha + patronalPl;
    return {
      mes: i + 1,
      faturamento: r2(fat),
      pisCofins: r2(pisCofins),
      irpj: r2(irpj),
      csll: r2(csll),
      local: r2(local),
      encargosFolha: r2(encargosFolha),
      patronalPl: r2(patronalPl),
      total: r2(total),
    };
  });
  const soma = (k) => r2(meses.reduce((s, x) => s + x[k], 0));
  const totais = {
    faturamento: soma('faturamento'),
    pisCofins: soma('pisCofins'),
    irpj: soma('irpj'),
    csll: soma('csll'),
    local: soma('local'),
    encargosFolha: soma('encargosFolha'),
    patronalPl: soma('patronalPl'),
    total: soma('total'),
  };
  return { meses, totais, carga: totais.faturamento ? totais.total / totais.faturamento : 0 };
}

/**
 * Atividade com Fator R abaixo de 28%: quanto de pró-labore a mais leva ao Anexo III e se compensa
 * (DAS menor × INSS e IRRF a mais sobre o pró-labore do sócio). Usa o 1º mês da projeção.
 * @param {{ atividadeId: string, faturamento: number, rbt12: number, folhaMensal?: number, proLaboreMensal?: number, dependentes?: number }} p
 */
export function criticarFatorR(p) {
  const ativ = atividade(p.atividadeId);
  if (!ativ.fatorR) return null;
  const folha = p.folhaMensal || 0;
  const pl = p.proLaboreMensal || 0;
  const fatorR = p.rbt12 > 0 ? (folhaFatorR(folha, pl).total * 12) / p.rbt12 : 0;
  if (fatorR >= FATOR_R_MINIMO) return { ok: true, fatorR };
  const necessario = (FATOR_R_MINIMO * p.rbt12) / 12 - folhaFatorR(folha, 0).total; // pró-labore mensal mínimo
  const novoPl = Math.ceil(Math.max(necessario, pl) * 100) / 100 + 1; // margem de R$ 1
  const dasV = p.faturamento * aliquotaSimples('V', p.rbt12).efetiva;
  const dasIII = p.faturamento * aliquotaSimples('III', p.rbt12).efetiva;
  const atual = proLabore(pl, { dependentes: p.dependentes || 0 });
  const novo = proLabore(novoPl, { dependentes: p.dependentes || 0 });
  const custoExtraSocio = novo.inss + novo.irrf - (atual.inss + atual.irrf);
  return {
    ok: false,
    fatorR,
    proLaboreNecessario: r2(novoPl),
    aumentoProLabore: r2(novoPl - pl),
    economiaDasMes: r2(dasV - dasIII),
    custoExtraMes: r2(custoExtraSocio),
    ganhoLiquidoMes: r2(dasV - dasIII - custoExtraSocio),
    ganhoLiquidoAno: r2((dasV - dasIII - custoExtraSocio) * 12),
  };
}
