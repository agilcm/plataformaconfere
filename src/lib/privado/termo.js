// Leitura dos documentos de licitação (AMM Licita / Licitar Digital e similares):
// identifica termos de homologação e de adjudicação e extrai processo, datas e os itens ganhos pela AGIL.
// Recebe as linhas montadas por linhas.js; não depende do pdf.js.

export const AGIL_CNPJ_RAIZ = '51.328.978';

const sem = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const DINHEIRO = /^\d{1,3}(?:\.\d{3})*,\d{2,4}$/;
const NUMERO = /^\d{1,3}(?:\.\d{3})*(?:,\d+)?$/;
const CNPJ = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;

/** "1.234,56" -> 1234.56 */
export const numBR = (s) => {
  const v = Number(String(s || '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

const ehRodape = (l) => /::/.test(l.texto) && /p[aá]gina\s+\d+\s+de\s+\d+/i.test(l.texto);

/** Cabeçalhos repetidos no topo das páginas (ex.: brasão da câmara) atrapalham a leitura das tabelas. */
function limpar(linhas) {
  const porPagina = new Map();
  for (const l of linhas) {
    if (!porPagina.has(l.pagina)) porPagina.set(l.pagina, []);
    porPagina.get(l.pagina).push(l);
  }
  // linhas do topo que se repetem nas páginas (nunca linhas de tabela, que também se repetem)
  const candidata = (l) => !/^(lote|marca|modelo|fabricante|descri[cç][aã]o|fornecedor)\b/i.test(l.texto);
  const topo = new Map();
  for (const ls of porPagina.values()) for (const l of ls.slice(0, 4).filter(candidata)) topo.set(l.texto, (topo.get(l.texto) || 0) + 1);
  const primeira = new Set((porPagina.get(0) || []).slice(0, 4).map((l) => l.texto));
  const repetidos = new Set([...topo].filter(([t, n]) => n >= 2 && (primeira.has(t) || n >= 3)).map(([t]) => t));
  return linhas.filter((l) => !ehRodape(l) && !(candidata(l) && repetidos.has(l.texto)));
}

/** Tipo do documento pelo título da primeira página. */
export function classificar(linhas) {
  // o título precisa abrir uma das primeiras linhas (um edital que só cita "o termo de homologação" não conta)
  const titulos = linhas
    .filter((l) => l.pagina === 0)
    .slice(0, 10)
    .map((l) => sem(l.texto).trim());
  const corpo = sem(linhas.slice(0, 40).map((l) => l.texto).join(' '));
  const titulo = (t) => titulos.some((l) => l.startsWith(t));
  if (titulo('termo de homologacao') && /resolve\s*homologar|\bhomologo\b/.test(corpo)) return 'homologacao';
  if (titulo('termo de adjudicacao') && /resolve\s*adjudicar|\badjudico\b/.test(corpo)) return 'adjudicacao';
  if (titulos.some((l) => /^ata (da sessao (publica )?)?(de |do )?pregao/.test(l))) return 'ata';
  return 'outro';
}

const tituloCaso = (s) => {
  const letras = s.replace(/[^A-Za-zÀ-ú]/g, '');
  if (letras && letras !== letras.toUpperCase()) return s.trim();
  return s
    .toLowerCase()
    .replace(/(^|[\s(/-])([a-zà-ú])/g, (m, a, b) => a + b.toUpperCase())
    .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase())
    .replace(/\b(Saae|Saaed|Mg)\b/g, (m) => m.toUpperCase())
    .trim();
};

/** Nome do órgão: rodapé do sistema ("AMM Licita :: Prefeitura ... - Unidade Única") ou cabeçalho. */
export function orgaoDe(linhas) {
  for (const l of linhas) {
    const m = l.partes[0]?.t.match(/^(.{2,40}?)\s*::\s*(.+?)\s*(?:-\s*Unidade.*)?$/);
    if (m && ehRodape(l)) return { nome: tituloCaso(m[2]), sistema: m[1].trim() };
  }
  for (const l of linhas.filter((x) => x.pagina === 0).slice(0, 8)) {
    if (/^(prefeitura|c[aâ]mara|saae|servi[cç]o aut|autarquia|cons[oó]rcio|fundo municipal|instituto)/i.test(l.texto)) {
      return { nome: tituloCaso(l.partes[0].t), sistema: '' };
    }
  }
  return null;
}

function cabecalhoDoProcesso(linhas) {
  const ini = linhas.findIndex((l) => /no uso de suas atribui/i.test(l.texto));
  const fimObj = linhas.findIndex((l, i) => i > ini && /^(resumo|detalhes)$/i.test(l.texto.trim()));
  const bloco = linhas
    .slice(Math.max(0, ini), fimObj > 0 ? fimObj : ini + 25)
    .map((l) => l.texto)
    .join(' ')
    .replace(/\s+/g, ' ');
  const proc = bloco.match(/Processo\s+(?:Administrativo|Licitat[óo]rio)?\s*n[º°o.]*\s*(\d+)\s*\/\s*(\d{4})/i);
  const ed = bloco.match(/Edital\s+d[eo]\s+(.+?)\s+n[º°o.]*\s*(\d+)\s*\/\s*(\d{4})/i);
  const obj = bloco.match(/Objeto:\s*(.+)$/i);
  const modalidadeCompleta = ed ? ed[1].trim() : '';
  const m = sem(modalidadeCompleta);
  const modalidade = /preg/.test(m)
    ? 'Pregão'
    : /dispensa/.test(m)
      ? 'Dispensa'
      : /inexig/.test(m)
        ? 'Inexigibilidade'
        : /concorr/.test(m)
          ? 'Concorrência'
          : /credenc/.test(m)
            ? 'Credenciamento'
            : modalidadeCompleta;
  return {
    processo: proc ? { numero: proc[1], ano: proc[2] } : null,
    edital: ed ? { numero: ed[2], ano: ed[3] } : null,
    modalidade,
    modalidadeCompleta,
    objeto: obj ? obj[1].trim() : '',
  };
}

/** "Ubá, 06 de Março de 2025." -> 2025-03-06 (a última ocorrência, perto da assinatura) */
function dataPorExtenso(linhas) {
  let achada = null;
  for (const l of linhas) {
    const m = l.texto.match(/,\s*(\d{1,2})\s+de\s+([A-Za-zçÇ]+)\s+de\s+(\d{4})\.?\s*$/);
    if (!m) continue;
    const mes = MESES.indexOf(sem(m[2]));
    if (mes >= 0) achada = `${m[3]}-${String(mes + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return achada;
}

const isoDeBR = (d, h = '') => {
  const m = d.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}${h ? `T${h}` : ''}`;
};

/** Valores da AGIL no quadro "Resumo" (estimado, homologado/adjudicado, diferença). */
function resumoAgil(linhas, cnpjRaiz) {
  const ini = linhas.findIndex((l) => /^resumo$/i.test(l.texto.trim()));
  if (ini < 0) return null;
  let fim = linhas.findIndex((l, i) => i > ini && /^detalhes$/i.test(l.texto.trim()));
  if (fim < 0) fim = Math.min(linhas.length, ini + 200);
  const reg = linhas.slice(ini + 1, fim);
  const iAgil = reg.findIndex((l) => l.texto.includes(cnpjRaiz));
  if (iAgil < 0) return null;
  // blocos de fornecedor terminam na linha do e-mail
  let a = iAgil;
  while (a > 0 && !/@/.test(reg[a - 1].texto) && !/^fornecedor/i.test(reg[a - 1].texto)) a--;
  let b = iAgil;
  while (b < reg.length - 1 && !/@/.test(reg[b].texto) && !/^totais/i.test(reg[b + 1].texto)) b++;
  let bloco = reg.slice(a, b + 1);
  let nums = bloco.flatMap((l) => l.partes.filter((p) => DINHEIRO.test(p.t)));
  if (nums.length > 3) {
    const y = reg[iAgil].y;
    bloco = bloco.filter((l) => Math.abs(l.y - y) <= 14);
    nums = bloco.flatMap((l) => l.partes.filter((p) => DINHEIRO.test(p.t)));
  }
  if (nums.length < 2) return null;
  nums.sort((p, q) => p.x - q.x);
  return { estimado: numBR(nums[0].t), valor: numBR(nums[1].t), diferenca: nums[2] ? numBR(nums[2].t) : null };
}

const ehCabecalhoItens = (l) => /descri[cç][aã]o\s+item/i.test(l.partes[0]?.t || '') && /sub\s*total/i.test(l.texto);
const ehLote = (l) => /^lote\s+\S+/i.test(l.partes[0]?.t || '') && /data\/hora d[ae]/i.test(l.texto);
const ehFornecedor = (l) => /^fornecedor:/i.test(l.texto);

/** Separa, numa linha da tabela, a descrição (à esquerda) das colunas numéricas. */
function colunas(l, xQtd) {
  const desc = l.partes.filter((p) => p.xf < xQtd - 8);
  const resto = l.partes.filter((p) => p.xf >= xQtd - 8);
  if (resto.length < 3) return null;
  const nums = resto.filter((p) => NUMERO.test(p.t));
  if (nums.length < 3) return null;
  const [q, ...depois] = resto;
  if (!NUMERO.test(q.t)) return null;
  const sub = resto[resto.length - 1];
  const unit = resto[resto.length - 2];
  if (!DINHEIRO.test(sub.t) || !NUMERO.test(unit.t)) return null;
  const medida = depois.slice(0, -2).map((p) => p.t).join(' ');
  return { desc: desc.map((p) => p.t).join(' '), quantidade: numBR(q.t), medida, unitario: numBR(unit.t), subtotal: numBR(sub.t) };
}

/** Itens adjudicados/homologados em favor da AGIL (seção "Detalhes"). */
function itensAgil(linhas, cnpjRaiz) {
  const itens = [];
  let i = 0;
  while (i < linhas.length) {
    if (!(ehFornecedor(linhas[i]) && linhas[i].texto.includes(cnpjRaiz))) {
      i++;
      continue;
    }
    i++;
    let lote = null;
    let dataLote = null;
    while (i < linhas.length && !ehFornecedor(linhas[i]) && !/,\s*\d{1,2}\s+de\s+[A-Za-zç]+\s+de\s+\d{4}/.test(linhas[i].texto)) {
      const l = linhas[i];
      if (ehLote(l)) {
        lote = l.partes[0].t.replace(/^lote\s+/i, '').trim();
        const d = l.texto.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)/);
        dataLote = d ? isoDeBR(d[1], d[2]) : null;
        i++;
        continue;
      }
      if (!ehCabecalhoItens(l)) {
        i++;
        continue;
      }
      // tabela: até a linha de marca/modelo, o próximo lote ou fornecedor
      const xQtd = (l.partes.find((p) => /quantidade/i.test(p.t)) || l.partes[1] || { x: 300 }).x;
      i++;
      const regiao = [];
      while (
        i < linhas.length &&
        !ehLote(linhas[i]) &&
        !ehFornecedor(linhas[i]) &&
        !ehCabecalhoItens(linhas[i]) &&
        !/^(marca|modelo|fabricante):/i.test(linhas[i].partes[0]?.t || '') &&
        !/,\s*\d{1,2}\s+de\s+[A-Za-zç]+\s+de\s+\d{4}/.test(linhas[i].texto)
      ) {
        regiao.push(linhas[i]);
        i++;
      }
      const linhasNum = [];
      const descs = [];
      for (const r of regiao) {
        const c = colunas(r, xQtd);
        if (c) {
          linhasNum.push({ ...c, y: r.y, pagina: r.pagina, partes: c.desc ? [c.desc] : [] });
        } else descs.push(r);
      }
      for (const d of descs) {
        // a descrição fica centralizada na altura da linha de números do item
        let alvo = null;
        const mesmas = linhasNum.filter((n) => n.pagina === d.pagina);
        if (mesmas.length) alvo = mesmas.reduce((a, b) => (Math.abs(b.y - d.y) < Math.abs(a.y - d.y) ? b : a));
        else alvo = linhasNum.filter((n) => n.pagina < d.pagina).pop() || linhasNum[0];
        if (alvo) (alvo.extras ||= []).push(d);
      }
      for (const n of linhasNum) {
        const ps = [...(n.extras || []).map((d) => ({ y: d.y + d.pagina * 10000, t: d.texto })), ...(n.desc ? [{ y: n.y + n.pagina * 10000, t: n.desc }] : [])];
        ps.sort((a, b) => a.y - b.y);
        const descricao = ps.map((p) => p.t).join(' ').replace(/\s+/g, ' ').trim();
        const conta = n.quantidade != null && n.unitario != null ? Math.round(n.quantidade * n.unitario * 100) / 100 : null;
        itens.push({
          lote,
          data: dataLote,
          descricao,
          quantidade: n.quantidade,
          medida: n.medida,
          unitario: n.unitario,
          subtotal: n.subtotal,
          marca: '',
          fabricante: '',
          modelo: '',
          conferir: conta != null && n.subtotal != null && Math.abs(conta - n.subtotal) > Math.max(0.05, n.subtotal * 0.001),
        });
      }
      // marca / fabricante / modelo (o modelo pode quebrar em linhas acima e abaixo)
      const ini = i;
      let xModelo = null;
      const blocoMarca = [];
      while (i < linhas.length && i - ini < 8 && !ehLote(linhas[i]) && !ehFornecedor(linhas[i]) && !ehCabecalhoItens(linhas[i])) {
        if (/,\s*\d{1,2}\s+de\s+[A-Za-zç]+\s+de\s+\d{4}/.test(linhas[i].texto)) break;
        blocoMarca.push(linhas[i]);
        i++;
      }
      // "Modelo:" às vezes aparece numa linha logo antes de "Marca:" (já consumida na região da tabela)
      const anteriores = regiao.filter((r) => r.partes.some((p) => /^modelo:/i.test(p.t)));
      const todas = [...anteriores, ...blocoMarca];
      for (const r of todas) for (const p of r.partes) if (/^modelo:/i.test(p.t)) xModelo = p.x;
      const pegar = (rot) => {
        for (const r of todas) for (const p of r.partes) if (new RegExp(`^${rot}:`, 'i').test(p.t)) return p.t.replace(new RegExp(`^${rot}:\\s*`, 'i'), '').trim();
        return '';
      };
      const ultimo = itens[itens.length - 1];
      if (ultimo && todas.length) {
        ultimo.marca = pegar('marca');
        ultimo.fabricante = pegar('fabricante');
        if (xModelo != null) {
          ultimo.modelo = todas
            .flatMap((r) => r.partes.filter((p) => p.x >= xModelo - 6))
            .map((p) => p.t.replace(/^modelo:\s*/i, ''))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
      }
    }
  }
  return itens;
}

/**
 * Lê um termo de homologação ou adjudicação.
 * @param {import('./linhas.js').Linha[]} linhasBrutas
 */
export function lerTermo(linhasBrutas, { cnpjRaiz = AGIL_CNPJ_RAIZ } = {}) {
  const tipo = classificar(linhasBrutas);
  const orgao = orgaoDe(linhasBrutas);
  const cnpjOrgao = linhasBrutas
    .filter((l) => l.pagina === 0)
    .slice(0, 6)
    .map((l) => l.texto.match(CNPJ)?.[0])
    .find(Boolean) || '';
  const linhas = limpar(linhasBrutas);
  const cab = cabecalhoDoProcesso(linhas);
  const datas = linhas.map((l) => l.texto.match(/Data\/Hora d[ae] (?:Homologa|Adjudica)[^-]*-\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)/i)).filter(Boolean);
  const dataDocumento = dataPorExtenso(linhas);
  const itens = itensAgil(linhas, cnpjRaiz);
  const resumo = resumoAgil(linhas, cnpjRaiz);
  const somaItens = Math.round(itens.reduce((s, it) => s + (it.subtotal || 0), 0) * 100) / 100;
  const autoridade = linhas.map((l) => l.texto.match(/^(.+?)\s+na condi[cç][aã]o de Autoridade/i)?.[1]).find(Boolean) || '';
  const agilParticipou = linhas.some((l) => l.texto.includes(cnpjRaiz));
  return {
    tipo,
    orgao: orgao?.nome || '',
    sistema: orgao?.sistema || '',
    cnpjOrgao,
    ...cab,
    dataDocumento,
    // data do lote da AGIL; sem itens, a primeira do termo ou a da assinatura
    dataTermo: itens.find((it) => it.data)?.data || (datas[0] ? isoDeBR(datas[0][1], datas[0][2]) : dataDocumento),
    autoridade,
    agilParticipou,
    agilVenceu: itens.length > 0 || !!resumo,
    valorAgil: resumo?.valor ?? (itens.length ? somaItens : null),
    estimadoAgil: resumo?.estimado ?? null,
    somaItens,
    conferido: resumo ? Math.abs(resumo.valor - somaItens) < 0.05 : null,
    itens,
  };
}

/** Ata da sessão do pregão: número do processo e data/hora da sessão ("Às 09:00 do dia 29/07/2024"). */
export function lerAta(linhas) {
  const texto = linhas.slice(0, 40).map((l) => l.texto).join(' ');
  const proc = texto.match(/PROCESSO\s+(?:LICITAT[ÓO]RIO|ADMINISTRATIVO)?\s*N[º°O.]*\s*(\d+)\s*\/\s*(\d{4})/i);
  const sessao = texto.match(/[ÀA]s\s+(\d{1,2}:\d{2})\s+do dia\s+(\d{2}\/\d{2}\/\d{4})/i);
  return {
    processo: proc ? { numero: proc[1], ano: proc[2] } : null,
    dataPregao: sessao ? isoDeBR(sessao[2], sessao[1].padStart(5, '0')) : null,
  };
}
