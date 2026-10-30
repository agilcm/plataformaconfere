// Painel eleitoral (/dados/eleicao/): cálculos sobre o recorte do TSE (scripts/eleicoes/gerar-dados.py).
// Dados: turnout (comparecimento por seção), votes (votos por seção, cargo e votável) e profile (perfil do eleitorado).
// Puro: sem tela, para testar.

export const ORDEM_CARGOS = ['Prefeito', 'Vereador', 'Presidente', 'Governador', 'Senador', 'Deputado Federal', 'Deputado Estadual'];
export const PROPORCIONAIS = new Set(['Vereador', 'Deputado Federal', 'Deputado Estadual']);

/** nominal (candidato), legenda (só o número do partido, cargos proporcionais), branco ou nulo */
export function tipoVoto(r) {
  if (r.party === '#NULO#' || /^(branco|nulo)$/i.test(r.candidateName)) return /^branco$/i.test(r.candidateName) ? 'branco' : 'nulo';
  if (PROPORCIONAIS.has(r.cargo) && String(r.candidateNumber).length === 2) return 'legenda';
  return 'nominal';
}

export const idCandidato = (r) => `${r.cargo}|${r.candidateNumber}|${r.candidateName}`;
export const idLocal = (r) => `${r.localCode}|${r.localName}`;
const idSecao = (r) => `${r.zone}|${r.section}`;

/** Nome curto do local: "ESCOLA MUNICIPAL ABÍLIO LINHARES" -> "Escola Municipal Abílio Linhares" */
export function nomeLocal(s) {
  return String(s || 'Local não informado')
    .toLowerCase()
    .replace(/(^|[\s(/-])([a-zà-ú])/g, (m, a, b) => a + b.toUpperCase())
    .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (m) => m.toLowerCase())
    .replace(/\bEe\b/g, 'EE')
    .replace(/\bEm\b/g, 'EM');
}

const ordemCargo = (c) => {
  const i = ORDEM_CARGOS.indexOf(c);
  return i < 0 ? 99 : i;
};

/** Aplica os filtros de cidade, ano, local e seção (o cargo é tratado em cada relatório) */
export function filtrar(dados, { cidade, ano, local = '', secao = '' }) {
  const ok = (r) => r.city === cidade && r.year === Number(ano) && (!local || idLocal(r) === local) && (!secao || idSecao(r) === secao);
  return {
    votos: dados.votes.filter(ok),
    secoes: dados.turnout.filter(ok),
    perfil: dados.profile.filter(ok),
  };
}

export const cargosDe = (votos) => [...new Set(votos.map((r) => r.cargo))].sort((a, b) => ordemCargo(a) - ordemCargo(b));

