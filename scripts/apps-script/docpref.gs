// DocPref — planilha compartilhada do órgão.
// Este código vai DENTRO de uma planilha Google do órgão (ex.: "DocPref - Prefeitura de ...", em Extensões → Apps Script)
// e é publicado como App da Web. O DocPref (www.agilcm.com.br/docpref/) lê e grava aqui os dados do órgão, o cadastro
// das contratadas e as conferências do fiscal, então todos os fiscais veem as mesmas marcações, em qualquer computador.
//
// Antes de publicar, troque a senha abaixo. É a senha que cada fiscal digita uma vez no DocPref.
// Publicar: Implantar → Nova implantação → Tipo "App da Web" → Executar como "Eu" → Quem pode acessar "Qualquer pessoa".
const SENHA = 'TROQUE-ESTA-SENHA';

const ABA = 'docpref';
const CABECALHO = ['Registro', 'Tipo', 'Resumo', 'Atualizado em', 'Por', 'Removido', 'Dados (não editar)'];

function aba_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(ABA) || ss.getSheets()[0];
  if (sh.getName() !== ABA) sh.setName(ABA);
  if (sh.getLastRow() === 0) sh.appendRow(CABECALHO);
  // texto puro: o Sheets não transforma datas e números em outra coisa
  if (sh.getRange('A2').getNumberFormat() !== '@') {
    sh.getRange('A2:G').setNumberFormat('@');
    sh.getRange('1:1').setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function saida_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function senhaOk_(s) {
  if (String(s || '') === SENHA && SENHA !== 'TROQUE-ESTA-SENHA') return true;
  Utilities.sleep(1500); // segura quem tenta adivinhar a senha
  return false;
}

function listar_() {
  const sh = aba_();
  const n = sh.getLastRow();
  const out = {};
  if (n < 2) return out;
  const linhas = sh.getRange(2, 1, n - 1, CABECALHO.length).getValues();
  for (const v of linhas) {
    const id = String(v[0] || '');
    if (!id) continue;
    const removido = String(v[5] || '') === 'sim';
    let dados = null;
    if (!removido) {
      try {
        dados = JSON.parse(v[6]);
      } catch (e) {
        continue; // linha estragada à mão: fica de fora
      }
    }
    out[id] = { tipo: String(v[1] || ''), dados: dados, atualizadoEm: String(v[3] || ''), por: String(v[4] || ''), removido: removido };
  }
  return out;
}

// GET ?senha=...  →  { ok, registros: { id: registro } }   (usado também pelo aviso do Telegram no GitHub)
function doGet(e) {
  if (!senhaOk_(e.parameter.senha)) return saida_({ ok: false, erro: 'senha' });
  return saida_({ ok: true, registros: listar_() });
}

// POST { senha, registros: [...] }  →  grava (vale a mudança mais recente de cada registro) e devolve todos
function doPost(e) {
  let p;
  try {
    p = JSON.parse(e.postData.contents);
  } catch (err) {
    return saida_({ ok: false, erro: 'json' });
  }
  if (!senhaOk_(p.senha)) return saida_({ ok: false, erro: 'senha' });
  const trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try {
    const sh = aba_();
    const n = sh.getLastRow();
    const atuais = n > 1 ? sh.getRange(2, 1, n - 1, 4).getValues() : [];
    const ids = atuais.map((v) => String(v[0]));
    for (const r of p.registros || []) {
      if (!r || !r.id) continue;
      const i = ids.indexOf(String(r.id));
      if (i >= 0 && String(atuais[i][3] || '') >= String(r.atualizadoEm || '')) continue; // a planilha já tem esta versão ou uma mais nova
      const linha = [
        String(r.id),
        String(r.tipo || ''),
        String(r.resumo || '').slice(0, 300),
        String(r.atualizadoEm || ''),
        String(r.por || ''),
        r.removido ? 'sim' : '',
        r.removido ? '' : JSON.stringify(r.dados),
      ];
      if (i >= 0) {
        sh.getRange(i + 2, 1, 1, linha.length).setValues([linha]);
        atuais[i] = linha;
      } else {
        sh.appendRow(linha);
        ids.push(String(r.id));
        atuais.push(linha);
      }
    }
  } finally {
    trava.releaseLock();
  }
  return saida_({ ok: true, registros: listar_() });
}
