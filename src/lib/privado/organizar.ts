// Leitura da pasta de licitações no Drive, análise dos PDFs e execução do plano de organização.
import { AGIL_CNPJ_RAIZ } from '../../data/privadoConfig.ts';
import { atualizar, baixar, criarPasta, lixeira, listarFilhos, obter, salvarTexto, type ArquivoDrive } from './drive.ts';
import { linhasDoPdf } from './pdfTexto.js';
import { NOME_DADOS, PASTA, planejar } from './plano.js';
import { classificar, lerAta, lerTermo } from './termo.js';

/** Suba este número quando o leitor de termos mudar: os PDFs são lidos de novo. */
const VERSAO_LEITOR = 1;
const LIMITE_PDF = 40 * 1024 * 1024;

export interface No extends ArquivoDrive {
  filhos?: No[];
}

export interface Analise {
  v: number;
  tipo: 'homologacao' | 'adjudicacao' | 'ata' | 'outro' | 'ilegivel' | 'nao-pdf';
  termo?: any;
  ata?: any;
  erro?: string;
}

export interface Operacao {
  op: 'criar' | 'mover';
  ref?: string;
  id?: string;
  nome?: string;
  nomeAntes?: string;
  pai?: string;
  de?: string;
  para?: string;
  props?: Record<string, string>;
}

interface Historico {
  quando: string;
  movidos: { id: string; nomeAntes?: string; de: string; para: string; props?: string[] }[];
  criadas: string[];
}

interface Dados {
  versao: 1;
  analises: Record<string, Analise>; // por md5
  historico?: Historico | null;
}

export type Progresso = (etapa: string, feito?: number, total?: number) => void;

const ehPdf = (f: ArquivoDrive) => f.mimeType === 'application/pdf' || /\.pdf$/i.test(f.name);
const CACHE_LOCAL = 'agilcm:privado:analises';

async function comLimite<T>(lista: T[], n: number, fn: (x: T, i: number) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, lista.length) }, async () => {
      while (i < lista.length) {
        const k = i++;
        await fn(lista[k], k);
      }
    }),
  );
}

let pdfjsCarregado: Promise<any> | null = null;
function pdfjs() {
  pdfjsCarregado ??= (async () => {
    const [lib, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  })();
  return pdfjsCarregado;
}

async function analisarPdf(bytes: Uint8Array): Promise<Analise> {
  const lib = await pdfjs();
  // o pdf.js toma posse do buffer: cada leitura recebe uma cópia
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

export interface Leitura {
  raiz: No;
  analises: Map<string, Analise>;
  dados: Dados;
  arquivoDados: ArquivoDrive | null;
  resultado: ReturnType<typeof planejar>;
}

function lerCacheLocal(): Record<string, Analise> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_LOCAL) || '{}');
  } catch {
    return {};
  }
}
function salvarCacheLocal(a: Record<string, Analise>) {
  try {
    localStorage.setItem(CACHE_LOCAL, JSON.stringify(a));
  } catch {
    /* cheio ou indisponível: só fica mais lento na próxima vez */
  }
}

/** Lê toda a pasta (sem alterar nada no Drive) e calcula o plano de organização. */
export async function lerPasta(raizId: string, progresso: Progresso): Promise<Leitura> {
  progresso('Abrindo a pasta no Google Drive…');
  const raiz: No = await obter(raizId);
  if (raiz.mimeType !== PASTA) throw new Error('O endereço informado não é uma pasta do Google Drive.');

  // árvore completa
  let pastasLidas = 0;
  const fila: No[] = [raiz];
  const todos: No[] = [];
  while (fila.length) {
    const lote = fila.splice(0, fila.length);
    await comLimite(lote, 4, async (p) => {
      p.filhos = await listarFilhos(p.id);
      pastasLidas++;
      progresso('Lendo as pastas', pastasLidas);
      for (const f of p.filhos) {
        todos.push(f);
        if (f.mimeType === PASTA) fila.push(f);
      }
    });
  }

  const arquivoDados = (raiz.filhos || []).find((f) => f.name === NOME_DADOS && f.appProperties?.agil === 'dados') || null;
  let dados: Dados = { versao: 1, analises: {} };
  if (arquivoDados) {
    try {
      dados = { ...dados, ...JSON.parse(new TextDecoder().decode(await baixar(arquivoDados.id))) };
    } catch {
      /* arquivo de dados ilegível: recomeça a análise */
    }
  }
  const local = lerCacheLocal();

  const analises = new Map<string, Analise>();
  const pdfs = todos.filter((f) => f.mimeType !== PASTA && f.name !== NOME_DADOS);
  const aLer: No[] = [];
  for (const f of pdfs) {
    if (!ehPdf(f)) {
      analises.set(f.id, { v: VERSAO_LEITOR, tipo: 'nao-pdf' });
      continue;
    }
    const k = f.md5Checksum || f.id;
    const salvo = dados.analises[k] || local[k];
    if (salvo && salvo.v === VERSAO_LEITOR) analises.set(f.id, salvo);
    else aLer.push(f);
  }

  let lidos = 0;
  await comLimite(aLer, 3, async (f) => {
    let a: Analise;
    try {
      if (Number(f.size || 0) > LIMITE_PDF) a = { v: VERSAO_LEITOR, tipo: 'outro', erro: 'PDF grande demais para ler no navegador' };
      else a = await analisarPdf(await baixar(f.id));
    } catch (e) {
      if ((e as { status?: number }).status === 401) throw e;
      a = { v: VERSAO_LEITOR, tipo: 'ilegivel', erro: String((e as Error).message || e) };
    }
    analises.set(f.id, a);
    dados.analises[f.md5Checksum || f.id] = a;
    lidos++;
    progresso('Lendo os PDFs', lidos, aLer.length);
  });
  if (aLer.length) salvarCacheLocal(dados.analises);

  return {
    raiz,
    analises,
    dados,
    arquivoDados,
    resultado: planejar(raiz, analises),
  };
}

