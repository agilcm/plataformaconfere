// OCR das digitalizações e fotos do DocPref (comprovantes de banco escaneados, TRCT, avisos, ASO, folhas de ponto
// impressas): converte as primeiras páginas em imagem (pdftoppm) e lê o texto com o Tesseract em português.
// No GitHub Actions os programas são instalados pelo workflow (tesseract-ocr, tesseract-ocr-por, poppler-utils);
// sem eles a leitura continua, só sem OCR.
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const executar = promisify(execFile);
const ENV = { ...process.env, OMP_THREAD_LIMIT: '1' }; // várias leituras em paralelo: um núcleo para cada
let disponivel = null;

/** O OCR está instalado nesta máquina? */
export async function ocrDisponivel() {
  if (disponivel === null) {
    try {
      await executar('tesseract', ['--version'], { timeout: 20_000 });
      await executar('pdftoppm', ['-v'], { timeout: 20_000 }).catch((e) => {
        // pdftoppm -v escreve a versão no stderr e pode sair com código 99 em versões antigas
        if (!/pdftoppm/i.test(String(e.stderr || ''))) throw e;
      });
      const { stdout } = await executar('tesseract', ['--list-langs'], { timeout: 20_000 });
      disponivel = /\bpor\b/.test(stdout);
    } catch {
      disponivel = false;
    }
  }
  return disponivel;
}

const IMAGENS_OK = /^(png|jpe?g|tiff?|bmp|gif|webp)$/i;

/**
 * Texto de um PDF digitalizado ou de uma foto.
 * @param {Uint8Array} bytes
 * @param {string} ext  extensão do arquivo (pdf, jpg, png...)
 * @param {{ paginas?: number }} [o]  quantas páginas do PDF ler (as primeiras)
 */
export async function lerPorOcr(bytes, ext, { paginas = 2 } = {}) {
  if (!(await ocrDisponivel())) return '';
  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), 'docpref-ocr-'));
  try {
    let imagens = [];
    if (/^pdf$/i.test(ext)) {
      const pdf = path.join(pasta, 'arquivo.pdf');
      await fs.writeFile(pdf, bytes);
      await executar('pdftoppm', ['-r', '200', '-f', '1', '-l', String(paginas), '-png', pdf, path.join(pasta, 'pagina')], { timeout: 120_000 });
      imagens = (await fs.readdir(pasta))
        .filter((n) => n.startsWith('pagina') && n.endsWith('.png'))
        .sort()
        .map((n) => path.join(pasta, n));
    } else if (IMAGENS_OK.test(ext)) {
      const img = path.join(pasta, `imagem.${ext.toLowerCase()}`);
      await fs.writeFile(img, bytes);
      imagens = [img];
    }
    const textos = [];
    for (const img of imagens) {
      const { stdout } = await executar('tesseract', [img, 'stdout', '-l', 'por'], { timeout: 120_000, maxBuffer: 8 * 1024 * 1024, env: ENV });
      textos.push(stdout);
    }
    return textos.join('\n');
  } catch {
    return '';
  } finally {
    await fs.rm(pasta, { recursive: true, force: true });
  }
}
