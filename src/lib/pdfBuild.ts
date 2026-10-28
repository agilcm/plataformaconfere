// Monta o PDF no layout oficial da Ágil CM (carregado só quando alguém gera um relatório,
// porque a biblioteca pdf-lib é pesada).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { COMPANY_PROFILE } from '../data/servicesData.ts';
import type { Align, Block, Cell } from './pdfReport.ts';

export const LOGO_URL = `${import.meta.env.BASE_URL}brand/logo-doc-branco.png`;

const hex = (h: string) => rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
const NAVY = hex('0F2053');
const BLUE = hex('0478CA');
const FOOT = hex('3995D5');
const LIGHT = hex('E8F1FA');
const LINE = hex('B7C3D0');
const TEXT = hex('1F2933');
const MUTED = hex('5B6B7F');
const WHITE = rgb(1, 1, 1);

const W = 595.28;
const H = 841.89;
const M = 56; // margem lateral
const HEADER_H = 70;
const FOOTER_H = 78;
const TOP = H - HEADER_H - 26;
const BOTTOM = FOOTER_H + 24;
const CW = W - M * 2;

// Fontes padrão do PDF usam WinAnsi: remove caracteres fora dessa tabela
const ALLOWED = /[\x20-\x7E -ÿ–—‘’“”•…€]/;
const clean = (s: string) =>
  Array.from(s.replace(/ /g, ' ').replace(/\t/g, ' '))
    .map((c) => (c === '\n' || ALLOWED.test(c) ? c : ''))
    .join('');

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const raw of clean(text).split('\n')) {
    const words = raw.split(/ +/);
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) <= width || !line) {
        line = test;
      } else {
        out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

async function loadBytes(url: string): Promise<Uint8Array> {
  if (url.startsWith('data:')) {
    const b64 = url.slice(url.indexOf(',') + 1);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error('logo');
  return new Uint8Array(await res.arrayBuffer());
}

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  f: PDFFont;
  fb: PDFFont;
  fi: PDFFont;
  logo: PDFImage | null;
  docTitle: string;
}

function drawHeader(c: Ctx) {
  const p = c.page;
  p.drawRectangle({ x: 0, y: H - HEADER_H, width: W, height: HEADER_H, color: NAVY });
  // faixa azul diagonal, como no papel timbrado
  p.drawSvgPath(`M ${W * 0.56} ${HEADER_H} L ${W} ${HEADER_H - 16} L ${W} ${HEADER_H + 4} L ${W * 0.56} ${HEADER_H + 1} Z`, {
    x: 0,
    y: H,
    color: BLUE,
  });
  if (c.logo) {
    const h = 50;
    const w = (c.logo.width / c.logo.height) * h;
    p.drawImage(c.logo, { x: M - 14, y: H - HEADER_H + 10, width: w, height: h });
  }
  const t = 'ÁGIL CM SOLUÇÕES INTEGRADAS';
  const size = 17;
  p.drawText(clean(t), { x: W - M - c.fb.widthOfTextAtSize(t, size) + 14, y: H - 44, size, font: c.fb, color: WHITE });
}

function drawFooter(c: Ctx, pageNo: number, total: number) {
  const p = c.page;
  p.drawRectangle({ x: 0, y: 0, width: W, height: FOOTER_H, color: FOOT });
  const line1 = `CNPJ: ${COMPANY_PROFILE.cnpj}  ·  INSCRIÇÃO ESTADUAL: ${COMPANY_PROFILE.inscricaoEstadual}`;
  p.drawText(clean(line1), { x: M - 14, y: FOOTER_H - 17, size: 7.5, font: c.f, color: WHITE });

  const s = 10.5;
  let x = M - 14;
  const yRow = FOOTER_H - 38;
  const items = [`WhatsApp ${COMPANY_PROFILE.phoneDisplay}`, COMPANY_PROFILE.email, COMPANY_PROFILE.domain];
  items.forEach((it, i) => {
    if (i) {
      p.drawLine({ start: { x: x + 8, y: yRow - 4 }, end: { x: x + 8, y: yRow + 12 }, thickness: 0.8, color: WHITE });
      x += 16;
    }
    p.drawText(clean(it), { x, y: yRow, size: s, font: i === 0 ? c.fb : c.f, color: WHITE });
    x += c.f.widthOfTextAtSize(clean(it), s) + (i === 0 ? 6 : 0);
  });
  p.drawText(clean(`${COMPANY_PROFILE.city} · Atendimento de segunda a sexta, das 8h às 18h`), {
    x: M - 14,
    y: FOOTER_H - 56,
    size: 7.5,
    font: c.f,
    color: WHITE,
  });
  p.drawText(clean(`${c.docTitle} · Página ${pageNo} de ${total}`), { x: M - 14, y: 10, size: 6.5, font: c.f, color: WHITE });

  if (c.logo) {
    const h = 54;
    const w = (c.logo.width / c.logo.height) * h;
    p.drawImage(c.logo, { x: W - M - w + 18, y: 12, width: w, height: h });
  }
}

function newPage(c: Ctx) {
  c.page = c.doc.addPage([W, H]);
  drawHeader(c);
  c.y = TOP;
}

function ensure(c: Ctx, h: number) {
  if (c.y - h < BOTTOM) newPage(c);
}

function text(c: Ctx, s: string, x: number, y: number, size: number, font: PDFFont, color = TEXT) {
  c.page.drawText(s, { x, y, size, font, color });
}

function drawParagraph(c: Ctx, s: string, o: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; indent?: number; align?: Align; gapAfter?: number }) {
  const size = o.size ?? 10.5;
  const font = o.font ?? c.f;
  const lh = size * 1.5;
  const indent = o.indent ?? 0;
  const lines = wrap(s, font, size, CW - indent);
  lines.forEach((ln, i) => {
    ensure(c, lh);
    const w = font.widthOfTextAtSize(ln, size);
    const x = o.align === 'right' ? M + CW - w : o.align === 'center' ? M + (CW - w) / 2 : M + (i === 0 ? indent : 0);
    text(c, ln, x, c.y - size, size, font, o.color ?? TEXT);
    c.y -= lh;
  });
  c.y -= o.gapAfter ?? 6;
}

