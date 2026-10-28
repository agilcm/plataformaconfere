// Remonta as linhas de texto de um PDF a partir dos trechos posicionados que o pdf.js devolve.
// Puro (sem pdf.js), para rodar igual no navegador e nos testes.

/**
 * @typedef {{ str: string, x: number, y: number, w: number, h: number }} Trecho  y cresce para baixo
 * @typedef {{ texto: string, x: number, xf: number, y: number, pagina: number, partes: { t: string, x: number, xf: number }[] }} Linha
 */

/** @param {Trecho[][]} paginas  trechos de cada página @returns {Linha[]} */
export function montarLinhas(paginas) {
  const out = [];
  paginas.forEach((trechos, pagina) => {
    const vis = trechos.filter((t) => t.str && t.str.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
    const grupos = [];
    for (const t of vis) {
      const g = grupos[grupos.length - 1];
      // mesma linha: centros verticais próximos
      if (g && Math.abs(g.y - t.y) <= Math.max(2, Math.min(g.h, t.h) * 0.45)) {
        g.itens.push(t);
        g.h = Math.max(g.h, t.h);
      } else grupos.push({ y: t.y, h: t.h, itens: [t] });
    }
    for (const g of grupos) {
      const itens = g.itens.sort((a, b) => a.x - b.x);
      const partes = [];
      for (const t of itens) {
        const p = partes[partes.length - 1];
        const gap = p ? t.x - p.xf : Infinity;
        // trechos colados viram uma "parte"; espaço grande separa colunas
        if (p && gap < Math.max(4, t.h * 0.9)) {
          p.t += (gap > t.h * 0.15 && !p.t.endsWith(' ') && !t.str.startsWith(' ') ? ' ' : '') + t.str;
          p.xf = Math.max(p.xf, t.x + t.w);
        } else partes.push({ t: t.str, x: t.x, xf: t.x + t.w });
      }
      for (const p of partes) p.t = p.t.replace(/\s+/g, ' ').trim();
      const ps = partes.filter((p) => p.t);
      if (!ps.length) continue;
      out.push({ texto: ps.map((p) => p.t).join('   '), x: ps[0].x, xf: ps[ps.length - 1].xf, y: g.y, pagina, partes: ps });
    }
  });
  return out;
}
