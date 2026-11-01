// Leitura de planilhas enviadas pelo usuário: .xlsx (Excel) e .csv, sem bibliotecas externas.
// Devolve uma matriz de linhas (array de arrays). Números do Excel vêm como number; o resto como texto.

const dec = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&');

/** Arquivos de um .zip: { nome: Uint8Array } (só os pedidos em `quero`, para não descompactar tudo). */
async function lerZip(buf, quero) {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Arquivo não é um Excel (.xlsx) válido');
  const total = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const td = new TextDecoder();
  const out = {};
  for (let k = 0; k < total; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const metodo = dv.getUint16(p + 10, true);
    const tam = dv.getUint32(p + 20, true);
    const nLen = dv.getUint16(p + 28, true);
    const eLen = dv.getUint16(p + 30, true);
    const cLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const nome = td.decode(u8.subarray(p + 46, p + 46 + nLen));
    p += 46 + nLen + eLen + cLen;
    if (!quero(nome)) continue;
    const ini = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const dados = u8.subarray(ini, ini + tam);
    if (metodo === 0) out[nome] = dados;
    else if (metodo === 8) {
      const ds = new DecompressionStream('deflate-raw');
      const stream = new Blob([dados]).stream().pipeThrough(ds);
      out[nome] = new Uint8Array(await new Response(stream).arrayBuffer());
    }
  }
  return out;
}

const colNum = (ref) => {
  const letras = String(ref).match(/^[A-Z]+/)?.[0] || 'A';
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

const textos = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => dec(m[1])).join('');

const caminhoAlvo = (alvo, base = 'xl/') => (alvo.startsWith('/') ? alvo.slice(1) : `${base}${alvo.replace(/^\.\//, '')}`);
const relacoes = (xml) => {
  const m = new Map();
  for (const r of xml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = r[0].match(/\bId="([^"]+)"/)?.[1];
    const alvo = r[0].match(/\bTarget="([^"]+)"/)?.[1];
    if (id && alvo) m.set(id, dec(alvo));
  }
  return m;
};

/** Uma aba: linhas na posição real da planilha (linha 1 = índice 0) e os links das células ("K3" → url). */
function lerAba(xml, relsXml, compart) {
  const linhas = [];
  const links = {};
  for (const m of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const r = Number(m[1].match(/\br="(\d+)"/)?.[1]) || linhas.length + 1;
    const linha = [];
    for (const c of m[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const corpo = c[2] || '';
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const tipo = attrs.match(/\bt="([^"]+)"/)?.[1];
      const v = corpo.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let valor = '';
      if (tipo === 's') valor = compart[Number(v)] ?? '';
      else if (tipo === 'inlineStr') valor = textos(corpo);
      else if (tipo === 'str' || tipo === 'e') valor = dec(v ?? '');
      else if (tipo === 'b') valor = v === '1' ? 'VERDADEIRO' : 'FALSO';
      else if (v != null && v !== '') valor = Number(v);
      const col = ref ? colNum(ref) : linha.length;
      linha[col] = valor;
      // =HYPERLINK("url"; "texto")
      const f = corpo.match(/<f>([\s\S]*?)<\/f>/)?.[1];
      const url = f && dec(f).match(/HYPERLINK\(\s*"([^"]+)"/i)?.[1];
      if (url) links[ref || `${String.fromCharCode(65 + col)}${r}`] = url;
    }
    linhas[r - 1] = Array.from(linha, (x) => (x === undefined ? '' : x));
  }
  const rels = relacoes(relsXml);
  for (const h of xml.matchAll(/<hyperlink\b([^>]*)\/?>/g)) {
    const ref = h[1].match(/\bref="([A-Z]+\d+)/)?.[1];
    const id = h[1].match(/\br:id="([^"]+)"/)?.[1];
    if (ref && id && rels.get(id)) links[ref] = rels.get(id);
  }
  return { linhas: Array.from(linhas, (l) => l || []), links };
}

/**
 * Todas as abas de um .xlsx, na ordem do arquivo.
 * @returns {Promise<{ nome: string, linhas: any[][], links: Record<string, string> }[]>}
 */
export async function lerXlsxAbas(buf) {
  const td = new TextDecoder();
  const arq = await lerZip(buf, (n) =>
    /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml|worksheets\/_rels\/[^/]+\.rels)$/.test(n),
  );
  const txt = (n) => (arq[n] ? td.decode(arq[n]) : '');
  const compart = [...txt('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textos(m[1]));
  const rels = relacoes(txt('xl/_rels/workbook.xml.rels'));
  const abas = [];
  for (const s of txt('xl/workbook.xml').matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const nome = dec(s[1].match(/\bname="([^"]*)"/)?.[1] || `Aba ${abas.length + 1}`);
    const alvo = rels.get(s[1].match(/\br:id="([^"]+)"/)?.[1] || '');
    const caminho = alvo ? caminhoAlvo(alvo) : '';
    if (!arq[caminho]) continue;
    const relsAba = caminho.replace(/worksheets\/([^/]+)$/, 'worksheets/_rels/$1.rels');
    abas.push({ nome, ...lerAba(txt(caminho), txt(relsAba), compart) });
  }
  if (!abas.length) {
    const caminho = Object.keys(arq)
      .filter((n) => /^xl\/worksheets\/[^/]+\.xml$/.test(n))
      .sort()[0];
    if (caminho) abas.push({ nome: 'Planilha', ...lerAba(txt(caminho), '', compart) });
  }
  return abas;
}

/** Primeira aba de um .xlsx como matriz. */
export async function lerXlsx(buf) {
  const abas = await lerXlsxAbas(buf);
  if (!abas.length) throw new Error('A planilha está vazia');
  return abas[0].linhas;
}

/** CSV (vírgula, ponto e vírgula ou tab; UTF-8 ou Windows-1252, como o Excel brasileiro salva). */
export function lerCsv(buf) {
  let s;
  try {
    s = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    s = new TextDecoder('windows-1252').decode(buf);
  }
  s = s.replace(/^﻿/, '');
  const primeira = s.split(/\r?\n/).find((l) => l.trim()) || '';
  const sep = [';', '\t', ','].map((c) => [c, primeira.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const linhas = [];
  let linha = [];
  let campo = '';
  let aspas = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (aspas) {
      if (ch === '"' && s[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) {
      linha.push(campo);
      campo = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else campo += ch;
  }
  if (campo || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((c) => String(c).trim()));
}

/** Lê .xlsx ou .csv pelo nome do arquivo. */
export async function lerPlanilha(buf, nome) {
  if (/\.xls$/i.test(nome)) throw new Error('Arquivo .xls antigo: abra no Excel e salve como .xlsx ou .csv');
  if (/\.(csv|txt)$/i.test(nome)) return lerCsv(buf);
  return lerXlsx(buf);
}
