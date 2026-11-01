// Planilha de custos no molde da Ágil (uma aba): colunas A–W da exportação da plataforma + cálculo de custo,
// com as mesmas fórmulas e os parâmetros em Y2–AF2 (despesas 20%, margem 10%, Simples 6%, markup 1).
// Sai como .xlsx; o Drive converte em Planilha Google ao enviar.
import { ESTILOS, esc, letra, zipar } from '../xlsx.js';

export const CABECALHO = [
  'Número do lote',
  'Descrição do Lote',
  'Descrição do item',
  'Quantidade',
  'Unidade de medida',
  'Unitário referência',
  'LANCE INICIAL',
  'Marca',
  'Fabricante',
  'Modelo/versão/código',
  'referencia',
  'LANCE MÁXIMO',
  'QUANT.',
  'VALOR DE COMPRA',
  '20% Despesas adicionais \n(frete, Difal e outras)',
  'Custo compra unitário',
  'Valor de venda para lucrar 10%',
  '06% imposto sobre valor de venda',
  'CUSTO TOTAL UNIDADE',
  'lucro por unidade',
  'Venda Total',
  'custo total',
  'Lucro Item',
];
// Y2:AF2, como na planilha original
const PARAMETROS = ['Despesas adicionais (%)', 20, 'Margem de lucro pretendida (%)', 10, 'Simples Nacional  (%)', 6, 'Markup', 1];
const LARGURAS = [8, 30, 50, 10, 10, 13, 12, 16, 16, 16, 40, 13, 8, 14, 14, 14, 14, 14, 14, 13, 14, 14, 13];

/** Fórmulas da linha r (colunas L–W), iguais às da planilha de custos. */
export const formulas = (r) => ({
  L: `IF(Q${r}>0,Q${r}*1.05,Q${r})`,
  M: `D${r}`,
  O: `N${r}*($Z$2/100)`,
  P: `O${r}+N${r}`,
  Q: `P${r}/0.84`,
  R: `Q${r}*6%`,
  S: `P${r}+R${r}`,
  T: `Q${r}-P${r}-R${r}`,
  U: `M${r}*L${r}`,
  V: `S${r}*M${r}`,
  W: `U${r}-V${r}`,
});

