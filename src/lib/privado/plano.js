// Decide como organizar a pasta de licitações a partir da árvore do Drive e da leitura de cada PDF.
// Puro: devolve os processos encontrados, as pendências (pastas sem termo) e a lista de operações
// (criar pasta / mover e renomear). Quem executa no Drive é organizar.ts.
//
// Estrutura final:
//   Licitacoes - Agil/
//     Prefeitura Municipal de Rodeiro/                  (appProperties agil=orgao)
//       Processo 028-2025 - Pregão 018-2025/            (agil=processo)
//         Processo 028-2025 - Termo de Homologação.pdf  (agil=termo)
//         Outros/                                       (agil=outros: a pasta original, com os demais arquivos)
//     Outros/                                           (agil=outros-raiz: arquivos soltos que não são termos)
//
// Pastas sem termo de homologação/adjudicação ficam onde estão e viram pendência (vermelho).

export const PASTA = 'application/vnd.google-apps.folder';
export const TERMOS = new Set(['homologacao', 'adjudicacao']);
export const NOME_DADOS = '_agil-dados.json';

const ehPasta = (n) => n.mimeType === PASTA;
const marca = (n) => n.appProperties?.agil || '';

export const slug = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const pad = (n) => String(Number(n)).padStart(3, '0');
export const chaveProcesso = (orgao, p) => `${slug(orgao)}|${Number(p.numero)}|${p.ano}`;
export const rotuloProcesso = (p) => `${pad(p.numero)}/${p.ano}`;

export function nomePastaProcesso(t) {
  const base = `Processo ${pad(t.processo.numero)}-${t.processo.ano}`;
  return t.edital ? `${base} - ${t.modalidade || 'Edital'} ${pad(t.edital.numero)}-${t.edital.ano}` : base;
}

export const nomeTermo = (t) =>
  `Processo ${pad(t.processo.numero)}-${t.processo.ano} - Termo de ${t.tipo === 'homologacao' ? 'Homologação' : 'Adjudicação'}.pdf`;

function* descendentes(no, pular) {
  for (const f of no.filhos || []) {
    if (pular && pular(f)) continue;
    yield { no: f, pai: no.id, caminho: no };
    if (ehPasta(f)) yield* descendentes(f, pular);
  }
}

/**
 * @param {any} raiz  nó da pasta raiz, com `filhos` recursivos (campos da API do Drive)
 * @param {Map<string, any>} analises  id do arquivo -> { tipo, termo?, ata? }
 */