export function locaisDe(secoes) {
  const m = new Map();
  for (const r of secoes) {
    const id = idLocal(r);
    if (!m.has(id)) m.set(id, { id, nome: nomeLocal(r.localName), secoes: new Set() });
    m.get(id).secoes.add(idSecao(r));
  }
  return [...m.values()].map((l) => ({ ...l, secoes: [...l.secoes] })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
}

/**
 * Resultado de um cargo: candidatos em ordem de votos, com % dos votos válidos.
 * Válidos = nominais + legenda (a legenda só existe nos cargos proporcionais).
 */
export function resultadoCargo(votos, cargo) {
  const doCargo = votos.filter((r) => r.cargo === cargo);
  const cand = new Map();
  const legendas = new Map();
  let brancos = 0;
  let nulos = 0;
  for (const r of doCargo) {
    const t = tipoVoto(r);
    if (t === 'branco') brancos += r.votes;
    else if (t === 'nulo') nulos += r.votes;
    else if (t === 'legenda') legendas.set(r.party || r.candidateName, (legendas.get(r.party || r.candidateName) || 0) + r.votes);
    else {
      const id = idCandidato(r);
      if (!cand.has(id)) cand.set(id, { id, nome: r.candidateName, numero: r.candidateNumber, partido: r.party || 'Sem partido', votos: 0 });
      cand.get(id).votos += r.votes;
    }
  }
  const nominais = [...cand.values()].reduce((s, c) => s + c.votos, 0);
  const legenda = [...legendas.values()].reduce((s, v) => s + v, 0);
  const validos = nominais + legenda;
  const candidatos = [...cand.values()]
    .sort((a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((c, i) => ({ ...c, posicao: i + 1, pctValidos: validos ? c.votos / validos : 0 }));
  return {
    cargo,
    proporcional: PROPORCIONAIS.has(cargo),
    candidatos,
    legendas: [...legendas].map(([partido, votos]) => ({ partido, votos })).sort((a, b) => b.votos - a.votos),
    nominais,
    legenda,
    validos,
    brancos,
    nulos,
    total: validos + brancos + nulos,
  };
}

/** Votos por partido no cargo (candidatos + legenda) */
export function porPartido(resultado) {
  const m = new Map();
  for (const c of resultado.candidatos) {
    const p = m.get(c.partido) || { partido: c.partido, nominais: 0, legenda: 0, candidatos: 0 };
    p.nominais += c.votos;
    p.candidatos++;
    m.set(c.partido, p);
  }
  for (const l of resultado.legendas) {
    const p = m.get(l.partido) || { partido: l.partido, nominais: 0, legenda: 0, candidatos: 0 };
    p.legenda += l.votos;
    m.set(l.partido, p);
  }
  return [...m.values()]
    .map((p) => ({ ...p, total: p.nominais + p.legenda, pct: resultado.validos ? (p.nominais + p.legenda) / resultado.validos : 0 }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Votos de cada candidato do cargo em cada local (ou seção) e a % sobre os válidos do local.
 * @param {'local' | 'secao'} por
 */
export function matriz(votos, cargo, por = 'local') {
  const doCargo = votos.filter((r) => r.cargo === cargo);
  const colunas = new Map();
  const valores = new Map(); // candidato -> coluna -> votos
  const validosCol = new Map();
  const res = resultadoCargo(votos, cargo);
  for (const r of doCargo) {
    const t = tipoVoto(r);
    const col = por === 'local' ? idLocal(r) : `${idLocal(r)}#${idSecao(r)}`;
    if (!colunas.has(col)) colunas.set(col, { id: col, nome: nomeLocal(r.localName), zona: r.zone, secao: por === 'secao' ? r.section : '' });
    if (t === 'nominal' || t === 'legenda') validosCol.set(col, (validosCol.get(col) || 0) + r.votes);
    if (t !== 'nominal') continue;
    const id = idCandidato(r);
    if (!valores.has(id)) valores.set(id, new Map());
    const m = valores.get(id);
    m.set(col, (m.get(col) || 0) + r.votes);
  }
  const cols = [...colunas.values()].sort(
    (a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }) || Number(a.zona) - Number(b.zona) || Number(a.secao) - Number(b.secao),
  );
  const linhas = res.candidatos.map((c) => {
    const m = valores.get(c.id) || new Map();
    const votosCol = cols.map((k) => m.get(k.id) || 0);
    // onde o candidato é mais forte: maior % dos válidos do local (não só o maior número absoluto)
    let melhor = null;
    cols.forEach((k, i) => {
      const v = validosCol.get(k.id) || 0;
      const pct = v ? votosCol[i] / v : 0;
      if (votosCol[i] && (!melhor || pct > melhor.pct)) melhor = { coluna: k.nome + (k.secao ? ` · seção ${k.secao}` : ''), pct, votos: votosCol[i] };
    });
    return { ...c, votosCol, melhor };
  });
  return { colunas: cols, linhas, validosCol: cols.map((k) => validosCol.get(k.id) || 0), resultado: res };
}

/**
 * Seção agregada: no dia da eleição votou junto com outra seção (que já conta os eleitores dela).
 * Aparece no perfil do eleitorado, mas sem comparecimento nem abstenção: fica fora dos totais.
 */
export const ehAgregada = (r) => !(r.turnout || 0) && !(r.abstentions || 0);

/** Comparecimento somado por local ou seção (sem as seções agregadas) */
export function comparecimento(secoes, por = 'local') {
  const m = new Map();
  for (const r of secoes) {
    if (ehAgregada(r)) continue;
    const id = por === 'local' ? idLocal(r) : `${idLocal(r)}#${idSecao(r)}`;
    const g = m.get(id) || { id, local: nomeLocal(r.localName), zona: r.zone, secao: por === 'secao' ? r.section : '', secoes: 0, aptos: 0, comparecimento: 0, abstencoes: 0 };
    g.secoes++;
    g.aptos += r.aptos || 0;
    g.comparecimento += r.turnout || 0;
    g.abstencoes += r.abstentions || 0;
    m.set(id, g);
  }
  return [...m.values()]
    .map((g) => ({ ...g, pctComparecimento: g.aptos ? g.comparecimento / g.aptos : 0, pctAbstencao: g.aptos ? g.abstencoes / g.aptos : 0 }))
    .sort((a, b) => a.local.localeCompare(b.local, 'pt-BR', { numeric: true }) || Number(a.secao) - Number(b.secao));
}

export function totaisComparecimento(todas) {
  const secoes = todas.filter((r) => !ehAgregada(r));
  const t = secoes.reduce(
    (s, r) => ({ aptos: s.aptos + (r.aptos || 0), comparecimento: s.comparecimento + (r.turnout || 0), abstencoes: s.abstencoes + (r.abstentions || 0) }),
    { aptos: 0, comparecimento: 0, abstencoes: 0 },
  );
  const secs = new Set(secoes.map(idSecao)).size;
  const locais = new Set(secoes.map(idLocal)).size;
  return {
    ...t,
    secoes: secs,
    agregadas: todas.length - secoes.length,
    locais,
    pctComparecimento: t.aptos ? t.comparecimento / t.aptos : 0,
    pctAbstencao: t.aptos ? t.abstencoes / t.aptos : 0,
  };
}

/** Comparecimento da cidade em cada eleição (para ver a evolução) */
export function evolucao(dados, cidade) {
  const anos = [...new Set(dados.turnout.filter((r) => r.city === cidade).map((r) => r.year))].sort();
  return anos.map((ano) => ({ ano, ...totaisComparecimento(dados.turnout.filter((r) => r.city === cidade && r.year === ano)) }));
}

/** Perfil do eleitorado numa dimensão (faixa etária, escolaridade...) */
export function perfil(perfilRows, dimensao) {
  const m = new Map();
  for (const r of perfilRows) if (r.dimension === dimensao) m.set(r.category, (m.get(r.category) || 0) + r.count);
  const total = [...m.values()].reduce((s, v) => s + v, 0);
  return [...m]
    .map(([categoria, eleitores]) => ({ categoria, eleitores, pct: total ? eleitores / total : 0 }))
    .sort((a, b) => b.eleitores - a.eleitores);
}

export const dimensoesDe = (perfilRows) => [...new Set(perfilRows.map((r) => r.dimension))];

const sem = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Procura um candidato (nome ou número) em todas as eleições da cidade e devolve o histórico:
 * votos, posição, % dos válidos e os locais onde foi mais forte.
 */
export function historicoCandidato(dados, cidade, termo) {
  const t = sem(termo).trim();
  if (t.length < 2) return [];
  const daCidade = dados.votes.filter((r) => r.city === cidade && tipoVoto(r) === 'nominal');
  const achados = new Map();
  for (const r of daCidade) {
    if (!(sem(r.candidateName).includes(t) || r.candidateNumber === t)) continue;
    const k = `${r.year}|${idCandidato(r)}`;
    if (!achados.has(k)) achados.set(k, { ano: r.year, cargo: r.cargo, id: idCandidato(r), nome: r.candidateName, numero: r.candidateNumber, partido: r.party });
  }
  return [...achados.values()]
    .map((a) => {
      const votosAno = dados.votes.filter((r) => r.city === cidade && r.year === a.ano);
      const res = resultadoCargo(votosAno, a.cargo);
      const c = res.candidatos.find((x) => x.id === a.id);
      const mz = matriz(votosAno, a.cargo, 'local');
      const linha = mz.linhas.find((x) => x.id === a.id);
      const melhores = linha
        ? mz.colunas
            .map((col, i) => ({ local: col.nome, votos: linha.votosCol[i], pct: mz.validosCol[i] ? linha.votosCol[i] / mz.validosCol[i] : 0 }))
            .filter((x) => x.votos)
            .sort((x, y) => y.pct - x.pct)
            .slice(0, 3)
        : [];
      return { ...a, votos: c?.votos || 0, posicao: c?.posicao || null, de: res.candidatos.length, pctValidos: c?.pctValidos || 0, melhores };
    })
    .sort((x, y) => x.ano - y.ano || ordemCargo(x.cargo) - ordemCargo(y.cargo) || y.votos - x.votos);
}

/** Lê o arquivo de dados (JSON compactado em gzip) */
export async function carregarDados(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Não consegui abrir os dados (${r.status}).`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  // o servidor pode já ter descompactado; gzip começa com 1f 8b
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const fluxo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(fluxo).text());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