async function gravarDados(l: Leitura, dados: Dados) {
  const conteudo = JSON.stringify(dados);
  l.arquivoDados = await salvarTexto(
    { id: l.arquivoDados?.id, nome: NOME_DADOS, pai: l.raiz.id, mimeType: 'application/json', appProperties: { agil: 'dados' } },
    conteudo,
  );
}

/** Executa as operações do plano no Drive e guarda o histórico para poder desfazer. */
export async function executar(l: Leitura, progresso: Progresso): Promise<{ feitas: number; erros: string[] }> {
  const ops = l.resultado.ops as Operacao[];
  const refs = new Map<string, string>();
  const real = (id?: string) => (id && refs.get(id)) || id || '';
  const hist: Historico = { quando: new Date().toISOString(), movidos: [], criadas: [] };
  const erros: string[] = [];
  const falhou = new Set<string>();
  let feitas = 0;

  for (const [i, o] of ops.entries()) {
    progresso('Organizando', i + 1, ops.length);
    try {
      if (o.op === 'criar') {
        if (falhou.has(o.pai!)) throw new Error('pasta acima não foi criada');
        const p = await criarPasta(o.nome!, real(o.pai), o.props || {});
        refs.set(o.ref!, p.id);
        hist.criadas.push(p.id);
      } else {
        if (falhou.has(o.para!)) throw new Error('pasta de destino não foi criada');
        await atualizar(o.id!, { nome: o.nome, de: real(o.de), para: real(o.para), appProperties: o.props });
        hist.movidos.push({ id: o.id!, nomeAntes: o.nome ? o.nomeAntes : undefined, de: real(o.de), para: real(o.para), props: o.props ? Object.keys(o.props) : undefined });
      }
      feitas++;
    } catch (e) {
      if (o.ref) falhou.add(o.ref);
      erros.push(`${o.op === 'criar' ? `Criar pasta "${o.nome}"` : `Mover "${o.nomeAntes || o.id}"`}: ${(e as Error).message}`);
      if ((e as { status?: number }).status === 401) break;
    }
  }
  progresso('Salvando o resumo na pasta…');
  await gravarDados(l, { ...l.dados, historico: hist });
  return { feitas, erros };
}

/** Volta os arquivos para onde estavam antes da última organização. */
export async function desfazer(l: Leitura, progresso: Progresso): Promise<{ feitas: number; erros: string[] }> {
  const h = l.dados.historico;
  if (!h) return { feitas: 0, erros: ['Não há organização para desfazer.'] };
  const erros: string[] = [];
  let feitas = 0;
  const movidos = [...h.movidos].reverse();
  for (const [i, m] of movidos.entries()) {
    progresso('Desfazendo', i + 1, movidos.length);
    try {
      const props = m.props ? Object.fromEntries(m.props.map((k) => [k, null])) : undefined;
      await atualizar(m.id, { nome: m.nomeAntes, de: m.para, para: m.de, appProperties: props });
      feitas++;
    } catch (e) {
      erros.push(`${m.nomeAntes || m.id}: ${(e as Error).message}`);
    }
  }
  // pastas criadas pela organização: vão para a lixeira só se ficaram vazias
  for (const id of [...h.criadas].reverse()) {
    try {
      if ((await listarFilhos(id)).length === 0) await lixeira(id);
    } catch {
      /* deixa a pasta: o usuário pode apagar manualmente */
    }
  }
  await gravarDados(l, { ...l.dados, historico: null });
  return { feitas, erros };
}