export function planejar(raiz, analises) {
  const ops = [];
  const pendencias = [];
  const avisos = [];
  const processos = new Map();
  const orgaos = new Map();
  const pastas = new Map(); // chave -> { id, nome, nomes, outros, md5s }
  let outrosRaiz = null;
  let seq = 0;
  const novoRef = (tipo) => `novo:${++seq}:${tipo}`;

  // ---------------------------------------------------------- o que já foi organizado antes
  for (const f of raiz.filhos || []) {
    if (ehPasta(f) && marca(f) === 'orgao') {
      orgaos.set(f.appProperties.chave || slug(f.name), { id: f.id, nome: f.name });
      for (const p of f.filhos || []) {
        if (!(ehPasta(p) && marca(p) === 'processo' && p.appProperties.chave)) continue;
        const md5s = new Set();
        for (const { no } of descendentes(p)) if (marca(no) === 'termo' && no.md5Checksum) md5s.add(no.md5Checksum);
        pastas.set(p.appProperties.chave, {
          id: p.id,
          nome: p.name,
          link: p.webViewLink,
          nomes: new Set((p.filhos || []).map((x) => x.name)),
          outros: (p.filhos || []).find((x) => ehPasta(x) && marca(x) === 'outros')?.id || null,
          md5s,
        });
      }
    }
    if (ehPasta(f) && marca(f) === 'outros-raiz') outrosRaiz = f.id;
  }

  const garantirOrgao = (nome) => {
    const k = slug(nome);
    if (!orgaos.has(k)) {
      const ref = novoRef('orgao');
      ops.push({ op: 'criar', ref, nome, pai: raiz.id, props: { agil: 'orgao', chave: k } });
      orgaos.set(k, { id: ref, nome });
    }
    return orgaos.get(k).id;
  };
  const garantirProcesso = (chave, t) => {
    if (!pastas.has(chave)) {
      const ref = novoRef('processo');
      const nome = nomePastaProcesso(t);
      ops.push({ op: 'criar', ref, nome, pai: garantirOrgao(t.orgao), props: { agil: 'processo', chave } });
      pastas.set(chave, { id: ref, nome, nomes: new Set(), outros: null, md5s: new Set() });
    }
    return pastas.get(chave);
  };
  const garantirOutros = (p) => {
    if (!p.outros) {
      p.outros = novoRef('outros');
      ops.push({ op: 'criar', ref: p.outros, nome: 'Outros', pai: p.id, props: { agil: 'outros' } });
    }
    return p.outros;
  };
  const garantirOutrosRaiz = () => {
    if (!outrosRaiz) {
      outrosRaiz = novoRef('outros-raiz');
      ops.push({ op: 'criar', ref: outrosRaiz, nome: 'Outros', pai: raiz.id, props: { agil: 'outros-raiz' } });
    }
    return outrosRaiz;
  };
  const nomeLivre = (p, base) => {
    let nome = base;
    for (let i = 2; p.nomes.has(nome); i++) nome = base.replace(/\.pdf$/i, ` (${i}).pdf`);
    p.nomes.add(nome);
    return nome;
  };

  /** Termo legível com órgão e número do processo */
  const termoDe = (no) => {
    const a = analises.get(no.id);
    if (!a || !TERMOS.has(a.tipo) || !a.termo) return null;
    if (!a.termo.processo || !a.termo.orgao) return { invalido: true, no, a };
    return { no, t: { ...a.termo, tipo: a.tipo }, chave: chaveProcesso(a.termo.orgao, a.termo.processo) };
  };

  const registrar = (chave, t, no, extra = {}) => {
    if (!processos.has(chave)) processos.set(chave, { chave, termos: [], atas: [], origens: new Set() });
    const p = processos.get(chave);
    p.termos.push({ id: no.id, nome: extra.nomeNovo || no.name, tipo: t.tipo, link: no.webViewLink, dados: t });
    if (extra.origem) p.origens.add(extra.origem);
  };
  const registrarAta = (chave, no) => {
    const a = analises.get(no.id);
    if (!a?.ata?.dataPregao) return;
    if (!processos.has(chave)) processos.set(chave, { chave, termos: [], atas: [], origens: new Set() });
    processos.get(chave).atas.push({ id: no.id, nome: no.name, link: no.webViewLink, ...a.ata });
  };

  /** Move (ou só renomeia) um termo para a pasta do seu processo. Devolve false se for cópia repetida. */
  const levarTermo = (x, pai, origem) => {
    const p = garantirProcesso(x.chave, x.t);
    if (x.no.md5Checksum && p.md5s.has(x.no.md5Checksum)) return false;
    if (x.no.md5Checksum) p.md5s.add(x.no.md5Checksum);
    const nome = nomeLivre(p, nomeTermo(x.t));
    ops.push({ op: 'mover', id: x.no.id, de: pai, para: p.id, nome, nomeAntes: x.no.name, props: { agil: 'termo', chave: x.chave, tipo: x.t.tipo } });
    registrar(x.chave, x.t, x.no, { nomeNovo: nome, origem });
    return true;
  };

  // ---------------------------------------------------------- unidades a examinar
  const unidades = [];
  for (const f of raiz.filhos || []) {
    if (marca(f) === 'dados' || f.name === NOME_DADOS) continue;
    if (ehPasta(f) && marca(f) === 'outros-raiz') continue;
    if (ehPasta(f) && marca(f) === 'orgao') {
      for (const p of f.filhos || []) {
        if (ehPasta(p) && marca(p) === 'processo') unidades.push({ tipo: 'processo', no: p, pai: f.id });
        else if (ehPasta(p) && !marca(p)) unidades.push({ tipo: 'pasta', no: p, pai: f.id });
        else if (!ehPasta(p) && !marca(p)) unidades.push({ tipo: 'solto', no: p, pai: f.id, naRaiz: false });
      }
      continue;
    }
    if (ehPasta(f)) unidades.push({ tipo: 'pasta', no: f, pai: raiz.id });
    else unidades.push({ tipo: 'solto', no: f, pai: raiz.id, naRaiz: true });
  }

  for (const u of unidades) {
    if (u.tipo === 'pasta') {
      const itens = [...descendentes(u.no)];
      const termos = [];
      const atas = [];
      let ilegiveis = 0;
      let arquivos = 0;
      for (const d of itens) {
        if (ehPasta(d.no)) continue;
        arquivos++;
        const a = analises.get(d.no.id);
        if (a?.tipo === 'ilegivel') ilegiveis++;
        if (a?.tipo === 'ata') atas.push(d.no);
        const x = termoDe(d.no);
        if (x?.invalido) avisos.push({ id: d.no.id, nome: d.no.name, link: d.no.webViewLink, motivo: `Termo em "${u.no.name}" sem órgão ou número de processo legível` });
        else if (x) termos.push({ ...x, pai: d.pai });
      }
      if (!termos.length) {
        pendencias.push({
          id: u.no.id,
          nome: u.no.name,
          link: u.no.webViewLink,
          motivo: 'Nenhum termo de homologação ou de adjudicação nesta pasta',
          arquivos,
          ilegiveis,
        });
        continue;
      }
      const contagem = new Map();
      for (const x of termos) contagem.set(x.chave, (contagem.get(x.chave) || 0) + 1);
      const principal = [...contagem].sort((a, b) => b[1] - a[1])[0][0];
      for (const x of termos) {
        if (!levarTermo(x, x.pai, u.no.name)) avisos.push({ id: x.no.id, nome: x.no.name, link: x.no.webViewLink, motivo: `Cópia repetida de um termo do processo; fica em Outros (${u.no.name})` });
      }
      for (const ata of atas) {
        const ap = analises.get(ata.id)?.ata?.processo;
        const alvo = ap ? [...contagem.keys()].find((k) => k.endsWith(`|${Number(ap.numero)}|${ap.ano}`)) : null;
        registrarAta(alvo || principal, ata);
      }
      const p = pastas.get(principal);
      if (p.outros) ops.push({ op: 'mover', id: u.no.id, de: u.pai, para: p.outros, nomeAntes: u.no.name });
      else {
        ops.push({ op: 'mover', id: u.no.id, de: u.pai, para: p.id, nome: 'Outros', nomeAntes: u.no.name, props: { agil: 'outros', origem: u.no.name.slice(0, 100) } });
        p.outros = u.no.id;
      }
      continue;
    }

    if (u.tipo === 'solto') {
      const x = termoDe(u.no);
      if (x && !x.invalido) {
        if (levarTermo(x, u.pai, 'arquivo solto')) continue;
        avisos.push({ id: u.no.id, nome: u.no.name, link: u.no.webViewLink, motivo: 'Cópia repetida de um termo já organizado' + (u.naRaiz ? '; vai para Outros' : '') });
      }
      if (x?.invalido) avisos.push({ id: u.no.id, nome: u.no.name, link: u.no.webViewLink, motivo: 'Termo sem órgão ou número de processo legível' });
      if (u.naRaiz) ops.push({ op: 'mover', id: u.no.id, de: u.pai, para: garantirOutrosRaiz(), nomeAntes: u.no.name });
      continue;
    }

    // processo já organizado: lê os termos e arruma o que foi acrescentado depois
    const chave = u.no.appProperties.chave;
    const p = pastas.get(chave);
    const ehOutros = (n) => ehPasta(n) && marca(n) === 'outros';
    for (const d of descendentes(u.no, ehOutros)) {
      if (marca(d.no) === 'termo') {
        const x = termoDe(d.no);
        if (x && !x.invalido) registrar(x.chave, x.t, d.no);
        continue;
      }
      if (ehPasta(d.no)) continue;
      const x = termoDe(d.no);
      if (x && !x.invalido && levarTermo(x, d.pai, u.no.name)) continue;
      if (analises.get(d.no.id)?.tipo === 'ata') registrarAta(chave, d.no);
      if (d.pai === u.no.id) ops.push({ op: 'mover', id: d.no.id, de: d.pai, para: garantirOutros(p), nomeAntes: d.no.name });
    }
    // subpastas novas (sem marca) dentro do processo vão para Outros, depois de tirar os termos
    for (const f of u.no.filhos || []) if (ehPasta(f) && !marca(f)) ops.push({ op: 'mover', id: f.id, de: u.no.id, para: garantirOutros(p), nomeAntes: f.name });
    const outros = (u.no.filhos || []).find(ehOutros);
    if (outros) for (const { no } of descendentes(outros)) if (analises.get(no.id)?.tipo === 'ata') registrarAta(chave, no);
  }

  return { processos: consolidar(processos, pastas), pendencias, avisos, ops };
}