const MOEDA = new Set(['F', 'L', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W']);

/** Nome do arquivo: "Órgão - Processo - Data" (data dd-mm-aaaa). */
export function nomePlanilha({ orgao, processo, data }) {
  const d = String(data || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dataBR = d ? `${d[3]}-${d[2]}-${d[1]}` : String(data || '').replace(/\//g, '-');
  return [orgao, processo, dataBR]
    .map((s) =>
      String(s || '')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '-'),
    )
    .filter(Boolean)
    .join(' - ');
}

/**
 * Monta o .xlsx.
 * @param {{ orgao: string, processo: string, data: string, itens: any[], comContratos?: boolean }} o
 *   itens: { numero, produto, especificacao, descricao, quantidade, unidade, valorTermo,
 *            base?: { marca, referencia, link, compra, arquivo, aba }, contrato?: { valorUnitario, municipio, orgao, data, fornecedor, link } }
 * @returns {Uint8Array}
 */
export function criarPlanilhaCustos({ orgao, processo, data, itens, comContratos = false }) {
  const d = String(data || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dataBR = d ? `${d[3]}/${d[2]}/${d[1]}` : String(data || '');
  const extras = [
    'Origem da cotação (planilha · aba)',
    ...(comContratos ? ['PNCP: menor preço ganho', 'PNCP: onde e quando', 'PNCP: fornecedor', 'PNCP: link'] : []),
  ];
  const colExtra = (i) => letra(33 + i); // AH em diante (AG fica vazia, como a coluna X)

  const linhas = [];
  const cel = (ref, conteudo, estilo) => `<c r="${ref}"${estilo != null ? ` s="${estilo}"` : ''}${conteudo}</c>`;
  const texto = (ref, v, estilo) => (v == null || v === '' ? '' : cel(ref, ` t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is>`, estilo));
  const numero = (ref, v, estilo) => (typeof v === 'number' && Number.isFinite(v) ? cel(ref, `><v>${v}</v>`, estilo) : texto(ref, v, estilo));
  const formula = (ref, f, estilo) => cel(ref, `><f>${esc(f)}</f>`, estilo);

  linhas.push(`<row r="1">${texto('A1', `Processo: ${processo}`)}${texto('B1', `Data da disputa: ${dataBR}`)}${texto('C1', `Órgão: ${orgao}`)}</row>`);
  linhas.push(
    `<row r="2">${CABECALHO.map((h, i) => texto(`${letra(i)}2`, h, 1)).join('')}` +
      PARAMETROS.map((v, i) => numero(`${letra(24 + i)}2`, v, typeof v === 'number' ? 5 : 1)).join('') +
      extras.map((h, i) => texto(`${colExtra(i)}2`, h, 1)).join('') +
      '</row>',
  );
  itens.forEach((it, k) => {
    const r = k + 3;
    const b = it.base || null;
    const n = Number(String(it.numero).replace(',', '.'));
    const refTexto = b ? b.referencia || (b.link ? 'Link do produto' : '') : '';
    const fs = formulas(r);
    const c = [
      numero(`A${r}`, Number.isFinite(n) && String(it.numero).trim() !== '' ? n : it.numero),
      texto(`B${r}`, it.produto),
      texto(`C${r}`, it.especificacao || it.descricao),
      numero(`D${r}`, it.quantidade ?? ''),
      texto(`E${r}`, it.unidade),
      numero(`F${r}`, it.valorTermo ?? '', 2),
      texto(`H${r}`, b?.marca || ''),
      b?.link
        ? formula(`K${r}`, `HYPERLINK("${String(b.link).replace(/"/g, '%22')}","${String(refTexto).replace(/"/g, "'").slice(0, 200)}")`)
        : texto(`K${r}`, refTexto),
      ...['L', 'M'].map((col) => formula(`${col}${r}`, fs[col], col === 'M' ? 5 : 2)),
      numero(`N${r}`, b?.compra ?? '', 2),
      ...['O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W'].map((col) => formula(`${col}${r}`, fs[col], MOEDA.has(col) ? 2 : 5)),
      texto(`${colExtra(0)}${r}`, b ? `${b.arquivo} · ${b.aba}` : ''),
    ];
    if (comContratos) {
      const ct = it.contrato || null;
      const dataC = ct?.data ? ct.data.split('-').reverse().join('/') : '';
      c.push(
        numero(`${colExtra(1)}${r}`, ct?.valorUnitario ?? '', 2),
        texto(`${colExtra(2)}${r}`, ct ? [ct.municipio, ct.orgao, dataC].filter(Boolean).join(' · ') : ''),
        texto(`${colExtra(3)}${r}`, ct?.fornecedor || ''),
        ct?.link ? formula(`${colExtra(4)}${r}`, `HYPERLINK("${ct.link}","Ver no PNCP")`) : '',
      );
    }
    linhas.push(`<row r="${r}">${c.join('')}</row>`);
  });

  const larguras = [
    ...LARGURAS.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`),
    `<col min="25" max="32" width="14" customWidth="1"/>`,
    ...extras.map((_, i) => `<col min="${34 + i}" max="${34 + i}" width="${i === 0 ? 40 : 22}" customWidth="1"/>`),
  ];
  const ns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const aba = 'Cotação';
  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<cols>${larguras.join('')}</cols><sheetData>${linhas.join('')}</sheetData></worksheet>`;
  return zipar([
    {
      nome: '[Content_Types].xml',
      dados:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    },
    {
      nome: '_rels/.rels',
      dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      nome: 'xl/workbook.xml',
      dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${ns}"><sheets><sheet name="${aba}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      nome: 'xl/_rels/workbook.xml.rels',
      dados: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${ns}/styles" Target="styles.xml"/></Relationships>`,
    },
    { nome: 'xl/styles.xml', dados: ESTILOS },
    { nome: 'xl/worksheets/sheet1.xml', dados: sheet },
  ]);
}
