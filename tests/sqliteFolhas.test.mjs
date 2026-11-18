// Leitor de páginas SQLite (src/lib/sqliteFolhas.js): confere contra um banco criado pelo próprio SQLite do Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { lerTabela, linhasDaPagina, PAGINA, tamanhoDaPagina } from '../src/lib/sqliteFolhas.js';

test('lê as linhas página por página, igual ao SQLite, e conta as grandes demais', async () => {
  const arq = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'folhas-')), 'teste.db');
  const db = new DatabaseSync(arq);
  db.exec('PRAGMA page_size = 4096');
  db.exec('CREATE TABLE municipio (codigo TEXT, descricao TEXT)');
  db.exec('CREATE TABLE estabelecimento (cnpj_basico TEXT, nome TEXT, n INTEGER, grande INTEGER, valor REAL, nada TEXT)');
  const ins = db.prepare('INSERT INTO estabelecimento VALUES (?, ?, ?, ?, ?, ?)');
  for (let i = 0; i < 3000; i++) ins.run(String(i).padStart(8, '0'), `EMPRESA ${i} ÇÃO`, i - 1500, 2 ** 40 + i, i / 4, null);
  ins.run('99999999', 'X'.repeat(9000), 1, 1, 1, null); // não cabe numa página: vai para o overflow
  const im = db.prepare('INSERT INTO municipio VALUES (?, ?)');
  for (let i = 0; i < 400; i++) im.run(String(4000 + i), `CIDADE ${i}`);
  db.close();
  const buf = new Uint8Array(fs.readFileSync(arq));
  const T = tamanhoDaPagina(buf);
  assert.equal(T, 4096);
  // varredura em sequência: todas as páginas, como no Drive
  const vistas = [];
  let grandes = 0;
  for (let i = 0; i < buf.length / T; i++) {
    const r = linhasDaPagina(buf.subarray(i * T, (i + 1) * T), { primeira: i === 0 });
    grandes += r.grandes;
    for (const l of r.linhas) if (l.valores.length === 6) vistas.push(l);
  }
  assert.equal(vistas.length, 3000);
  assert.equal(grandes, 1, 'a linha de 9 mil letras fica de fora');
  const l = vistas.find((x) => x.valores[0] === '00001234');
  assert.deepEqual(l.valores, ['00001234', 'EMPRESA 1234 ÇÃO', -266, 2 ** 40 + 1234, 308.5, null]);
  // tabela pequena pela árvore, a partir da raiz (sqlite_master na página 1)
  const pagina = (n) => buf.subarray((n - 1) * T, n * T);
  const mestre = await lerTabela(pagina, 1);
  const raiz = mestre.find((x) => x.valores[1] === 'municipio').valores[3];
  const muns = await lerTabela(pagina, raiz);
  assert.equal(muns.length, 400);
  assert.deepEqual(muns[0].valores, ['4000', 'CIDADE 0']);
  assert.equal(linhasDaPagina(pagina(raiz)).tipo === PAGINA.TABELA_FOLHA || linhasDaPagina(pagina(raiz)).tipo === PAGINA.TABELA_INTERNA, true);
});