function drawTable(c: Ctx, b: Extract<Block, { type: 'table' }>) {
  const size = 8.8;
  const pad = 5;
  const lh = size * 1.35;
  const totalW = b.widths.reduce((a, x) => a + x, 0);
  const cols = b.widths.map((w) => (w / totalW) * CW);
  const norm = (x: string | Cell): Cell => (typeof x === 'string' ? { text: x } : x);

  const rowHeight = (cells: Cell[], bold: boolean) =>
    Math.max(...cells.map((cell, i) => wrap(cell.text, bold || cell.bold ? c.fb : c.f, size, cols[i] - pad * 2).length)) * lh + pad * 2 - 2;

  const drawRow = (cells: Cell[], kind: 'head' | 'body' | 'total') => {
    const bold = kind !== 'body';
    const h = rowHeight(cells, bold);
    let x = M;
    const yTop = c.y;
    if (kind === 'head') c.page.drawRectangle({ x: M, y: yTop - h, width: CW, height: h, color: NAVY });
    if (kind === 'total') c.page.drawRectangle({ x: M, y: yTop - h, width: CW, height: h, color: LIGHT });
    cells.forEach((cell, i) => {
      const font = bold || cell.bold ? c.fb : c.f;
      const color = kind === 'head' ? WHITE : kind === 'total' ? NAVY : TEXT;
      const lines = wrap(cell.text, font, size, cols[i] - pad * 2);
      lines.forEach((ln, li) => {
        const w = font.widthOfTextAtSize(ln, size);
        const tx = cell.align === 'right' ? x + cols[i] - pad - w : cell.align === 'center' ? x + (cols[i] - w) / 2 : x + pad;
        text(c, ln, tx, yTop - pad - size + 1 - li * lh, size, font, color);
      });
      x += cols[i];
    });
    // grade
    c.page.drawRectangle({ x: M, y: yTop - h, width: CW, height: h, borderColor: LINE, borderWidth: 0.6 });
    let gx = M;
    cols.slice(0, -1).forEach((w) => {
      gx += w;
      c.page.drawLine({ start: { x: gx, y: yTop }, end: { x: gx, y: yTop - h }, thickness: 0.6, color: LINE });
    });
    c.y -= h;
  };

  const header = b.header?.map((t, i) => ({ text: t, align: (b.headerAlign?.[i] ?? (i === b.header!.length - 1 && b.header!.length > 1 ? 'right' : 'left')) as Align }));
  const first = b.rows[0] ? b.rows[0].map(norm) : [];
  ensure(c, (header ? rowHeight(header, true) : 0) + (first.length ? rowHeight(first, false) : 0));
  if (header) drawRow(header, 'head');
  b.rows.forEach((r, ri) => {
    const cells = r.map(norm);
    const kind = ri >= b.rows.length - (b.totalRows ?? 0) ? 'total' : 'body';
    const h = rowHeight(cells, kind !== 'body');
    if (c.y - h < BOTTOM) {
      newPage(c);
      if (header) drawRow(header, 'head');
    }
    drawRow(cells, kind);
  });
  c.y -= 14;
}

