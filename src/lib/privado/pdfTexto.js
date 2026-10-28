// Extrai as linhas de um PDF com o pdf.js (navegador ou Node, conforme o módulo pdf.js recebido).
import { montarLinhas } from './linhas.js';

/**
 * @param {any} pdfjs  módulo do pdf.js já configurado
 * @param {Uint8Array} bytes
 * @param {{ maxPaginas?: number }} opts
 */
export async function linhasDoPdf(pdfjs, bytes, { maxPaginas = Infinity } = {}) {
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: false }).promise;
  try {
    const total = Math.min(doc.numPages, maxPaginas);
    const paginas = [];
    for (let n = 1; n <= total; n++) {
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      paginas.push(
        tc.items
          .filter((it) => 'str' in it)
          .map((it) => {
            const h = Math.abs(it.transform[3]) || it.height || 8;
            // pdf.js usa origem embaixo; convertendo para y crescente para baixo (centro do texto)
            return { str: it.str, x: it.transform[4], y: vp.height - it.transform[5] - h / 2, w: it.width, h };
          }),
      );
      page.cleanup();
    }
    return { linhas: montarLinhas(paginas), paginas: doc.numPages };
  } finally {
    await doc.destroy();
  }
}
