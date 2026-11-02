// Área Privado sem login do Google: o GitHub Actions lê a pasta "Licitacoes - Agil" pelo link público,
// lê os PDFs (termos de homologação/adjudicação e atas) com o mesmo leitor do site e grava o resultado em
// public/privado/leitura.json, publicado junto com o site (o arquivo não vai para o Git).
//
// Os PDFs já lidos ficam em privado-cache.json (cache do Actions): só os novos são baixados e lidos.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PASTA_LICITACOES_ID } from '../src/data/privadoConfig.ts';
import { linhasDoPdf } from '../src/lib/privado/pdfTexto.js';
import { planejar } from '../src/lib/privado/plano.js';
import { classificar, lerAta, lerTermo } from '../src/lib/privado/termo.js';
import { arvore, baixarPublico } from './drive-publico.mjs';

const VERSAO_LEITOR = 1; // a mesma de src/lib/privado/organizar.ts
const AGIL_CNPJ_RAIZ = '51.328.978';
const PASTA = 'application/vnd.google-apps.folder';
const SAIDA = process.env.PRIVADO_SAIDA || 'public/privado/leitura.json';
const CACHE = process.env.PRIVADO_CACHE || 'privado-cache.json';

let pdfjsCarregado = null;
async function pdfjs() {
  pdfjsCarregado ??= import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsCarregado;
}

/** Mesma análise do navegador (organizar.ts): tipo do documento e dados do termo ou da ata */
export async function analisarPdf(bytes) {
  const lib = await pdfjs();
  const inicio = await linhasDoPdf(lib, bytes.slice(), { maxPaginas: 2 });
  if (!inicio.linhas.length) return { v: VERSAO_LEITOR, tipo: 'ilegivel' };
  const tipo = classificar(inicio.linhas);
  if (tipo === 'homologacao' || tipo === 'adjudicacao') {
    const tudo = inicio.paginas > 2 ? await linhasDoPdf(lib, bytes.slice()) : inicio;
    return { v: VERSAO_LEITOR, tipo, termo: lerTermo(tudo.linhas, { cnpjRaiz: AGIL_CNPJ_RAIZ }) };
  }
  if (tipo === 'ata') return { v: VERSAO_LEITOR, tipo, ata: lerAta(inicio.linhas) };
  return { v: VERSAO_LEITOR, tipo: 'outro' };
}

async function main() {
  const t0 = Date.now();
  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  } catch {
    /* primeira leitura */
  }

  const { raiz, todos } = await arvore(PASTA_LICITACOES_ID);
  const pdfs = todos.filter((f) => f.mimeType !== PASTA);
  console.log(`Pasta "${raiz.name}": ${todos.length - pdfs.length} pastas e ${pdfs.length} arquivos.`);

  const analises = new Map();
  const aLer = [];
  for (const f of pdfs) {
    if (f.mimeType !== 'application/pdf') analises.set(f.id, { v: VERSAO_LEITOR, tipo: 'nao-pdf' });
    else if (cache[f.id]?.a?.v === VERSAO_LEITOR) {
      analises.set(f.id, cache[f.id].a);
      f.md5Checksum = cache[f.id].md5;
    } else aLer.push(f);
  }

  let lidos = 0;
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, aLer.length) }, async () => {
      while (i < aLer.length) {
        const f = aLer[i++];
        let a;
        try {
          const bytes = await baixarPublico(f.id);
          f.md5Checksum = createHash('md5').update(bytes).digest('hex');
          a = await analisarPdf(bytes);
        } catch (e) {
          a = { v: VERSAO_LEITOR, tipo: 'ilegivel', erro: String(e.message || e) };
        }
        analises.set(f.id, a);
        // erro de rede não vai para o cache: tenta de novo na próxima vez
        if (!(a.tipo === 'ilegivel' && a.erro)) cache[f.id] = { a, md5: f.md5Checksum };
        if (++lidos % 20 === 0) console.log(`  ${lidos} de ${aLer.length} PDFs lidos`);
      }
    }),
  );
  console.log(`${aLer.length} PDFs lidos agora; ${[...analises.values()].filter((x) => x.tipo !== 'nao-pdf').length - aLer.length} já estavam lidos.`);

  const resultado = planejar(raiz, analises);
  const saida = {
    atualizadoEm: new Date().toISOString(),
    raiz: { id: raiz.id, name: raiz.name, webViewLink: raiz.webViewLink },
    arquivos: pdfs.length,
    resultado: { processos: resultado.processos, pendencias: resultado.pendencias, avisos: resultado.avisos },
  };
  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  fs.writeFileSync(SAIDA, JSON.stringify(saida));
  // só guarda no cache o que ainda existe na pasta
  const ids = new Set(pdfs.map((f) => f.id));
  fs.writeFileSync(CACHE, JSON.stringify(Object.fromEntries(Object.entries(cache).filter(([id]) => ids.has(id)))));
  console.log(
    `${resultado.processos.length} processos, ${resultado.pendencias.length} pastas sem termo, ${resultado.avisos.length} avisos (${((Date.now() - t0) / 1000).toFixed(0)} s). Gravado em ${SAIDA}.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