export async function buildPdf(docTitle: string, blocks: Block[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${docTitle} - Ágil CM Soluções Integradas`);
  doc.setAuthor('Ágil CM Soluções Integradas');
  doc.setCreator(COMPANY_PROFILE.domain);
  const [f, fb, fi] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
    doc.embedFont(StandardFonts.HelveticaOblique),
  ]);
  let logo: PDFImage | null = null;
  try {
    logo = await doc.embedPng(await loadBytes(LOGO_URL));
  } catch {
    logo = null; // sem logo o documento ainda é gerado
  }
  const c: Ctx = { doc, page: null as unknown as PDFPage, y: TOP, f, fb, fi, logo, docTitle };
  newPage(c);

  for (const b of blocks) {
    switch (b.type) {
      case 'date':
        drawParagraph(c, b.text, { align: 'right', size: 10, color: MUTED, gapAfter: 10 });
        break;
      case 'title':
        c.y -= 4;
        drawParagraph(c, b.text, { size: 18, font: fb, align: 'center', gapAfter: 14 });
        break;
      case 'heading': {
        ensure(c, 120);
        c.y -= 6;
        c.page.drawRectangle({ x: M, y: c.y - 13, width: 3, height: 13, color: BLUE });
        text(c, clean(b.text), M + 9, c.y - 11, 12, fb, NAVY);
        c.y -= 22;
        break;
      }
      case 'para':
        drawParagraph(c, b.text, {
          font: b.bold ? fb : f,
          size: b.size,
          indent: b.indent ? 28 : 0,
          color: b.color === 'muted' ? MUTED : TEXT,
          gapAfter: b.gapAfter,
        });
        break;
      case 'rich': {
        // linha curta com trechos em negrito (ex.: "Empresa: X")
        const size = 10.5;
        ensure(c, size * 1.5);
        let x = M;
        for (const part of b.parts) {
          const font = part.bold ? fb : f;
          const t = clean(part.text);
          text(c, t, x, c.y - size, size, font);
          x += font.widthOfTextAtSize(t, size);
        }
        c.y -= size * 1.5 + (b.gapAfter ?? 2);
        break;
      }
      case 'bullets':
        for (const it of b.items) {
          const size = 10;
          const lines = wrap(it, f, size, CW - 14);
          lines.forEach((ln, i) => {
            ensure(c, size * 1.5);
            if (i === 0) text(c, '•', M + 2, c.y - size, size, fb, BLUE);
            text(c, ln, M + 14, c.y - size, size, f);
            c.y -= size * 1.5;
          });
          c.y -= 2;
        }
        c.y -= 6;
        break;
      case 'note':
        drawParagraph(c, b.text, { size: 8, font: fi, color: MUTED, gapAfter: 10 });
        break;
      case 'table':
        drawTable(c, b);
        break;
      case 'space':
        c.y -= b.h;
        break;
      case 'signature':
        ensure(c, 110);
        drawParagraph(c, 'Desde já agradecemos a oportunidade e nos colocamos à disposição para quaisquer esclarecimentos.', { indent: 28, gapAfter: 8 });
        drawParagraph(c, 'Atenciosamente,', { indent: 28, gapAfter: 26 });
        c.page.drawLine({ start: { x: M + 28, y: c.y + 4 }, end: { x: M + 248, y: c.y + 4 }, thickness: 0.6, color: LINE });
        drawParagraph(c, b.name, { indent: 28, font: fb, gapAfter: 0 });
        drawParagraph(c, b.role, { indent: 28, gapAfter: 0 });
        drawParagraph(c, `Ágil CM Soluções Integradas · CNPJ ${COMPANY_PROFILE.cnpj}`, { indent: 28, size: 9, color: MUTED });
        break;
    }
  }

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    c.page = p;
    drawFooter(c, i + 1, pages.length);
  });
  return doc.save();
}
