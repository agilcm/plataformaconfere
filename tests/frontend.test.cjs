const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
  const element = () => ({ innerHTML: '', textContent: '', value: '', style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, querySelector() { return null; }, click() {} });
  const elements = {};
  let csv;
  const context = vm.createContext({ Date, Intl, structuredClone, Blob, URLSearchParams,
    URL: { createObjectURL(blob) { csv = blob; return 'blob:test'; }, revokeObjectURL() {} },
    crypto: require('node:crypto').webcrypto, setTimeout() {}, setInterval() {},
    localStorage: { getItem() { return null; }, setItem() {} },
    document: { querySelectorAll() { return []; }, querySelector() { return null; }, getElementById(id) { return elements[id] ??= element(); }, createElement: element, addEventListener() {}, body: element() },
    window: { location: { origin: 'http://localhost:3000' }, addEventListener() {}, scrollTo() {} }
  });
  for (const file of ['app.js', 'notifications.js', 'verification.js']) {
    let source = fs.readFileSync(path.join(__dirname, '..', 'public', 'documentos', file), 'utf8');
    // Expose private functions only inside this isolated test context.
    if (file === 'verification.js') source = source.replace('  renderDocuments=renderDocumentsVerified;', '  globalThis.checks={paymentCheck,statusClassFor,exportChecks};\n  renderDocuments=renderDocumentsVerified;');
    vm.runInContext(source, context, { filename: file });
  }
  return { run: source => vm.runInContext(source, context), elements, csv: () => csv.text() };
}

test('all eight pages render with a simulated DOM', () => {
  const app = load();
  for (const page of ['dashboard', 'companies', 'employees', 'documents', 'contracts', 'reports', 'notifications', 'settings']) {
    app.run(`setPage('${page}')`);
    assert.ok(app.elements['page-content'].innerHTML.length > 100, page);
  }
});

test('unsigned and pending documents never receive approved badges', () => {
  const app = load();
  for (const [label, expected] of [['Marcada como não assinada', 'status-rejected'], ['Valor não conferido', 'status-pending'], ['Assinatura não conferida', 'status-pending'], ['Reprovado', 'status-rejected'], ['Assinatura marcada como conferida', 'status-approved'], ['Valor confere', 'status-approved']]) {
    assert.equal(app.run(`checks.statusClassFor(${JSON.stringify(label)})`), expected, label);
  }
});

test('payment comparison sums receipts, tolerates one cent and reports missing values', () => {
  const app = load();
  app.run(`data.documents=[{id:'g',kind:'guide',amount:100},{id:'p1',kind:'payment',relatedGuideId:'g',amount:40},{id:'p2',kind:'payment',relatedGuideId:'g',amount:60}]`);
  assert.equal(app.run('checks.paymentCheck(data.documents[0]).state'), 'match');
  for (const [amount, expected] of [[60.01, 'match'], [60.02, 'mismatch'], ['', 'unknown']]) {
    app.run(`data.documents[2].amount=${JSON.stringify(amount)}`);
    assert.equal(app.run('checks.paymentCheck(data.documents[0]).state'), expected);
  }
  app.run("setPage('reports')");
  assert.match(app.elements['page-content'].innerHTML, /Guia ou comprovante sem valor informado/);
});

test('CSV includes unchecked values and keeps EPI signature and link in their columns', async () => {
  const app = load();
  app.run(`data.documents=[{id:'g',kind:'guide',fileName:'guia.pdf',amount:100},{id:'p',kind:'payment',relatedGuideId:'g',amount:''},{id:'epi',kind:'epi',fileName:'epi.pdf',signatureStatus:'unsigned',driveUrl:'https://drive.google.com/file/d/test/view'}];checks.exportChecks()`);
  const rows = (await app.csv()).trim().split('\r\n').map(line => line.replace(/^\uFEFF/, '').split(';').map(cell => cell.slice(1,-1)));
  assert.equal(rows.length, 3);
  for (const row of rows) assert.equal(row.length, 13);
  assert.equal(rows[1][0], 'Valor não conferido');
  assert.equal(rows[2][9], 'unsigned');
  assert.equal(rows[2][12], 'https://drive.google.com/file/d/test/view');
});
