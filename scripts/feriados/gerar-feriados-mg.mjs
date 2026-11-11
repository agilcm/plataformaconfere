// Gera public/dados-hora/feriados-mg.json: os feriados municipais das comarcas de Minas Gerais, para a aba Hora.
// Fonte: TJMG, Portaria Conjunta nº 1.798/PR/2026, que consolida os feriados das comarcas no ano de 2026 (Anexo
// Único na redação da Portaria Conjunta nº 1.860/2026). Cada feriado vira uma regra que vale para qualquer ano:
// "MM-DD" (data fixa), "P+N" (N dias depois da Páscoa, como Corpus Christi = P+60) ou "AAAA-MM-DD" (só aquele ano).
//
// Uso: pdftotext -layout pc17982026.pdf tjmg.txt && node scripts/feriados/gerar-feriados-mg.mjs tjmg.txt
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { CIDADES_MG } from '../../src/data/coordenadasMunicipios.js';

const ANO = 2026;
const arquivo = process.argv[2];
if (!arquivo) throw new Error('Informe o texto da portaria (pdftotext -layout).');
const texto = readFileSync(arquivo, 'utf8');

// só o primeiro Anexo Único: é a redação em vigor (Portaria Conjunta nº 1.860/2026); os seguintes são as versões antigas
const ini = texto.indexOf('Feriados municipais das Comarcas');
const fim = texto.indexOf('ANEXO ÚNICO', ini);
const linhas = texto.slice(ini, fim).split('\n').slice(2);

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, "'").replace(/-/g, ' ').toLowerCase().replace(/\s+/g, ' ').trim();
const oficiais = new Map(CIDADES_MG.map(([nome]) => [norm(nome), nome]));

function pascoa(ano) {
  const a = ano % 19,
    b = Math.floor(ano / 100),
    c = ano % 100,
    d = Math.floor(b / 4),
    e = b % 4;
  const f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31),
    dia = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(ano, mes - 1, dia, 12);
}
const PASCOA = pascoa(ANO);
const MOVEL =
  /paix[aã]o|sexta-feira santa|semana santa|corpus christi|carnaval|cinzas|ascens[aã]o|pentecost|esp[ií]rito santo|endoen|m[oó]vel|quinta-feira santa/i;

/** "2 e 3 de maio", "1º, 2 e 3 de abril", "20 a 31 de dezembro", "30 de abril e 1º de maio" -> ['2026-05-02', ...] */
function datas(parte) {
  const out = [];
  const segs = parte
    .split(/\s*,\s*|\s+e\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  let pendentes = [];
  for (const s of segs) {
    const m = /^(\d{1,2})º?(?:\s+a\s+(\d{1,2})º?)?(?:\s+de\s+([a-zç]+))?$/i.exec(s);
    if (!m) return null;
    const ds = [];
    for (let d = Number(m[1]); d <= Number(m[2] || m[1]); d++) ds.push(d);
    if (!m[3]) {
      pendentes.push(...ds);
      continue;
    }
    const mes = MESES.indexOf(m[3].toLowerCase());
    if (mes < 0) return null;
    for (const d of [...pendentes, ...ds]) out.push(`${ANO}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    pendentes = [];
  }
  return pendentes.length ? null : out;
}

function regra(iso, nome) {
  const off = Math.round((Date.parse(`${iso}T12:00:00Z`) - PASCOA) / 86400e3);
  if (MOVEL.test(nome) && Math.abs(off) <= 70) return `P${off >= 0 ? '+' : ''}${off}`;
  if (/m[oó]vel/i.test(nome)) return iso; // feriado móvel que não depende da Páscoa: só vale no ano da portaria
  return iso.slice(5);
}

// junta as linhas em blocos (um por comarca): o bloco começa no item "I - " e termina no item que acaba em "."
const blocos = [];
let atual = null;
let pendente = [];
let colItens = 20;
const ITEM = /^(.*?)\s*\b([IVXL]+) - (\d.*)$/;
for (const bruta of linhas) {
  const linha = bruta.replace(/\f/g, '').replace(/\s+$/, '');
  if (!linha.trim() || /^\s*Comarca\s+Feriados/.test(linha) || /^\s*"?\s*$/.test(linha) || /^\s*\(Nova redação/.test(linha)) continue;
  const m = ITEM.exec(linha);
  if (m) {
    colItens = linha.indexOf(`${m[2]} - `);
    const [, esquerda, num, resto] = m;
    if (num === 'I') {
      atual = { nome: [...pendente], itens: [], aberto: true };
      pendente = [];
      blocos.push(atual);
    }
    if (esquerda.trim()) (atual?.aberto ? atual.nome : pendente).push(esquerda.trim());
    atual.itens.push(resto.trim());
  } else {
    const esquerda = linha.slice(0, Math.max(0, colItens - 1)).trim();
    const direita = linha.slice(Math.max(0, colItens - 1)).trim();
    if (esquerda) (atual?.aberto ? atual.nome : pendente).push(esquerda);
    if (direita && atual?.aberto) atual.itens[atual.itens.length - 1] += ` ${direita}`;
  }
  if (atual && /\.\s*$/.test(atual.itens.at(-1) || '')) atual.aberto = false;
}

const cidades = {};
const avisos = [];
for (const b of blocos) {
  let nome = b.nome.join(' ').replace(/\s+/g, ' ').trim();
  let oficial = oficiais.get(norm(nome));
  if (!oficial) {
    avisos.push(`comarca não reconhecida: "${nome}"`);
    continue;
  }
  const lista = [];
  for (const it of b.itens) {
    const t = it
      .replace(/\s+/g, ' ')
      .replace(/[;.]\s*$/, '')
      .trim();
    const k = t.indexOf(':');
    const ds = k > 0 ? datas(t.slice(0, k)) : null;
    if (!ds) {
      avisos.push(`${oficial}: item sem data reconhecida: "${t}"`);
      continue;
    }
    const motivo = t.slice(k + 1).trim();
    for (const d of ds) lista.push([regra(d, motivo), motivo]);
  }
  cidades[oficial] = lista;
}

// Belo Horizonte não está no Anexo: a portaria cita os feriados do Anexo V da Lei municipal nº 11.397/2022
cidades['Belo Horizonte'] = [
  ['P-2', 'Sexta-feira da Paixão'],
  ['P+60', 'Corpus Christi'],
  ['08-15', 'Assunção de Nossa Senhora'],
  ['12-08', 'Imaculada Conceição'],
];

const saida = {
  fonte:
    'TJMG, Portaria Conjunta nº 1.798/PR/2026 (Anexo Único na redação da Portaria Conjunta nº 1.860/2026): feriados municipais das comarcas de Minas Gerais',
  ano: ANO,
  regras: '"MM-DD" = todo ano nessa data; "P+N" = N dias depois da Páscoa; "AAAA-MM-DD" = só nesse dia',
  cidades,
  municipios: CIDADES_MG.map(([nome]) => nome),
};
mkdirSync(new URL('../../public/dados-hora/', import.meta.url), { recursive: true });
writeFileSync(new URL('../../public/dados-hora/feriados-mg.json', import.meta.url), JSON.stringify(saida));
console.log(`${Object.keys(cidades).length} comarcas, ${Object.values(cidades).flat().length} feriados, ${saida.municipios.length} municípios`);
for (const a of avisos) console.log('AVISO', a);
