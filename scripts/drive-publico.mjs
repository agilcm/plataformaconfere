// Leitura de uma pasta pública do Google Drive ("qualquer pessoa com o link") sem login nem chave:
// lista a pasta pela página de incorporação (embeddedfolderview) e baixa os arquivos pelo link de download.
// Roda no GitHub Actions (no navegador o Google bloqueia essa leitura por CORS).

const PASTA = 'application/vnd.google-apps.folder';
const ENTIDADES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const dec = (s) =>
  String(s || '')
    .replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTIDADES[m])
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

async function buscar(url, tipo = 'text', tentativas = 4) {
  for (let t = 0; ; t++) {
    try {
      const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (agilcm.com.br)' }, signal: AbortSignal.timeout(60_000) });
      if (r.ok) return tipo === 'bytes' ? new Uint8Array(await r.arrayBuffer()) : await r.text();
      if (r.status === 404 || r.status === 403) throw Object.assign(new Error(`Drive respondeu ${r.status}`), { fatal: true });
      throw new Error(`Drive respondeu ${r.status}`);
    } catch (e) {
      if (e.fatal || t >= tentativas) throw e;
      await new Promise((ok) => setTimeout(ok, 2000 * 2 ** t));
    }
  }
}

/** Itens de uma pasta pública: { id, name, mimeType, webViewLink } */
export async function listarPasta(id) {
  const html = await buscar(`https://drive.google.com/embeddedfolderview?id=${id}#list`);
  if (!/flip-entry|flip-list/.test(html)) throw new Error('A pasta não está pública ("qualquer pessoa com o link") ou o link mudou.');
  const itens = [];
  for (const m of html.matchAll(
    /<div class="flip-entry" id="entry-([\w-]+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?<div class="flip-entry-title">([\s\S]*?)<\/div>/g,
  )) {
    const [, fid, href, titulo] = m;
    const pasta = /\/folders\//.test(href);
    const name = dec(titulo).trim();
    itens.push({
      id: fid,
      name,
      mimeType: pasta ? PASTA : /\.pdf$/i.test(name) ? 'application/pdf' : 'application/octet-stream',
      webViewLink: pasta ? `https://drive.google.com/drive/folders/${fid}` : `https://drive.google.com/file/d/${fid}/view`,
    });
  }
  return itens;
}

/** Nome da pasta (título da página de incorporação) */
export async function nomeDaPasta(id) {
  const html = await buscar(`https://drive.google.com/embeddedfolderview?id=${id}#list`);
  return dec(html.match(/<title>([^<]*)<\/title>/)?.[1] || '').trim();
}

/** Baixa um arquivo público */
export async function baixarPublico(id) {
  const bytes = await buscar(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, 'bytes');
  // arquivo grande demais pede confirmação numa página HTML: não é o arquivo
  if (bytes[0] === 0x3c && new TextDecoder().decode(bytes.subarray(0, 200)).toLowerCase().includes('<!doctype html'))
    throw new Error('o Drive devolveu uma página em vez do arquivo');
  return bytes;
}

/** Árvore completa da pasta: cada pasta ganha `filhos` (como a leitura feita no navegador) */
export async function arvore(raizId, { limite = 4, aoLer } = {}) {
  const raiz = { id: raizId, name: await nomeDaPasta(raizId), mimeType: PASTA, webViewLink: `https://drive.google.com/drive/folders/${raizId}` };
  const fila = [raiz];
  const todos = [];
  while (fila.length) {
    const lote = fila.splice(0, fila.length);
    let i = 0;
    await Promise.all(
      Array.from({ length: Math.min(limite, lote.length) }, async () => {
        while (i < lote.length) {
          const p = lote[i++];
          p.filhos = (await listarPasta(p.id)).map((f) => ({ ...f, parents: [p.id] }));
          aoLer?.(p);
          for (const f of p.filhos) {
            todos.push(f);
            if (f.mimeType === PASTA) fila.push(f);
          }
        }
      }),
    );
  }
  return { raiz, todos };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // teste: node scripts/drive-publico.mjs <id da pasta>
  const { raiz, todos } = await arvore(process.argv[2]);
  const pdfs = todos.filter((f) => f.mimeType === 'application/pdf');
  console.log(`Pasta "${raiz.name}": ${todos.filter((f) => f.mimeType === PASTA).length} pastas, ${pdfs.length} PDFs, ${todos.length} itens`);
  for (const f of raiz.filhos.slice(0, 10)) console.log(' -', f.mimeType === PASTA ? '[pasta]' : '', f.name);
  if (pdfs[0]) {
    const b = await baixarPublico(pdfs[0].id);
    console.log(`Baixei "${pdfs[0].name}": ${b.length} bytes, começa com ${new TextDecoder().decode(b.subarray(0, 5))}`);
  }
}
