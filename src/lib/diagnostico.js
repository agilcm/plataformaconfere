// Diagnóstico de licitações de uma empresa (aba Possíveis clientes): onde ela perdeu nos últimos 12 meses, por quanto,
// o que os números sugerem e como a assessoria da Ágil CM resolve. Vira um PDF no papel da Ágil e uma mensagem curta
// para o primeiro contato. Puro: recebe a empresa e as licitações da lista, devolve os blocos do PDF.
import { cnpjFormatado, diferenca, textoColocacao } from './possiveisClientes.js';

const moeda = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: v < 10 ? 4 : 2 }));
const moedaInteira = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (v) => `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const lance = (v, desconto) => (v == null ? '—' : desconto ? `${pct(v)} de desconto` : moeda(v));
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
// descrição do item na tabela: o começo basta para reconhecer o produto
const curta = (t, max = 64) => {
  const s = String(t || '').replace(/…$/, '');
  return s.length > max ? `${s.slice(0, max).replace(/\s+\S*$/, '')}…` : s;
};
const semAcento = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

/**
 * Quão perto a empresa ficou da vencedora: em % do preço (menor preço) ou em pontos percentuais (maior desconto).
 * @returns {{ valor: number, texto: string } | null}
 */
export function distancia(d) {
  if (d.venc == null || d.melhor == null) return null;
  if (d.desconto) {
    const pp = d.venc - d.melhor;
    if (Math.abs(pp) < 0.005) return { valor: 0, texto: 'mesmo desconto', empate: true };
    return { valor: pp, texto: `${pp.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} p.p. de desconto a menos` };
  }
  const dif = diferenca(d);
  if (dif == null) return null;
  // mesmo lance da vencedora: perdeu no desempate (leva quem registrou o lance primeiro)
  if (Math.abs(dif) < 0.05) return { valor: 0, texto: 'mesmo preço', empate: true };
  return { valor: dif, texto: `${dif >= 0 ? '+' : ''}${pct(dif)}` };
}

/** Ficou perto: até 5% acima do preço vencedor, ou até 2 pontos de desconto abaixo */
export const ficouPerto = (d) => {
  const x = distancia(d);
  return !!x && x.valor >= 0 && x.valor <= (d.desconto ? 2 : 5);
};

/** Os números do diagnóstico */
export function analisar(empresa, licitacoes) {
  const ds = empresa.disputas || [];
  const conta = (f) => ds.filter(f).length;
  const orgaos = new Map();
  for (const d of ds) {
    const lic = licitacoes[d.lic];
    const k = `${lic.orgao}|${lic.municipio}`;
    orgaos.set(k, { orgao: lic.orgao, municipio: lic.municipio, uf: lic.uf, itens: (orgaos.get(k)?.itens || 0) + 1 });
  }
  const difs = ds
    .filter((d) => !d.desconto)
    .map((d) => diferenca(d))
    .filter((x) => x != null && x >= 0);
  const mediana = difs.length ? [...difs].sort((a, b) => a - b)[Math.floor(difs.length / 2)] : null;
  return {
    itens: ds.length,
    licitacoes: new Set(ds.map((d) => d.lic)).size,
    orgaos: [...orgaos.values()].sort((a, b) => b.itens - a.itens),
    segundo: conta((d) => d.col === 2),
    terceiroAoQuinto: conta((d) => d.col >= 3 && d.col <= 5),
    naoLevou: conta((d) => d.col === 0),
    perto: conta(ficouPerto),
    longe: difs.filter((x) => x > 20).length,
    comDiferenca: difs.length,
    medianaDiferenca: mediana,
    // lances por item contam a proposta: 1 = só mandou a proposta e não disputou
    soProposta: conta((d) => d.lances <= 1),
    empates: conta((d) => d.col >= 2 && !!distancia(d)?.empate),
    vitorias: empresa.vitorias || 0,
    valorNaMesa: ds.reduce((s, d) => s + (d.vt || 0), 0),
  };
}

/** Em ordem de "dá para virar": melhor preço sem levar, depois os mais perto da vencedora */
function maisPerto(ds) {
  const chave = (d) => {
    if (d.col === 0) return -1;
    const x = distancia(d);
    return x ? Math.max(0, x.valor) : 999;
  };
  return [...ds].sort((a, b) => chave(a) - chave(b) || a.col - b.col);
}

/** O que os números sugerem (hipóteses, para conversar com a empresa) */
export function leituras(a) {
  const out = [];
  if (a.naoLevou)
    out.push(
      `Em ${plural(a.naoLevou, 'item', 'itens')} a empresa ofereceu o melhor preço e mesmo assim não levou. Isso costuma vir de documento de habilitação faltando ou vencido, proposta fora do modelo do edital ou desclassificação técnica: é perda que se evita conferindo tudo antes do envio.`,
    );
  if (a.empates)
    out.push(
      `Em ${plural(a.empates, 'item', 'itens')} a empresa deu o mesmo lance da vencedora e perdeu no desempate, que fica com quem registrou o lance primeiro. Lançar no momento certo resolve esse tipo de perda.`,
    );
  if (a.perto)
    out.push(
      `Em ${plural(a.perto, 'item', 'itens')} a diferença para a vencedora foi pequena (até 5% no preço ou 2 pontos no desconto). Com estratégia de lance e acompanhamento da sessão, boa parte desses itens poderia ter outro resultado.`,
    );
  if (a.itens >= 4 && a.soProposta / a.itens >= 0.5)
    out.push(
      `Em ${plural(a.soProposta, 'item', 'itens')} a empresa mandou só a proposta e não deu lances na disputa. Acompanhar a sessão ao vivo e lançar no tempo certo costuma mudar a colocação.`,
    );
  if (a.comDiferenca >= 3 && a.longe / a.comDiferenca >= 0.5)
    out.push(
      `Na maior parte dos itens a diferença passou de 20%${a.medianaDiferenca != null ? ` (diferença típica: ${pct(a.medianaDiferenca)})` : ''}. Vale rever fornecedores e a composição do preço, e escolher melhor em quais itens entrar.`,
    );
  if (a.orgaos.length) {
    const top = a.orgaos.slice(0, 3).map((o) => `${o.orgao} (${plural(o.itens, 'item', 'itens')})`);
    out.push(`Onde a empresa mais disputa: ${top.join('; ')}. São compradores que já conhecem a empresa e voltam a licitar os mesmos itens.`);
  }
  if (a.vitorias) out.push(`A empresa também venceu ${plural(a.vitorias, 'item', 'itens')} no período: já tem estrutura para vender ao poder público.`);
  return out;
}

/** "da Zona da Mata (mineira)" ou "de Minas Gerais" */
const deOnde = (abrangencia, mineira = false) => (abrangencia === 'Zona da Mata' ? `da Zona da Mata${mineira ? ' mineira' : ''}` : 'de Minas Gerais');

/**
 * Blocos do PDF do diagnóstico.
 * @param {any} empresa  empresa da lista Possíveis clientes (todas as disputas, sem filtro)
 * @param {{ licitacoes: any[], desde?: string, ate?: string, atualizadoEm?: string, portal?: string }} dados
 * @param {{ data: string, contato: { whatsapp: string, email: string, site: string }, abrangencia?: string }} o
 *   abrangencia: de onde são as licitações analisadas ("Zona da Mata" ou, sem nada, Minas Gerais)
 */
export function blocosDiagnostico(empresa, dados, o) {
  const a = analisar(empresa, dados.licitacoes);
  const periodo = dados.desde ? `de ${dataBR(dados.desde)} a ${dataBR(dados.ate || dados.atualizadoEm)}` : 'dos últimos 12 meses';
  const lista = maisPerto(empresa.disputas || []).slice(0, 10);
  const resto = a.itens - lista.length;
  return [
    { type: 'date', text: o.data },
    { type: 'title', text: 'Diagnóstico de licitações' },
    { type: 'para', text: empresa.razao, bold: true, size: 12 },
    {
      type: 'para',
      text: [
        `CNPJ ${cnpjFormatado(empresa.cnpj)}`,
        empresa.cidade && `${empresa.cidade} - ${empresa.uf}`,
        empresa.fantasia && empresa.fantasia !== empresa.razao && empresa.fantasia,
      ]
        .filter(Boolean)
        .join(' · '),
      color: 'muted',
      gapAfter: 8,
    },
    {
      type: 'para',
      text: `Analisamos as licitações ${deOnde(o.abrangencia, true)} ${periodo} em que a empresa participou e não venceu. Os números abaixo saem das atas das sessões, publicadas pelos próprios órgãos no Portal Nacional de Contratações Públicas (PNCP).`,
    },
    { type: 'heading', text: 'Resumo' },
    {
      type: 'table',
      size: 9,
      widths: [1, 1, 1, 1, 1],
      header: ['Itens sem vencer', 'Licitações', '2º lugar', 'Perto da vencedora', 'Melhor preço sem levar'],
      headerAlign: ['center', 'center', 'center', 'center', 'center'],
      rows: [[a.itens, a.licitacoes, a.segundo, a.perto, a.naoLevou].map((v) => ({ text: String(v), align: 'center', bold: true }))],
    },
    ...(a.valorNaMesa > 0
      ? [
          {
            type: 'rich',
            parts: [
              { text: 'Os itens que a empresa disputou e não levou somaram ' },
              { text: moedaInteira(a.valorNaMesa), bold: true },
              { text: ' nas propostas vencedoras.' },
            ],
            gapAfter: 6,
          },
        ]
      : []),
    { type: 'heading', text: 'Onde a empresa chegou mais perto' },
    {
      type: 'table',
      size: 8.2,
      widths: [2.1, 2.3, 0.9, 1.2, 1.2, 1],
      header: ['Órgão e data', 'Item', 'Colocação', 'Lance da empresa', 'Vencedora', 'Diferença'],
      headerAlign: ['left', 'left', 'center', 'right', 'right', 'right'],
      rows: lista.map((d) => {
        const lic = dados.licitacoes[d.lic];
        const dist = distancia(d);
        return [
          // o nome do órgão quase sempre já traz a cidade; o número do processo fica no link da aba
          `${lic.orgao}${semAcento(lic.orgao).includes(semAcento(lic.municipio)) ? '' : ` (${lic.municipio})`} · ${dataBR(lic.data)}`,
          `${d.lote ? 'Lote' : 'Item'} ${Number(d.item) || d.item}: ${curta(d.desc)}`,
          { text: textoColocacao(d.col).replace(', não levou', ''), align: 'center' },
          { text: lance(d.melhor, d.desconto), align: 'right' },
          { text: lance(d.venc, d.desconto), align: 'right' },
          { text: d.col === 0 ? 'não levou' : dist ? dist.texto : '—', align: 'right' },
        ];
      }),
    },
    ...(resto > 0 ? [{ type: 'para', text: `E mais ${plural(resto, 'item', 'itens')} com diferença maior.`, color: 'muted', size: 9 }] : []),
    { type: 'heading', text: 'O que os números mostram' },
    { type: 'bullets', items: leituras(a) },
    { type: 'heading', text: 'Como a Ágil CM ajuda' },
    {
      type: 'bullets',
      items: [
        'Monitoramento dos editais do seu ramo na região, com aviso diário.',
        'Conferência da habilitação e da proposta antes do envio, para não perder item por documento.',
        'Acompanhamento da sessão e estratégia de lances, item a item.',
        'Pedidos de esclarecimento, impugnações e recursos quando o resultado merece ser contestado.',
        'Certidões, cadastros e atestados sempre em dia.',
      ],
    },
    { type: 'para', text: 'Fale com a gente', bold: true },
    { type: 'para', text: `WhatsApp ${o.contato.whatsapp} · ${o.contato.email} · ${o.contato.site}`, gapAfter: 8 },
    {
      type: 'note',
      text: `Fonte: atas das sessões publicadas no PNCP pelo ${dados.portal || 'Portal de Compras Públicas'}, com todos os lances. Licitações feitas em outros portais não entram, porque eles não publicam a ata com os lances. Os motivos apontados são leituras dos números, para conversarmos; a causa de cada perda está na ata e no julgamento de cada licitação.`,
    },
  ];
}

/** Mensagem curta para o primeiro contato (WhatsApp ou e-mail) */
export function mensagemContato(empresa, dados, o = {}) {
  const a = analisar(empresa, dados.licitacoes);
  const fatos = [];
  if (a.naoLevou) fatos.push(`em ${plural(a.naoLevou, 'item', 'itens')} ofereceu o melhor preço e não levou`);
  if (a.segundo) fatos.push(`ficou em 2º lugar em ${plural(a.segundo, 'item', 'itens')}`);
  if (a.perto) fatos.push(`em ${plural(a.perto, 'item', 'itens')} perdeu por muito pouco`);
  if (!fatos.length) fatos.push(`disputou ${plural(a.itens, 'item', 'itens')} sem vencer`);
  const lista = fatos.length > 1 ? `${fatos.slice(0, -1).join(', ')} e ${fatos.at(-1)}` : fatos[0];
  return (
    `Olá! Sou da Ágil CM, de Astolfo Dutra. Analisamos as licitações públicas ${deOnde(o.abrangencia)} nos últimos 12 meses e vimos que a ${empresa.razao} ${lista}. ` +
    `Preparamos um diagnóstico gratuito mostrando onde dá para virar esse resultado. Posso te enviar?`
  );
}
