// Relatório em PDF da projeção do Simples Nacional (layout Ágil CM, pdfReport.ts).
import { FATOR_R_MINIMO } from '../data/parametrosFiscais.js';

const moeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const valor = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v, casas = 2) => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
const dir = (text, bold = false) => ({ text, align: 'right', bold });
const centro = (text, bold = false) => ({ text, align: 'center', bold });

/**
 * Blocos do PDF "Projeção do Simples Nacional".
 * @param {any} o { simples, presumido?, critica?, mesQueCai?, proLaboreParaMes?, plSimples, plPresumido?, aliqP?, atividade, folha, pl, dep, situacao, rec12, cresc, mesAMes, dataText }
 */
export function blocosPdfSimples(o) {
  const { simples, presumido, atividade, critica } = o;
  const m0 = simples.meses[0];
  const ult = simples.meses[simples.meses.length - 1];
  const anexoIV = atividade.anexo === 'IV';
  const b = [
    { type: 'date', text: o.dataText },
    { type: 'title', text: 'Projeção do Simples Nacional · 12 meses' },
    {
      type: 'para',
      text: `${atividade.nome}. Folha de salários de ${moeda(o.folha)} e pró-labore de ${moeda(o.pl)} por mês. ${
        o.mesAMes ? 'Faturamento informado mês a mês' : `Faturamento inicial de ${moeda(simples.meses[0].faturamento)} por mês${o.cresc ? `, crescendo ${valor(o.cresc)}% ao mês` : ''}`
      }. ${o.situacao === 'nova' ? 'Empresa em início de atividade.' : `Receita dos 12 meses anteriores ao início da projeção: ${moeda(o.rec12)}.`}`,
      gapAfter: 8,
    },
    { type: 'heading', text: 'Resumo' },
    {
      type: 'table',
      widths: [0.6, 0.4],
      rows: [
        ['Faturamento em 12 meses', dir(moeda(simples.totais.faturamento))],
        ['DAS em 12 meses', dir(moeda(simples.totais.das))],
        ['FGTS em 12 meses', dir(moeda(simples.totais.fgts))],
        ...(anexoIV ? [['CPP fora do DAS (Anexo IV)', dir(moeda(simples.totais.cpp))]] : []),
        [`Alíquota efetiva: mês 1 para mês ${ult.mes}`, dir(`${pct(m0.aliquota)} para ${pct(ult.aliquota)}`)],
        [`Anexo e faixa: mês 1 para mês ${ult.mes}`, dir(`${m0.anexo} (${m0.faixa}ª) para ${ult.anexo} (${ult.faixa}ª)`)],
        ['Carga sobre o faturamento', dir(pct(simples.cargaEfetiva))],
        [{ text: 'Total da empresa no Simples', bold: true }, dir(moeda(simples.totais.totalEmpresa), true)],
      ],
      totalRows: 1,
    },
  ];

  b.push({ type: 'heading', text: 'Simples mês a mês' });
  b.push({
    type: 'para',
    text: 'Valores em R$. A alíquota efetiva de cada mês é calculada sobre a receita dos 12 meses anteriores (RBT12): o faturamento projetado de cada mês entra na receita dos meses seguintes, e a alíquota sobe sempre que essa receita cresce (em negrito, os meses em que subiu).',
    size: 9,
    color: 'muted',
    gapAfter: 4,
  });
  const cab = ['Mês', 'Faturamento', 'Receita 12 meses', ...(atividade.fatorR ? ['Fator R'] : []), 'Anexo', 'Alíquota', 'DAS', 'FGTS', ...(anexoIV ? ['CPP'] : []), 'Total'];
  const larg = { Mês: 0.06, Faturamento: 0.13, 'Receita 12 meses': 0.15, 'Fator R': 0.1, Anexo: 0.08, Alíquota: 0.1, DAS: 0.13, FGTS: 0.1, CPP: 0.11, Total: 0.13 };
  b.push({
    type: 'table',
    widths: cab.map((h) => larg[h]),
    header: cab,
    headerAlign: cab.map((h) => (h === 'Mês' || h === 'Anexo' ? 'center' : 'right')),
    rows: [
      ...simples.meses.map((m, i) => {
        const subiu = i > 0 && m.aliquota > simples.meses[i - 1].aliquota + 1e-9;
        return [
          centro(String(m.mes)),
          dir(valor(m.faturamento)),
          dir(valor(m.rbt12)),
          ...(atividade.fatorR ? [dir(pct(m.fatorR, 1), m.fatorR < FATOR_R_MINIMO)] : []),
          centro(`${m.anexo} · ${m.faixa}ª`),
          dir(pct(m.aliquota), subiu),
          dir(valor(m.das)),
          dir(valor(m.fgts)),
          ...(anexoIV ? [dir(valor(m.cpp))] : []),
          dir(valor(m.totalEmpresa)),
        ];
      }),
      [
        centro('Total', true),
        dir(valor(simples.totais.faturamento), true),
        '',
        ...(atividade.fatorR ? [''] : []),
        '',
        dir(pct(simples.totais.faturamento ? simples.totais.das / simples.totais.faturamento : 0), true),
        dir(valor(simples.totais.das), true),
        dir(valor(simples.totais.fgts), true),
        ...(anexoIV ? [dir(valor(simples.totais.cpp), true)] : []),
        dir(valor(simples.totais.totalEmpresa), true),
      ],
    ],
    totalRows: 1,
  });

  b.push({ type: 'heading', text: 'Pró-labore do sócio (mês)' });
  const p = o.plSimples;
  b.push({
    type: 'table',
    widths: [0.6, 0.4],
    rows: [
      ['Pró-labore bruto', dir(moeda(p.bruto))],
      ['INSS do sócio (11%)', dir(`- ${moeda(p.inss)}`)],
      [`IRRF${p.ir?.reducao ? ` (redução de ${moeda(p.ir.reducao)} da Lei 15.270/2025)` : ''}`, dir(`- ${moeda(p.irrf)}`)],
      ['INSS patronal da empresa', dir(anexoIV ? moeda(p.patronal) : 'incluído no DAS')],
      [{ text: 'Líquido para o sócio', bold: true }, dir(moeda(p.liquido), true)],
    ],
    totalRows: 1,
  });

  if (atividade.fatorR && critica) {
    b.push({ type: 'heading', text: 'Fator R' });
    if (!critica.ok)
      b.push({
        type: 'para',
        text: `O Fator R está em ${pct(critica.fatorR, 1)}, abaixo de ${pct(FATOR_R_MINIMO, 0)}: a empresa paga pelo Anexo V. Com pró-labore de ${moeda(critica.proLaboreNecessario)} (mais ${moeda(critica.aumentoProLabore)} por mês) ela passa ao Anexo III: ${moeda(critica.economiaDasMes)} a menos de DAS e ${moeda(critica.custoExtraMes)} a mais de INSS e IRRF por mês, ${critica.ganhoLiquidoMes > 0 ? `ganho líquido de ${moeda(critica.ganhoLiquidoAno)}` : `perda de ${moeda(Math.abs(critica.ganhoLiquidoAno))}`} por ano.`,
      });
    else if (o.mesQueCai)
      b.push({
        type: 'para',
        text: `Começa em ${pct(critica.fatorR, 1)} (Anexo III), mas chega a ${pct(o.mesQueCai.fatorR, 1)} no mês ${o.mesQueCai.mes} e a empresa passa ao Anexo V. Para continuar no Anexo III, o pró-labore precisaria ser de pelo menos ${moeda(o.proLaboreParaMes)} a partir desse mês.`,
      });
    else b.push({ type: 'para', text: `Fator R de ${pct(critica.fatorR, 1)}: igual ou acima de ${pct(FATOR_R_MINIMO, 0)}, a empresa fica no Anexo III durante a projeção.` });
  }

  if (presumido) {
    const melhorPresumido = presumido.totais.total < simples.totais.totalEmpresa;
    b.push({ type: 'heading', text: 'Simples Nacional × Lucro Presumido (12 meses)' });
    b.push({
      type: 'table',
      widths: [0.6, 0.4],
      rows: [
        ['PIS e COFINS', dir(moeda(presumido.totais.pisCofins))],
        ['IRPJ (com adicional)', dir(moeda(presumido.totais.irpj))],
        ['CSLL', dir(moeda(presumido.totais.csll))],
        [atividade.local, dir(moeda(presumido.totais.local))],
        ['Encargos sobre a folha', dir(moeda(presumido.totais.encargosFolha))],
        ['INSS patronal do pró-labore', dir(moeda(presumido.totais.patronalPl))],
        [{ text: `Total no Lucro Presumido (${pct(presumido.carga)} do faturamento)`, bold: true }, dir(moeda(presumido.totais.total), true)],
        [{ text: `Total no Simples Nacional (${pct(simples.cargaEfetiva)} do faturamento)`, bold: true }, dir(moeda(simples.totais.totalEmpresa), true)],
      ],
      totalRows: 2,
    });
    b.push({
      type: 'para',
      text: `Diferença em 12 meses: ${moeda(Math.abs(presumido.totais.total - simples.totais.totalEmpresa))} a favor do ${melhorPresumido ? 'Lucro Presumido' : 'Simples Nacional'}.`,
      bold: true,
    });
    const a = o.aliqP;
    if (a)
      b.push({
        type: 'note',
        text: `Alíquotas do Lucro Presumido usadas: PIS ${pct(a.pis)}, COFINS ${pct(a.cofins)}, presunção IRPJ ${pct(a.presIrpj, 0)} e CSLL ${pct(a.presCsll, 0)}, IRPJ ${pct(a.irpj, 0)} + adicional ${pct(a.adicionalIrpj, 0)}, CSLL ${pct(a.csll, 0)}, ${atividade.local} ${pct(a.local)}, INSS patronal ${pct(a.patronal, 0)}, RAT ${pct(a.rat)}, terceiros ${pct(a.terceiros)}, FGTS ${pct(a.fgts, 0)}.`,
      });
  }

  b.push({
    type: 'note',
    text: 'Base legal: LC 123/2006, art. 18 (RBT12, § 2º empresa nova, §§ 5º-J e 5º-M Fator R, § 24 folha com 13º, férias e FGTS). Não considera IPI, ICMS-ST, DIFAL nem a reforma tributária (CBS e IBS). Estimativa para planejamento; confirme com o contador.',
  });
  return b;
}
