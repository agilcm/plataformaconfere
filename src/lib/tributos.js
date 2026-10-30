// Cálculos dos simuladores de /dados/: pró-labore, Simples Nacional (12 meses, com Fator R)
// e comparativo de enquadramento (Simples × Lucro Presumido × Lucro Real). Puro, sem tela.
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

/** Anexo efetivo: atividades com Fator R vão para o III se a folha de 12 meses for ≥ 28% da receita */
export function anexoDe(ativ, fatorR) {
  if (!ativ.fatorR) return ativ.anexo;
  return fatorR >= FATOR_R_MINIMO ? 'III' : 'V';
}

/**
 * Projeção do Simples para 12 meses.
 * @param {{ atividadeId: string, faturamentoMensal: number, crescimentoMensal?: number, receita12Anterior?: number,
 *   folhaMensal?: number, proLaboreMensal?: number, rat?: number, dependentes?: number }} p
 */
export function projecaoSimples(p) {
  const ativ = atividade(p.atividadeId);
  const folha = p.folhaMensal || 0;
  const pl = p.proLaboreMensal || 0;
  const rat = p.rat ?? ENCARGOS.ratPadrao;
  const anexoIV = ativ.anexo === 'IV';
  // últimos 12 meses (receita e folha para o Fator R); sem histórico informado, repete o mês atual
  const receitas = Array(12).fill((p.receita12Anterior ?? p.faturamentoMensal * 12) / 12);
  const folhaFatorR = folha + pl + folha * ENCARGOS.fgts; // salários + pró-labore + FGTS
  const folhas = Array(12).fill(folhaFatorR);
  const plCalc = proLabore(pl, { dependentes: p.dependentes || 0, cppEmpresa: anexoIV });
  const meses = [];
  let fat = p.faturamentoMensal;
  for (let m = 1; m <= 12; m++) {
    if (m > 1) fat = fat * (1 + (p.crescimentoMensal || 0));
    const rbt12 = receitas.reduce((s, v) => s + v, 0);
    const fatorR = rbt12 > 0 ? folhas.reduce((s, v) => s + v, 0) / rbt12 : 0;
    const anexo = anexoDe(ativ, fatorR);
    const aliq = aliquotaSimples(anexo, rbt12);
    const das = r2(fat * aliq.efetiva);
    const fgts = r2(folha * ENCARGOS.fgts);
    const cpp = anexoIV ? r2(folha * (ENCARGOS.patronal + rat)) + plCalc.patronal : 0;
    meses.push({
      mes: m,
      faturamento: r2(fat),
      rbt12: r2(rbt12),
      fatorR,
      anexo,
      faixa: aliq.faixa,
      aliquota: aliq.efetiva,
      das,
      fgts,
      cpp: r2(cpp),
      inssSocio: plCalc.inss,
      irrfSocio: plCalc.irrf,
      totalEmpresa: r2(das + fgts + cpp),
      acimaSublimite: rbt12 > SIMPLES_SUBLIMITE,
      acimaLimite: rbt12 > SIMPLES_LIMITE,
    });
    receitas.shift();
    receitas.push(fat);
    folhas.shift();
    folhas.push(folhaFatorR);
  }
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

// ---------------------------------------------------------------- comparativo de enquadramento

/**
 * Custo anual de tributos e encargos em cada regime, com o mesmo faturamento, folha e pró-labore.
 * @param {{ atividadeId: string, faturamentoMensal: number, folhaMensal: number, proLaboreMensal: number,
 *   aliquotaLocal?: number, rat?: number, comprasComCredito?: number, outrasDespesas?: number, dependentes?: number }} p
 */
export function comparativo(p) {
  const ativ = atividade(p.atividadeId);
  const receita = p.faturamentoMensal;
  const folha = p.folhaMensal || 0;
  const pl = p.proLaboreMensal || 0;
  const rat = p.rat ?? ENCARGOS.ratPadrao;
  const local = p.aliquotaLocal ?? ativ.localPadrao;
  const encargosFolhaCheios = folha * (ENCARGOS.patronal + rat + ENCARGOS.terceiros + ENCARGOS.fgts);
  /** @type {{ id: string, nome: string, elegivel: boolean, aviso: string, linhas: { nome: string, valor: number, anual?: number }[], mensal?: number, anual?: number, percentual?: number }[]} */
  const regimes = [];

  // Simples
  const rbt12 = receita * 12;
  const fatorR = rbt12 > 0 ? ((folha + pl + folha * ENCARGOS.fgts) * 12) / rbt12 : 0;
  const anexo = anexoDe(ativ, fatorR);
  const aliq = aliquotaSimples(anexo, rbt12);
  const anexoIV = anexo === 'IV';
  const simplesEnc = anexoIV ? folha * (ENCARGOS.patronal + rat + ENCARGOS.fgts) + pl * ENCARGOS.patronal : folha * ENCARGOS.fgts;
  regimes.push({
    id: 'simples',
    nome: `Simples Nacional (Anexo ${anexo})`,
    elegivel: rbt12 <= SIMPLES_LIMITE,
    aviso:
      rbt12 > SIMPLES_LIMITE
        ? 'Receita acima de R$ 4,8 milhões por ano: fora do Simples.'
        : rbt12 > SIMPLES_SUBLIMITE
          ? `Acima de R$ 3,6 milhões o ${ativ.local} sai do DAS e é pago por fora (não incluído aqui).`
          : '',
    linhas: [
      { nome: `DAS (alíquota efetiva ${(aliq.efetiva * 100).toFixed(2).replace('.', ',')}%)`, valor: receita * aliq.efetiva },
      { nome: anexoIV ? 'INSS patronal, RAT e FGTS sobre a folha e o pró-labore' : 'FGTS sobre a folha', valor: simplesEnc },
    ],
  });

  // Lucro Presumido
  const pc = PIS_COFINS.cumulativo;
  const baseIrpjP = receita * ativ.presIrpj;
  const irpjP = baseIrpjP * IRPJ.aliq + Math.max(0, baseIrpjP - IRPJ.limiteAdicionalMes) * IRPJ.adicional;
  const csllP = receita * ativ.presCsll * CSLL;
  regimes.push({
    id: 'presumido',
    nome: 'Lucro Presumido',
    elegivel: rbt12 <= 78000000,
    aviso: '',
    linhas: [
      { nome: `PIS e COFINS cumulativos (${((pc.pis + pc.cofins) * 100).toFixed(2).replace('.', ',')}%)`, valor: receita * (pc.pis + pc.cofins) },
      { nome: `IRPJ (presunção de ${ativ.presIrpj * 100}%)`, valor: irpjP },
      { nome: `CSLL (presunção de ${ativ.presCsll * 100}%)`, valor: csllP },
      { nome: `${ativ.local} (${(local * 100).toFixed(2).replace('.', ',')}%)`, valor: receita * local },
      { nome: 'INSS patronal, RAT, terceiros e FGTS sobre a folha', valor: encargosFolhaCheios },
      { nome: 'INSS patronal sobre o pró-labore (20%)', valor: pl * ENCARGOS.patronal },
    ],
  });

  // Lucro Real (estimativa pelo lucro contábil do mês)
  const nc = PIS_COFINS.naoCumulativo;
  const creditos = (p.comprasComCredito || 0) * (nc.pis + nc.cofins);
  const pisCofinsR = Math.max(0, receita * (nc.pis + nc.cofins) - creditos);
  const localR = receita * local;
  const encR = encargosFolhaCheios + pl * ENCARGOS.patronal;
  const lucro = receita - pisCofinsR - localR - folha - encR - pl - (p.comprasComCredito || 0) - (p.outrasDespesas || 0);
  const csllR = Math.max(0, lucro) * CSLL;
  const irpjR = Math.max(0, lucro) * IRPJ.aliq + Math.max(0, lucro - IRPJ.limiteAdicionalMes) * IRPJ.adicional;
  regimes.push({
    id: 'real',
    nome: 'Lucro Real',
    elegivel: true,
    aviso: lucro <= 0 ? 'Com esses custos não há lucro tributável: IRPJ e CSLL zerados.' : '',
    linhas: [
      { nome: `PIS e COFINS não cumulativos (9,25% − créditos de ${brl(creditos)})`, valor: pisCofinsR },
      { nome: `IRPJ sobre o lucro de ${brl(Math.max(0, lucro))}/mês`, valor: irpjR },
      { nome: 'CSLL sobre o lucro', valor: csllR },
      { nome: `${ativ.local} (${(local * 100).toFixed(2).replace('.', ',')}%)`, valor: localR },
      { nome: 'INSS patronal, RAT, terceiros e FGTS sobre a folha', valor: encargosFolhaCheios },
      { nome: 'INSS patronal sobre o pró-labore (20%)', valor: pl * ENCARGOS.patronal },
    ],
  });

  for (const r of regimes) {
    r.linhas = r.linhas.map((l) => ({ ...l, valor: r2(l.valor), anual: r2(l.valor * 12) }));
    r.mensal = r2(r.linhas.reduce((s, l) => s + l.valor, 0));
    r.anual = r2(r.mensal * 12);
    r.percentual = receita > 0 ? r.mensal / receita : 0;
  }
  const validos = regimes.filter((r) => r.elegivel);
  const melhor = validos.reduce((a, b) => (b.anual < a.anual ? b : a), validos[0]);
  return { atividade: ativ, regimes, melhor: melhor?.id, fatorR, anexoSimples: anexo, criticaFatorR: criticarFatorR(p, ativ, fatorR) };
}

/**
 * Atividade com Fator R abaixo de 28%: quanto de pró-labore a mais leva ao Anexo III e se compensa
 * (DAS menor × INSS e IRRF a mais sobre o pró-labore do sócio).
 */
export function criticarFatorR(p, ativ = atividade(p.atividadeId), fatorR) {
  if (!ativ.fatorR) return null;
  const receita = p.faturamentoMensal;
  const folha = p.folhaMensal || 0;
  const pl = p.proLaboreMensal || 0;
  if (fatorR >= FATOR_R_MINIMO) return { ok: true, fatorR };
  const rbt12 = receita * 12;
  const necessario = (FATOR_R_MINIMO * rbt12) / 12 - folha - folha * ENCARGOS.fgts; // pró-labore mensal mínimo
  const novoPl = Math.ceil(Math.max(necessario, pl) * 100) / 100 + 1; // margem de R$ 1
  const dasV = receita * aliquotaSimples('V', rbt12).efetiva;
  const dasIII = receita * aliquotaSimples('III', rbt12).efetiva;
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

function brl(v) {
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
