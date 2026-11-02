// AGIL CM — Meus editais da equipe.
// Este código vai DENTRO da planilha "AGIL CM - Meus editais (equipe)" (Extensões → Apps Script) e é
// publicado como App da Web. O site (aba MEUS EDITAIS) lê e grava os editais salvos por aqui, então
// todo mundo da equipe vê os mesmos favoritos, etapas e anotações, em qualquer computador ou celular.
//
// Antes de publicar, troque a senha abaixo. É a senha que cada pessoa digita uma vez no site.
const SENHA = 'TROQUE-ESTA-SENHA';

const ABA = 'editais';
const CABECALHO = ['ID do edital (PNCP)', 'Etapa', 'Anotações', 'Salvo por', 'Salvo em', 'Atualizado em', 'Removido', 'Cidade', 'Objeto', 'Propostas até', 'Valor estimado', 'Link', 'Dados do edital (não editar)'];

function aba_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(ABA) || ss.getSheets()[0];
  if (sh.getName() !== ABA) sh.setName(ABA);
  if (sh.getLastRow() === 0) sh.appendRow(CABECALHO);
  // texto puro: o Sheets não transforma datas e números de controle em outra coisa
  if (sh.getRange('A2').getNumberFormat() !== '@') {
    sh.getRange('A2:J').setNumberFormat('@');
    sh.getRange('L2:M').setNumberFormat('@');
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
    let edital = null;
    try {
      edital = JSON.parse(v[12]);
    } catch (e) {
      edital = null;
    }
    if (!edital) continue;
    out[id] = {
      edital: edital,
      etapa: String(v[1] || 'interesse'),
      nota: String(v[2] || ''),
      por: String(v[3] || ''),
      salvoEm: String(v[4] || ''),
      atualizadoEm: String(v[5] || ''),
      removido: String(v[6] || '') === 'sim',
    };
  }
  return out;
}

// GET ?senha=...  →  { ok, editais: { id: registro } }
function doGet(e) {
  if (!senhaOk_(e.parameter.senha)) return saida_({ ok: false, erro: 'senha' });
  return saida_({ ok: true, editais: listar_() });
}

// POST { senha, registros: [...] }  →  grava (o mais recente vence) e devolve a lista inteira
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
    const atuais = n > 1 ? sh.getRange(2, 1, n - 1, 6).getValues() : [];
    const ids = atuais.map((v) => String(v[0]));
    for (const r of p.registros || []) {
      if (!r || !r.id || !r.edital) continue;
      const i = ids.indexOf(String(r.id));
      if (i >= 0 && String(atuais[i][5] || '') > String(r.atualizadoEm || '')) continue; // a planilha tem uma versão mais nova
      const ed = r.edital;
      const linha = [
        String(r.id),
        String(r.etapa || 'interesse'),
        String(r.nota || ''),
        String(r.por || ''),
        String(r.salvoEm || ''),
        String(r.atualizadoEm || ''),
        r.removido ? 'sim' : '',
        String(ed.municipio || ''),
        String(ed.objeto || '').slice(0, 500),
        String(ed.propostasAte || ''),
        Number(ed.valor) || '',
        String(ed.link || ''),
        JSON.stringify(ed),
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
  return saida_({ ok: true, editais: listar_() });
}
