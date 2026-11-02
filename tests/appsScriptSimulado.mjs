// Roda scripts/apps-script/meus-editais.gs no Node com uma planilha de mentira (para testar sem o Google).
import fs from 'node:fs';
import vm from 'node:vm';

export function criarAppsScript(senha = 'senha-teste') {
  const codigo = fs.readFileSync(new URL('../scripts/apps-script/meus-editais.gs', import.meta.url), 'utf8').replace("const SENHA = 'TROQUE-ESTA-SENHA';", `const SENHA = ${JSON.stringify(senha)};`);
  const linhas = [['ID do edital (PNCP)', 'Etapa', 'Anotações', 'Salvo por', 'Salvo em', 'Atualizado em', 'Removido', 'Cidade', 'Objeto', 'Propostas até', 'Valor estimado', 'Link', 'Dados do edital (não editar)']];
  let nome = 'Untitled';
  let formato = '';
  const sheet = {
    getName: () => nome,
    setName: (n) => (nome = n),
    getLastRow: () => linhas.length,
    appendRow: (l) => linhas.push(l.map((v) => (typeof v === 'number' ? v : String(v)))),
    getRange: (a, b, c, d) => {
      if (typeof a === 'string') return { getNumberFormat: () => formato, setNumberFormat: (f) => (formato = f), setFontWeight: () => {} };
      return {
        getValues: () => linhas.slice(a - 1, a - 1 + c).map((l) => Array.from({ length: d }, (_, i) => l[b - 1 + i] ?? '')),
        setValues: (vals) => vals.forEach((v, k) => (linhas[a - 1 + k] = v.map((x) => (typeof x === 'number' ? x : String(x))))),
      };
    },
    setFrozenRows: () => {},
  };
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => (n === nome ? sheet : null), getSheets: () => [sheet] }) },
    ContentService: { createTextOutput: (t) => ({ texto: t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { sleep() {} },
    JSON,
    String,
    Number,
  };
  vm.createContext(ctx);
  vm.runInContext(codigo, ctx);
  return {
    linhas,
    nomeAba: () => nome,
    get: (params) => JSON.parse(ctx.doGet({ parameter: params }).texto),
    post: (corpo) => JSON.parse(ctx.doPost({ postData: { contents: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) } }).texto),
  };
}