const PRIORIDADE = (t) => (t.dados.itens?.length ? 0 : 2) + (t.tipo === 'homologacao' ? 0 : 1);

/** Junta os termos de cada processo e escolhe o que fornece os dados (homologação com itens, de preferência). */
function consolidar(processos, pastas) {
  const out = [];
  for (const p of processos.values()) {
    if (!p.termos.length) continue;
    const ordem = [...p.termos].sort((a, b) => PRIORIDADE(a) - PRIORIDADE(b));
    const base = ordem[0].dados;
    const comValor = ordem.find((t) => t.dados.valorAgil != null)?.dados;
    const pasta = pastas.get(p.chave);
    out.push({
      chave: p.chave,
      orgao: base.orgao,
      cnpjOrgao: ordem.map((t) => t.dados.cnpjOrgao).find(Boolean) || '',
      processo: base.processo,
      edital: base.edital,
      modalidade: base.modalidade,
      objeto: base.objeto,
      dataTermo: base.dataTermo,
      dataDocumento: base.dataDocumento,
      dataHomologacao: p.termos.find((t) => t.tipo === 'homologacao')?.dados.dataTermo || null,
      dataAdjudicacao: p.termos.find((t) => t.tipo === 'adjudicacao')?.dados.dataTermo || null,
      dataPregao: p.atas.map((a) => a.dataPregao).find(Boolean) || null,
      valorAgil: comValor?.valorAgil ?? null,
      estimadoAgil: comValor?.estimadoAgil ?? null,
      somaItens: base.somaItens,
      conferido: base.itens.length ? Math.abs((comValor?.valorAgil ?? base.somaItens) - base.somaItens) < 0.05 : null,
      agilVenceu: ordem.some((t) => t.dados.agilVenceu),
      termoUsado: ordem[0].tipo,
      itens: base.itens,
      termos: p.termos.map(({ id, nome, tipo, link }) => ({ id, nome, tipo, link })),
      pasta: pasta && !String(pasta.id).startsWith('novo:') ? { id: pasta.id, nome: pasta.nome, link: pasta.link } : null,
      origens: [...p.origens],
    });
  }
  return out.sort(
    (a, b) => a.orgao.localeCompare(b.orgao, 'pt-BR') || Number(b.processo.ano) - Number(a.processo.ano) || Number(b.processo.numero) - Number(a.processo.numero),
  );
}
