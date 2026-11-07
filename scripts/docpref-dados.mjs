// DocPref: o GitHub Actions lê a pasta compartilhada "Documentos - Analise Documental" pelo link (uma pasta por
// prestadora, dentro dela uma pasta por mês: 03-2026, 04-2026...), identifica cada documento e a competência escrita
// nele e grava public/docpref/leitura.json, publicado com o site. Nada é enviado pelo site: a fonte é só o Drive.
// Arquivos fora das pastas de mês (PGR, contrato social, certidões guardadas na pasta da empresa) também são lidos.
//
// O que vai para o site: nome da prestadora, mês, pasta, tipo do documento, competência, valores das guias e os
// achados. Não vão: o ID da pasta (fica no segredo DOCPREF_PASTA_ID), links dos arquivos, CPF, nomes de empregados
// (arquivos pessoais viram "Tipo · código") nem o texto dos documentos.
//
// Os arquivos já lidos ficam em docpref-cache.json (cache do Actions): só os novos são baixados.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { GRUPOS, CERTIDOES, DOCUMENTOS_EMPRESA } from '../src/lib/docpref.js';
import { CATEGORIAS_PESSOAIS, lerDocumento, lerForcaDeTrabalho, norm, organizarPasta, pagoATerceiro } from '../src/lib/docprefLeitor.js';
import { lerXlsx } from '../src/lib/planilhaLeitura.js';
import { linhasDoPdf } from '../src/lib/privado/pdfTexto.js';
import { arvore, baixarPublico } from './drive-publico.mjs';

const VERSAO = 5; // muda quando o leitor muda: relê tudo
const PASTA = 'application/vnd.google-apps.folder';
/** Documentos emitidos pela própria prestadora: deles saem CNPJ, razão social e contrato (comprovantes e notas trazem outros CNPJs) */
const TIPOS_DA_EMPRESA = /^(dctf-|decl-|folha$|darf-pagamento$)/;
const SAIDA = process.env.DOCPREF_SAIDA || 'public/docpref/leitura.json';
const CACHE = process.env.DOCPREF_CACHE || 'docpref-cache.json';
const RAIZ = (process.env.DOCPREF_PASTA_ID || '').trim();

const NOME_TIPO = Object.fromEntries([...GRUPOS.flatMap((g) => g.itens), ...CERTIDOES, ...DOCUMENTOS_EMPRESA].map((i) => [i.id, i.nome]));
const ehImagem = (n) => /\.(jpe?g|png|heic|heif|webp|gif|bmp|tiff?)$/i.test(n);
const ehCompactado = (n) => /\.(zip|rar|7z|tar|gz)$/i.test(n);
const extensao = (n) => (n.match(/\.([a-z0-9]{2,5})$/i)?.[1] || '').toLowerCase();
const codigo = (id) => createHash('sha1').update(String(id)).digest('hex').slice(0, 5);
const slug = (s) =>
  norm(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'empresa';
/** "PIlar" → "Pilar" (letra maiúscula trocada por engano); nomes em caixa alta ficam como estão */
const nomeBonito = (s) => (/^[A-Z]{2}[a-z]/.test(s) ? s[0] + s.slice(1).toLowerCase() : s);

let pdfjsCarregado = null;
const pdfjs = () => (pdfjsCarregado ??= import('pdfjs-dist/legacy/build/pdf.mjs'));

/** Analisa um arquivo (só os campos que podem ir para o site) */
async function analisar(f, categoria, compPasta) {
  const nome = f.name;
  const ext = extensao(nome);
  const base = { extensao: ext };
  if (ehCompactado(nome)) return { ...base, tipo: null, compactado: true, semTexto: true };
  if (ehImagem(nome)) return { ...base, ...semPessoais(lerDocumento({ nome, categoria, texto: '', compPasta })), imagem: true, semTexto: true };
  if (ext === 'pdf') {
    const bytes = await baixarPublico(f.id);
    const lib = await pdfjs();
    let texto = '';
    try {
      const r = await linhasDoPdf(lib, bytes.slice(), { maxPaginas: 3 });
      texto = r.linhas.map((l) => l.texto).join('\n');
    } catch {
      /* PDF protegido ou corrompido: fica sem texto */
    }
    const a = lerDocumento({ nome, categoria, texto, compPasta });
    const terceiro = a.tipo === 'comp-salarios' && a.destino ? pagoATerceiro(nome, a.destino) : false;
    return {
      ...base,
      ...semPessoais(a),
      ...(terceiro ? { terceiro: true } : {}),
      _empresa: a.tipo && TIPOS_DA_EMPRESA.test(a.tipo) ? dadosDaEmpresa(texto) : null,
    };
  }
  if ((ext === 'xlsx' || ext === 'xlsm') && (/forca/.test(norm(nome)) || categoria === 'forca')) {
    const bytes = await baixarPublico(f.id);
    try {
      const fw = lerForcaDeTrabalho(await lerXlsx(bytes));
      return {
        ...base,
        tipo: 'forca',
        comp: fw.comp,
        ativos: fw.ativos,
        inativos: fw.inativos,
        admissoes: fw.admissoes,
        demissoes: fw.demissoes,
        afastados: fw.afastados,
        semTexto: false,
        evidencia: fw.comp ? `Planilha: competência ${fw.comp.slice(5)}/${fw.comp.slice(0, 4)}` : '',
      };
    } catch {
      return { ...base, tipo: 'forca', semTexto: false };
    }
  }
  return { ...base, ...semPessoais(lerDocumento({ nome, categoria, texto: '', compPasta })), semTexto: ext !== 'xls' && ext !== 'xlsx' && ext !== 'csv' };
}

/** Tira o que pode identificar pessoas (destino do Pix, descrição do pagamento) */
function semPessoais(a) {
  const { destino, detalhes, ...resto } = a;
  void destino;
  void detalhes;
  return Object.fromEntries(Object.entries(resto).filter(([, v]) => v !== null && v !== undefined && v !== ''));
}

/** CNPJ, razão social e contrato da prestadora escritos nos documentos */
function dadosDaEmpresa(texto) {
  if (!texto) return null;
  const cnpj = texto.match(/CNPJ(?:\/CPF)?:?\s*(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/)?.[1] || null;
  const razao = texto.match(/(?:^|\n)Nome\s+([A-Z0-9][A-Z0-9 &.,'-]{6,}(?:LTDA|S\.?A\.?|EIRELI|ME|EPP)\b)/)?.[1]?.trim() || null;
  const contrato = texto.match(/contrato n[ºo°.]*\s*([\d./-]{5,})/i)?.[1]?.replace(/[.,]$/, '') || null;
  return cnpj || razao || contrato ? { cnpj, razao, contrato } : null;
}

const maisComum = (lista) => {
  const c = new Map();
  for (const x of lista.filter(Boolean)) c.set(x, (c.get(x) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
};

async function main() {
  if (!RAIZ) {
    console.log('DocPref: segredo DOCPREF_PASTA_ID não configurado; a leitura da pasta foi pulada.');
    return;
  }
  const t0 = Date.now();
  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  } catch {
    /* primeira leitura */
  }
  const { raiz, todos } = await arvore(RAIZ);
  console.log(
    `Pasta "${raiz.name}": ${todos.filter((f) => f.mimeType === PASTA).length} pastas e ${todos.filter((f) => f.mimeType !== PASTA).length} arquivos.`,
  );

  // prestadoras → meses → arquivos (src/lib/docprefLeitor.js, testado com pastas de vários formatos)
  const org = organizarPasta(raiz);
  if (org.ignoradas.length) console.log(`Pastas na raiz que não são prestadoras: ${org.ignoradas.join(', ')}`);
  const tarefas = [];
  for (const e of org.empresas) {
    for (const m of e.meses) for (const a of m.arquivos) tarefas.push({ ...a, comp: m.comp });
    for (const d of e.documentos) tarefas.push({ ...d, comp: null });
  }

  let lidos = 0;
  let i = 0;
  const fila = tarefas.filter((t) => cache[t.f.id]?.v !== VERSAO);
  await Promise.all(
    Array.from({ length: Math.min(3, fila.length) }, async () => {
      while (i < fila.length) {
        const t = fila[i++];
        try {
          cache[t.f.id] = { v: VERSAO, a: await analisar(t.f, t.categoria, t.comp) };
        } catch (e) {
          console.log(`  não consegui ler um arquivo de ${t.comp}: ${e.message}`);
        }
        if (++lidos % 20 === 0) console.log(`  ${lidos} de ${fila.length} arquivos lidos`);
      }
    }),
  );
  console.log(`${fila.length} arquivos lidos agora; ${tarefas.length - fila.length} já estavam lidos.`);

  const saida = {
    versao: 2,
    atualizadoEm: new Date().toISOString(),
    pasta: raiz.name,
    ignoradas: org.ignoradas,
    empresas: org.empresas.map((e) => {
      const dados = [];
      /** O que pode ir para o site sobre um arquivo. Nome original só de documento reconhecido e não pessoal. */
      const publico = ({ f, categoria, nomeCategoria, pessoa }, padraoPasta, vistos) => {
        const { _empresa, ...a } = cache[f.id]?.a || { erro: true, extensao: extensao(f.name) };
        if (_empresa) dados.push(_empresa);
        const pessoal = pessoa || CATEGORIAS_PESSOAIS.has(categoria);
        let rotulo =
          !pessoal && a.tipo
            ? f.name
            : `${NOME_TIPO[a.tipo] || (a.compactado ? 'Arquivo compactado' : 'Documento')} · ${codigo(f.id)}${a.extensao ? `.${a.extensao}` : ''}`;
        // dois arquivos com o mesmo nome no mesmo mês: acrescenta um número para diferenciar
        let n = 2;
        while (vistos.has(rotulo)) rotulo = rotulo.replace(/( \(\d+\))?(\.[a-z0-9]+)?$/, (_, __, x = '') => ` (${n++})${x}`);
        vistos.add(rotulo);
        return { rotulo, categoria, pasta: nomeCategoria || padraoPasta, ...(pessoa ? { pessoa: true } : {}), ...a };
      };
      const meses = e.meses.map((m) => ({
        comp: m.comp,
        pasta: m.pastas.join(' + '),
        pessoas: m.pessoas,
        arquivos: ((vistos) => m.arquivos.map((x) => publico(x, 'Pasta do mês', vistos)))(new Set()),
      }));
      const documentos = ((vistos) => e.documentos.map((x) => publico(x, 'Pasta da empresa', vistos)))(new Set());
      return {
        id: slug(e.nome),
        nome: nomeBonito(e.nome),
        cnpj: maisComum(dados.map((d) => d.cnpj)),
        razao: maisComum(dados.map((d) => d.razao)),
        contrato: maisComum(dados.map((d) => d.contrato)),
        meses,
        documentos,
      };
    }),
  };
  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  fs.writeFileSync(SAIDA, JSON.stringify(saida));
  const vivos = new Set(tarefas.map((t) => t.f.id));
  fs.writeFileSync(CACHE, JSON.stringify(Object.fromEntries(Object.entries(cache).filter(([id]) => vivos.has(id)))));
  console.log(`${saida.empresas.length} prestadoras, ${tarefas.length} arquivos (${((Date.now() - t0) / 1000).toFixed(0)} s). Gravado em ${SAIDA}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
