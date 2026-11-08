// Painel eleitoral: votos por urna (seção eleitoral) de até 3 candidatos do mesmo cargo e eleição,
// e o perfil do eleitorado das urnas onde um candidato venceu ou foi mais forte ("Traçar perfil").
// O perfil é do eleitorado inscrito em cada urna (TSE): mostra tendência, não revela o voto de ninguém.
// Puro: sem tela, para testar.
import { candidaturasDaPessoa, ehAgregada, idCandidato, nomeLocal, resultadoCargo, tipoVoto } from './eleicao.js';

export const MAX_CANDIDATOS = 3;
/** Cores de identificação dos candidatos (validadas para daltonismo; o nome aparece sempre junto) */
export const CORES_CANDIDATOS = ['#0478CA', '#D97706', '#7C3AED'];
export const AVISO_PERFIL =
  'O perfil é do eleitorado inscrito em cada urna (TSE), não de quem votou no candidato: o voto é secreto. A leitura mostra tendência e não identifica ninguém. ' +
  'Idade média e anos de estudo são estimativas a partir das faixas do TSE. Diferenças pequenas, que poderiam aparecer por acaso entre urnas, contam como "na média". ' +
  'Seções agregadas (que votaram em outra urna do mesmo local) ficam fora do perfil.';

const chaveUrna = (r) => `${r.zone}|${r.section}`;
const ordemUrna = (a, b) => Number(a.zona) - Number(b.zona) || Number(a.secao) - Number(b.secao);
const semAcento = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();

/**
 * Votos de até 3 candidatos em cada urna da cidade, numa eleição e cargo.
 * Uma linha por urna que teve votação (as seções agregadas votaram junto com outra urna);
 * para cada candidato: votos, % dos votos válidos da urna, posição na urna e se foi o mais votado ali.
 * Com `comPerfil`, cada urna traz também os indicadores do eleitorado (`ind`: idade, escolaridade, gênero).
 * @param {any} dados
 * @param {{ cidade: string, ano: number, cargo: string, ids?: string[], comPerfil?: boolean }} opcoes ids = idCandidato (cargo|número|nome)
 */
export function votosPorUrna(dados, { cidade, ano, cargo, ids = [], comPerfil = false }) {
  const daEleicao = (r) => r.city === cidade && r.year === Number(ano);
  const votos = dados.votes.filter((r) => daEleicao(r) && r.cargo === cargo);
  const resultado = resultadoCargo(votos, cargo);
  const escolhidos = [...new Set(ids)]
    .map((id) => resultado.candidatos.find((c) => c.id === id))
    .filter(Boolean)
    .slice(0, MAX_CANDIDATOS);

  const urnas = new Map();
  const nova = (r) => ({
    id: chaveUrna(r),
    zona: String(r.zone),
    secao: String(r.section),
    localId: `${r.localCode}|${r.localName}`,
    local: nomeLocal(r.localName),
    aptos: 0,
    comparecimento: 0,
    validos: 0,
    brancos: 0,
    nulos: 0,
    porCand: new Map(),
  });
  for (const s of dados.turnout) {
    if (!daEleicao(s) || ehAgregada(s)) continue;
    const u = nova(s);
    u.aptos = s.aptos || 0;
    u.comparecimento = s.turnout || 0;
    urnas.set(u.id, u);
  }
  for (const r of votos) {
    const k = chaveUrna(r);
    if (!urnas.has(k)) urnas.set(k, nova(r));
    const u = urnas.get(k);
    const t = tipoVoto(r);
    if (t === 'branco') u.brancos += r.votes;
    else if (t === 'nulo') u.nulos += r.votes;
    else {
      u.validos += r.votes;
      if (t === 'nominal') {
        const id = idCandidato(r);
        u.porCand.set(id, (u.porCand.get(id) || 0) + r.votes);
      }
    }
  }
  // só entram urnas com votação no cargo (uma urna sem nenhum voto no cargo não existe na prática)
  const nomes = new Map(resultado.candidatos.map((c) => [c.id, c.nome]));
  const linhas = [...urnas.values()]
    .filter((u) => u.validos + u.brancos + u.nulos > 0)
    .sort(ordemUrna)
    .map(({ porCand, ...u }) => {
      const ranking = [...porCand].sort((a, b) => b[1] - a[1]);
      const topo = ranking[0]?.[1] || 0;
      const vencedores = ranking.filter(([, v]) => v === topo && v > 0).map(([id]) => nomes.get(id) || id.split('|')[2]);
      const cand = escolhidos.map((c) => {
        const v = porCand.get(c.id) || 0;
        return { votos: v, pct: u.validos ? v / u.validos : 0, posicao: v ? 1 + ranking.filter(([, x]) => x > v).length : null, venceu: v > 0 && v === topo };
      });
      return { ...u, maisVotado: vencedores.join(' / '), votosMaisVotado: topo, cand };
    });
  if (comPerfil) {
    const perfis = perfisPorUrna(dados, cidade, ano);
    for (const l of linhas) l.ind = perfis.has(l.id) ? indicadores(perfis.get(l.id)) : null;
  }

  const candidatos = escolhidos.map((c, i) => {
    const comVoto = linhas.filter((l) => l.cand[i].votos > 0);
    const melhor = [...comVoto].sort((a, b) => b.cand[i].pct - a.cand[i].pct || b.cand[i].votos - a.cand[i].votos)[0];
    // em quantas urnas saiu metade dos votos dele (concentração)
    let soma = 0;
    let metade = 0;
    for (const v of comVoto.map((l) => l.cand[i].votos).sort((a, b) => b - a)) {
      if (soma * 2 >= c.votos) break;
      soma += v;
      metade++;
    }
    return {
      ...c,
      cor: i,
      urnasComVoto: comVoto.length,
      urnasVencidas: linhas.filter((l) => l.cand[i].venceu).length,
      metadeDosVotosEm: metade,
      melhor: melhor ? { zona: melhor.zona, secao: melhor.secao, local: melhor.local, votos: melhor.cand[i].votos, pct: melhor.cand[i].pct } : null,
    };
  });
  const soma = (k) => linhas.reduce((s, l) => s + (l[k] || 0), 0);
  return {
    cidade,
    ano: Number(ano),
    cargo,
    resultado,
    candidatos,
    linhas,
    totais: {
      urnas: linhas.length,
      aptos: soma('aptos'),
      comparecimento: soma('comparecimento'),
      validos: soma('validos'),
      brancos: soma('brancos'),
      nulos: soma('nulos'),
    },
  };
}

/* ------------------------------------------------------------------ perfil do eleitorado de cada urna */

/** "21 a 24 anos" -> { de: 21, ate: 24, meio: 23 }; "100 anos ou mais" -> { de: 100, ate: 104 }; "Inválida" -> null */
export function faixaEtaria(categoria) {
  const m = /^(\d+)\s*(?:a\s*(\d+)\s*)?anos?(\s*ou\s*mais)?/i.exec(String(categoria || '').trim());
  if (!m) return null;
  const de = Number(m[1]);
  const ate = m[2] ? Number(m[2]) : m[3] ? de + 4 : de;
  return { de, ate, meio: (de + ate + 1) / 2 };
}

/** Anos de estudo aproximados de cada grau de escolaridade do TSE (para a escolaridade média estimada) */
export function anosDeEstudo(categoria) {
  const c = semAcento(categoria);
  if (c.includes('ANALFABETO')) return 0;
  if (c.includes('LE E ESCREVE')) return 1;
  if (c.includes('FUNDAMENTAL')) return c.includes('INCOMPLETO') ? 4.5 : 9;
  if (c.includes('MEDIO')) return c.includes('INCOMPLETO') ? 10.5 : 12;
  if (c.includes('SUPERIOR')) return c.includes('INCOMPLETO') ? 14 : 16;
  return null; // não informado
}

/** Grupo de escolaridade: e0 analfabeto/lê e escreve, e1 fundamental, e2 médio, e3 superior */
export function nivelEscolar(categoria) {
  const a = anosDeEstudo(categoria);
  if (a == null) return null;
  return a <= 1 ? 'e0' : a <= 9 ? 'e1' : a <= 12 ? 'e2' : 'e3';
}

const nivelIdade = (de) => (de < 30 ? 'i16' : de < 45 ? 'i30' : de < 60 ? 'i45' : 'i60');

/** Indicadores mostrados no perfil, na ordem da tabela */
export const INDICADORES = [
  { id: 'i16', rotulo: '16 a 29 anos', grupo: 'Idade', tipo: 'pct' },
  { id: 'i30', rotulo: '30 a 44 anos', grupo: 'Idade', tipo: 'pct' },
  { id: 'i45', rotulo: '45 a 59 anos', grupo: 'Idade', tipo: 'pct' },
  { id: 'i60', rotulo: '60 anos ou mais', grupo: 'Idade', tipo: 'pct' },
  { id: 'idadeMedia', rotulo: 'Idade média (estimada)', grupo: 'Idade', tipo: 'anos' },
  { id: 'e0', rotulo: 'Analfabeto ou só lê e escreve', grupo: 'Escolaridade', tipo: 'pct' },
  { id: 'e1', rotulo: 'Ensino fundamental', grupo: 'Escolaridade', tipo: 'pct' },
  { id: 'e2', rotulo: 'Ensino médio', grupo: 'Escolaridade', tipo: 'pct' },
  { id: 'e3', rotulo: 'Ensino superior', grupo: 'Escolaridade', tipo: 'pct' },
  { id: 'estudo', rotulo: 'Anos de estudo (estimados)', grupo: 'Escolaridade', tipo: 'anos' },
  { id: 'mulheres', rotulo: 'Mulheres', grupo: 'Gênero', tipo: 'pct' },
];

/** "Idade: 16 a 29 anos", "Idade média (estimada)" (sem repetir o tema), "Escolaridade: Ensino superior" */
export const rotuloCompleto = (d) => (semAcento(d.rotulo).startsWith(semAcento(d.grupo)) ? d.rotulo : `${d.grupo}: ${d.rotulo}`);

const acumulador = () => ({
  idade: { i16: 0, i30: 0, i45: 0, i60: 0 },
  nIdade: 0,
  somaIdade: 0,
  esc: { e0: 0, e1: 0, e2: 0, e3: 0 },
  nEsc: 0,
  somaEstudo: 0,
  mulheres: 0,
  nGenero: 0,
});

function acumular(a, r) {
  if (r.dimension === 'Faixa etária') {
    const f = faixaEtaria(r.category);
    if (!f) return;
    a.idade[nivelIdade(f.de)] += r.count;
    a.nIdade += r.count;
    a.somaIdade += f.meio * r.count;
  } else if (r.dimension === 'Escolaridade') {
    const anos = anosDeEstudo(r.category);
    if (anos == null) return;
    a.esc[nivelEscolar(r.category)] += r.count;
    a.nEsc += r.count;
    a.somaEstudo += anos * r.count;
  } else if (r.dimension === 'Gênero') {
    const g = semAcento(r.category);
    if (g !== 'FEMININO' && g !== 'MASCULINO') return;
    if (g === 'FEMININO') a.mulheres += r.count;
    a.nGenero += r.count;
  }
}

export function juntar(lista) {
  const t = acumulador();
  for (const a of lista) {
    if (!a) continue;
    for (const k of Object.keys(t.idade)) t.idade[k] += a.idade[k];
    for (const k of Object.keys(t.esc)) t.esc[k] += a.esc[k];
    for (const k of ['nIdade', 'somaIdade', 'nEsc', 'somaEstudo', 'mulheres', 'nGenero']) t[k] += a[k];
  }
  return t;
}

/** Percentuais e médias de um acumulador (null quando não há dado) */
export function indicadores(a) {
  const p = (v, n) => (n ? v / n : null);
  return {
    eleitores: Math.max(a.nIdade, a.nGenero, a.nEsc),
    i16: p(a.idade.i16, a.nIdade),
    i30: p(a.idade.i30, a.nIdade),
    i45: p(a.idade.i45, a.nIdade),
    i60: p(a.idade.i60, a.nIdade),
    idadeMedia: p(a.somaIdade, a.nIdade),
    e0: p(a.esc.e0, a.nEsc),
    e1: p(a.esc.e1, a.nEsc),
    e2: p(a.esc.e2, a.nEsc),
    e3: p(a.esc.e3, a.nEsc),
    estudo: p(a.somaEstudo, a.nEsc),
    mulheres: p(a.mulheres, a.nGenero),
  };
}

/** Perfil do eleitorado de cada urna da cidade numa eleição: Map "zona|seção" -> acumulador */
export function perfisPorUrna(dados, cidade, ano) {
  const m = new Map();
  for (const r of dados.profile) {
    if (r.city !== cidade || r.year !== Number(ano)) continue;
    const k = chaveUrna(r);
    if (!m.has(k)) m.set(k, acumulador());
    acumular(m.get(k), r);
  }
  return m;
}

/** Correlação de Pearson (null com menos de 5 pares ou sem variação) */
export function correlacao(xs, ys) {
  const pares = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  const n = pares.length;
  if (n < 5) return null;
  const mx = pares.reduce((s, [x]) => s + x, 0) / n;
  const my = pares.reduce((s, [, y]) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pares) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

export function forcaDaRelacao(r) {
  const a = Math.abs(r ?? 0);
  return a < 0.15 ? 'sem relação clara' : a < 0.3 ? 'relação fraca' : a < 0.5 ? 'relação moderada' : 'relação forte';
}

/**
 * Quanto um grupo de urnas se afasta da média da cidade.
 * z: a diferença comparada com o que se esperaria de urnas sorteadas ao acaso (desvio entre urnas / raiz de n, com correção
 * de população finita) — decide se a diferença conta (|z| < 1,3 = "na média").
 * d: a diferença em desvios-padrão entre urnas (tamanho do efeito) — decide a intensidade: até 0,35 "um pouco", até 0,7 normal, acima "bem".
 */
function desvio(valoresUrnas, valorGrupo, valorBase, n) {
  const v = valoresUrnas.filter(Number.isFinite);
  const N = v.length;
  if (!n || N < 4 || valorGrupo == null || valorBase == null) return { z: 0, d: 0 };
  const m = v.reduce((s, x) => s + x, 0) / N;
  const dp = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (N - 1));
  const ep = (dp / Math.sqrt(n)) * Math.sqrt(Math.max(0, (N - n) / (N - 1)));
  const dif = valorGrupo - valorBase;
  return { z: ep ? dif / ep : 0, d: dp ? dif / dp : 0 };
}

const conta = (x) => Math.abs(x.z) >= 1.3 && Math.abs(x.d) >= 0.15;
const intensidade = (d) => (Math.abs(d) < 0.35 ? 'um pouco ' : Math.abs(d) < 0.7 ? '' : 'bem ');
const adjetivo = (x, mais, menos) => (!conta(x) ? null : `${intensidade(x.d)}${x.d > 0 ? mais : menos}`);

/** Leitura em palavras de um grupo de urnas comparado à cidade (null = na média) */
export function leitura(g, base, porUrna) {
  const idade = desvio(
    porUrna.map((u) => u.ind?.idadeMedia),
    g.ind.idadeMedia,
    base.ind.idadeMedia,
    g.urnas,
  );
  const estudo = desvio(
    porUrna.map((u) => u.ind?.estudo),
    g.ind.estudo,
    base.ind.estudo,
    g.urnas,
  );
  const mulher = desvio(
    porUrna.map((u) => u.ind?.mulheres),
    g.ind.mulheres,
    base.ind.mulheres,
    g.urnas,
  );
  return {
    zIdade: idade.z,
    dIdade: idade.d,
    zEstudo: estudo.z,
    dEstudo: estudo.d,
    zMulher: mulher.z,
    idade: adjetivo(idade, 'mais velho', 'mais jovem'),
    escolaridade: adjetivo(estudo, 'mais escolarizado', 'menos escolarizado'),
    genero: Math.abs(mulher.z) < 2 || Math.abs(mulher.d) < 0.3 ? null : mulher.d > 0 ? 'mais mulheres' : 'mais homens',
  };
}

/** Selos curtos para a tela: "Eleitorado mais velho", "Menos escolarizado", "Mais mulheres" */
export function selosDaLeitura(l) {
  if (!l) return [];
  return [
    { id: 'idade', texto: l.idade ? `Eleitorado ${l.idade}` : 'Idade na média', destaque: !!l.idade },
    {
      id: 'escolaridade',
      texto: l.escolaridade ? l.escolaridade[0].toUpperCase() + l.escolaridade.slice(1) : 'Escolaridade na média',
      destaque: !!l.escolaridade,
    },
    ...(l.genero ? [{ id: 'genero', texto: l.genero[0].toUpperCase() + l.genero.slice(1), destaque: true }] : []),
  ];
}

/** "mais velho e menos escolarizado, com mais mulheres" (ou "parecido com a média da cidade") */
function descricao(l) {
  const adj = [l.idade, l.escolaridade].filter(Boolean);
  if (!adj.length) return l.genero ? `com idade e escolaridade na média da cidade, mas com ${l.genero}` : 'parecido com a média da cidade';
  return `${juntarFrases(adj)} que a média da cidade${l.genero ? `, com ${l.genero}` : ''}`;
}

/**
 * Traçar perfil: o eleitorado das urnas onde o candidato venceu (1º lugar na urna) e das 25% urnas em que ele teve
 * a maior fatia dos votos válidos, comparado com a média da cidade e com as 25% urnas mais fracas dele.
 * Traz também a relação (correlação) entre a votação dele e a idade e a escolaridade do eleitorado de todas as urnas,
 * os locais de votação onde ficam as urnas mais fortes e as 10 melhores urnas.
 */
export function perfilDoCandidato(dados, { cidade, ano, cargo, id }) {
  const t = votosPorUrna(dados, { cidade, ano, cargo, ids: [id] });
  const c = t.candidatos[0];
  if (!c) return null;
  const perfis = perfisPorUrna(dados, cidade, ano);
  const urnas = t.linhas
    .filter((l) => l.validos > 0)
    .map((l) => {
      const a = perfis.get(l.id) || null;
      return { ...l, votos: l.cand[0].votos, pct: l.cand[0].pct, posicao: l.cand[0].posicao, venceu: l.cand[0].venceu, acc: a, ind: a ? indicadores(a) : null };
    });
  const n = Math.max(1, Math.ceil(urnas.length / 4));
  const fortes = [...urnas]
    .filter((u) => u.votos > 0)
    .sort((a, b) => b.pct - a.pct || b.votos - a.votos)
    .slice(0, n);
  const fracas = [...urnas].sort((a, b) => a.pct - b.pct || a.votos - b.votos).slice(0, n);
  const venceu = urnas.filter((u) => u.venceu);

  const grupo = (lista) => {
    const votos = lista.reduce((s, u) => s + u.votos, 0);
    const validos = lista.reduce((s, u) => s + u.validos, 0);
    return { urnas: lista.length, votos, validos, pct: validos ? votos / validos : 0, ind: indicadores(juntar(lista.map((u) => u.acc))) };
  };
  const todas = grupo(urnas);
  const grupos = { venceu: grupo(venceu), fortes: grupo(fortes), fracas: grupo(fracas), todas };
  const leituras = {
    venceu: venceu.length ? leitura(grupos.venceu, todas, urnas) : null,
    fortes: fortes.length ? leitura(grupos.fortes, todas, urnas) : null,
  };

  const comPerfil = urnas.filter((u) => u.ind);
  const ys = comPerfil.map((u) => u.pct);
  const relacoes = [
    { id: 'idadeMedia', mais: 'mais velho o eleitorado', menos: 'mais jovem o eleitorado' },
    { id: 'i60', mais: 'mais eleitores com 60 anos ou mais', menos: 'menos eleitores com 60 anos ou mais' },
    { id: 'i16', mais: 'mais eleitores de 16 a 29 anos', menos: 'menos eleitores de 16 a 29 anos' },
    { id: 'estudo', mais: 'mais escolarizado o eleitorado', menos: 'menos escolarizado o eleitorado' },
    { id: 'e3', mais: 'mais eleitores com ensino superior', menos: 'menos eleitores com ensino superior' },
    { id: 'mulheres', mais: 'mais mulheres no eleitorado', menos: 'mais homens no eleitorado' },
  ].map((x) => {
    const r = correlacao(
      comPerfil.map((u) => u.ind[x.id]),
      ys,
    );
    return { ...x, rotulo: INDICADORES.find((i) => i.id === x.id).rotulo, r, forca: forcaDaRelacao(r) };
  });

  // locais de votação das urnas mais fortes (onde ele "ganha" no mapa da cidade)
  const urnasPorLocal = new Map();
  for (const u of urnas) urnasPorLocal.set(u.localId, (urnasPorLocal.get(u.localId) || 0) + 1);
  const locais = new Map();
  for (const u of fortes) {
    const l = locais.get(u.localId) || { local: u.local, urnas: 0, votos: 0, total: urnasPorLocal.get(u.localId) || 0 };
    l.urnas++;
    l.votos += u.votos;
    locais.set(u.localId, l);
  }

  const resumo = textoDoPerfil({ c, t, grupos, leituras, relacoes, n });
  return {
    candidato: c,
    cidade,
    ano: Number(ano),
    cargo,
    totalUrnas: urnas.length,
    quartil: n,
    grupos,
    leituras,
    relacoes,
    locais: [...locais.values()].sort((a, b) => b.votos - a.votos || b.urnas - a.urnas),
    melhores: fortes.slice(0, 10).map(({ acc, cand, ...u }) => u),
    idsFortes: fortes.map((u) => u.id),
    semPerfil: urnas.length - comPerfil.length,
    selos: selosDaLeitura(leituras.fortes),
    indicadores: INDICADORES,
    aviso: AVISO_PERFIL,
    ...resumo,
  };
}

const pctTxt = (v, casas = 1) => (v == null ? '—' : `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`);
const numTxt = (v, casas = 1) => (v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }));
const plural = (n, um, varios) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;

/** Manchete e frases do perfil, em linguagem simples (sem "ele/ela": o texto vale para qualquer candidatura) */
function textoDoPerfil({ c, t, grupos, leituras, relacoes, n }) {
  const f = grupos.fortes;
  const b = grupos.todas;
  const l = leituras.fortes;
  if (!l) return { manchete: `${c.nome} não teve votos nas urnas de ${t.cidade} em ${t.ano}.`, frases: [] };
  const adj = [l.idade, l.escolaridade].filter(Boolean);
  const manchete = adj.length
    ? `Onde ${c.nome} foi mais forte, o eleitorado é ${juntarFrases(adj)} que a média de ${t.cidade}${l.genero ? `, com ${l.genero}` : ''}.`
    : l.genero
      ? `Onde ${c.nome} foi mais forte, o eleitorado tem idade e escolaridade na média de ${t.cidade}, mas com ${l.genero}.`
      : `Onde ${c.nome} foi mais forte, o eleitorado tem idade e escolaridade parecidas com a média de ${t.cidade}: a votação não acompanha esse perfil.`;

  const total = t.linhas.length;
  const frases = [
    `${c.nome} teve ${plural(c.votos, 'voto', 'votos')} (${pctTxt(c.pctValidos)} dos válidos, ${c.posicao}º lugar), com voto em ${c.urnasComVoto} de ${total} urnas. Metade dos votos saiu de ${plural(c.metadeDosVotosEm, 'urna', 'urnas')}.`,
  ];
  const v = grupos.venceu.urnas;
  if (!v) frases.push('Não ficou em 1º lugar em nenhuma urna; por isso o perfil usa as urnas em que teve a maior fatia dos votos.');
  else if (v >= total * 0.75)
    frases.push(`Ficou em 1º lugar em ${v} de ${total} urnas, quase a cidade inteira; por isso o perfil compara as urnas mais fortes com as mais fracas.`);
  else frases.push(`Ficou em 1º lugar em ${plural(v, 'urna', 'urnas')}. Nelas, o eleitorado é ${descricao(leituras.venceu)}.`);
  frases.push(
    `Força: nas ${plural(f.urnas, 'urna mais forte', 'urnas mais fortes')} (25% das urnas) teve ${pctTxt(f.pct)} dos válidos; nas mais fracas, ${pctTxt(grupos.fracas.pct)}.`,
  );
  frases.push(
    `Idade: nas urnas mais fortes, ${pctTxt(f.ind.i60)} dos eleitores têm 60 anos ou mais (cidade: ${pctTxt(b.ind.i60)}) e ${pctTxt(f.ind.i16)} têm de 16 a 29 anos (cidade: ${pctTxt(b.ind.i16)}); idade média de ${numTxt(f.ind.idadeMedia)} anos (cidade: ${numTxt(b.ind.idadeMedia)}).`,
  );
  frases.push(
    `Escolaridade: ${pctTxt(f.ind.e3)} com ensino superior (cidade: ${pctTxt(b.ind.e3)}) e ${pctTxt(soma2(f.ind.e0, f.ind.e1))} só até o fundamental (cidade: ${pctTxt(soma2(b.ind.e0, b.ind.e1))}).`,
  );
  const claras = relacoes.filter((r) => r.r != null && Math.abs(r.r) >= 0.3 && ['idadeMedia', 'estudo', 'mulheres'].includes(r.id));
  if (claras.length)
    for (const r of claras) frases.push(`Em todas as urnas: quanto ${r.r > 0 ? r.mais : r.menos}, maior a votação (${r.forca}, r = ${numTxt(r.r, 2)}).`);
  else frases.push('Em todas as urnas, a votação tem pouca relação com a idade e a escolaridade do eleitorado (correlações fracas).');
  if (n < 3) frases.push('Poucas urnas na cidade: leia o perfil com cautela.');
  return { manchete, frases };
}

const soma2 = (a, b) => (a == null && b == null ? null : (a || 0) + (b || 0));

export function juntarFrases(lista) {
  if (lista.length <= 1) return lista.join('');
  return `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`;
}

/* ------------------------------------------------------------------ trajetória: a mesma pessoa em outras eleições */

/** Indicadores usados para comparar os redutos de uma eleição para outra (diferença para a média da cidade no ano) */
export const INDICADORES_TRAJETORIA = ['i16', 'i60', 'idadeMedia', 'e3', 'ateFund', 'estudo', 'mulheres'];
const ROTULO_TRAJETORIA = {
  i16: '16 a 29 anos',
  i60: '60 anos ou mais',
  idadeMedia: 'Idade média',
  e3: 'Ensino superior',
  ateFund: 'Só até o fundamental',
  estudo: 'Anos de estudo',
  mulheres: 'Mulheres',
};
const valorInd = (ind, id) => (id === 'ateFund' ? (ind?.e0 == null && ind?.e1 == null ? null : (ind.e0 || 0) + (ind.e1 || 0)) : (ind?.[id] ?? null));

/** Votos do candidato por local de votação: votos, válidos do local e % */
function porLocal(t) {
  const m = new Map();
  for (const l of t.linhas) {
    const x = m.get(l.localId) || { localId: l.localId, codigo: l.localId.split('|')[0], local: l.local, votos: 0, validos: 0 };
    x.votos += l.cand[0]?.votos || 0;
    x.validos += l.validos;
    m.set(l.localId, x);
  }
  return [...m.values()].map((x) => ({ ...x, pct: x.validos ? x.votos / x.validos : 0 }));
}

/**
 * Todas as eleições da mesma pessoa na cidade (pelo cadastro do TSE: o nome de urna, o partido e o cargo podem mudar),
 * com o perfil de cada uma e os comparativos: votos, redutos (diferença para a média da cidade em cada ano) e locais.
 * Devolve null quando o candidato não tem cadastro.
 */
export function trajetoria(dados, { cidade, ano, cargo, id }) {
  const atual = votosPorUrna(dados, { cidade, ano, cargo, ids: [id] }).candidatos[0];
  if (!atual?.pessoa) return null;
  const candidaturas = candidaturasDaPessoa(dados, cidade, atual.pessoa).map((c) => {
    const t = votosPorUrna(dados, { cidade, ano: c.ano, cargo: c.cargo, ids: [c.id] });
    const cand = t.candidatos[0];
    const perfil = perfilDoCandidato(dados, { cidade, ano: c.ano, cargo: c.cargo, id: c.id });
    return {
      ano: c.ano,
      cargo: c.cargo,
      id: c.id,
      atual: c.ano === Number(ano) && c.id === id,
      nome: cand.nome,
      numero: cand.numero,
      partido: cand.partido,
      situacao: cand.situacao,
      votos: cand.votos,
      pctValidos: cand.pctValidos,
      posicao: cand.posicao,
      concorrentes: t.resultado.candidatos.length,
      urnas: t.totais.urnas,
      urnasComVoto: cand.urnasComVoto,
      urnasVencidas: cand.urnasVencidas,
      metadeDosVotosEm: cand.metadeDosVotosEm,
      perfil,
      locais: porLocal(t),
    };
  });
  const nomeCivil = atual.nomeCivil || atual.nome;
  if (candidaturas.length < 2) return { nomeCivil, pessoa: atual.pessoa, candidaturas, comparacao: [], locais: [], frases: [] };

  // redutos: valor nas urnas mais fortes e diferença para a cidade no mesmo ano
  const comparacao = INDICADORES_TRAJETORIA.map((ind) => ({
    id: ind,
    rotulo: ROTULO_TRAJETORIA[ind],
    tipo: ['idadeMedia', 'estudo'].includes(ind) ? 'anos' : 'pct',
    valores: candidaturas.map((c) => {
      const g = c.perfil?.grupos;
      const v = valorInd(g?.fortes.ind, ind);
      const b = valorInd(g?.todas.ind, ind);
      return { valor: v, cidade: b, dif: v == null || b == null ? null : v - b };
    }),
  }));

  // locais: % dos válidos do local em cada eleição (os códigos de local se repetem entre os anos)
  const mapa = new Map();
  candidaturas.forEach((c, i) => {
    for (const l of c.locais) {
      const x = mapa.get(l.codigo) || { codigo: l.codigo, local: l.local, por: candidaturas.map(() => null) };
      x.por[i] = { votos: l.votos, pct: l.pct };
      x.local = l.local;
      mapa.set(l.codigo, x);
    }
  });
  const locais = [...mapa.values()].map((x) => ({ ...x, melhor: Math.max(...x.por.map((p) => p?.pct || 0)) })).sort((a, b) => b.melhor - a.melhor);

  return { nomeCivil, pessoa: atual.pessoa, candidaturas, comparacao, locais, frases: frasesDaTrajetoria(nomeCivil, candidaturas, comparacao, cidade) };
}

const pontos = (d) =>
  `${d > 0 ? '+' : '−'}${Math.abs(d * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ponto${Math.abs(d * 100) >= 2 ? 's' : ''}`;

/** Comparativo em frases curtas: votos, redutos e locais que se repetem */
function frasesDaTrajetoria(nome, cs, comparacao, cidade) {
  const frases = [];
  const lista = cs.map((c) => `${c.ano} (${c.cargo.toLowerCase()}, como ${c.nome}, ${c.partido})`);
  frases.push(`${nome} teve voto em ${cidade} em ${cs.length} eleições: ${juntarFrases(lista)}.`);
  for (let i = 1; i < cs.length; i++) {
    const a = cs[i - 1];
    const b = cs[i];
    const dif = b.votos - a.votos;
    const mesmo = a.cargo === b.cargo;
    frases.push(
      `De ${a.ano} para ${b.ano}${mesmo ? '' : ` (de ${a.cargo.toLowerCase()} para ${b.cargo.toLowerCase()})`}: ${dif >= 0 ? 'subiu' : 'caiu'} de ${plural(a.votos, 'voto', 'votos')} para ${b.votos.toLocaleString('pt-BR')} (${dif >= 0 ? '+' : '−'}${Math.abs(dif).toLocaleString('pt-BR')}), e de ${pctTxt(a.pctValidos)} para ${pctTxt(b.pctValidos)} dos válidos${b.situacao ? `; ${minusculaInicial(b.situacao)} em ${b.ano}` : ''}.`,
    );
  }
  // perfil dos redutos: a leitura de cada eleição
  const leituras = cs.map((c) => c.perfil?.leituras?.fortes).filter(Boolean);
  if (leituras.length === cs.length) {
    const idades = new Set(leituras.map((l) => (l.idade ? (l.idade.includes('velho') ? 'velho' : 'jovem') : 'media')));
    const estudos = new Set(leituras.map((l) => (l.escolaridade ? (l.escolaridade.includes('mais') ? 'mais' : 'menos') : 'media')));
    const descr = cs.map((c) => `${c.ano}: ${descricaoCurta(c.perfil.leituras.fortes)}`).join('; ');
    if (idades.size === 1 && estudos.size === 1) frases.push(`O perfil dos redutos se manteve nas ${cs.length} eleições (${descr}).`);
    else frases.push(`O perfil dos redutos mudou de uma eleição para outra (${descr}).`);
  }
  const i60 = comparacao.find((x) => x.id === 'i60');
  const sup = comparacao.find((x) => x.id === 'e3');
  const prim = 0;
  const ult = cs.length - 1;
  if (i60?.valores[prim].dif != null && i60.valores[ult].dif != null)
    frases.push(
      `Eleitores com 60 anos ou mais nos redutos, em relação à média da cidade: ${pontos(i60.valores[prim].dif)} em ${cs[prim].ano} e ${pontos(i60.valores[ult].dif)} em ${cs[ult].ano}. Ensino superior: ${pontos(sup.valores[prim].dif)} e ${pontos(sup.valores[ult].dif)}.`,
    );
  // locais que se repetem entre os melhores (os 3 melhores; em cidade com poucos locais, só o melhor)
  const k = Math.max(1, Math.min(3, Math.floor(Math.min(...cs.map((c) => c.locais.length)) / 2)));
  const top = cs.map(
    (c) =>
      new Set(
        [...c.locais]
          .sort((a, b) => b.pct - a.pct)
          .slice(0, k)
          .map((l) => l.codigo),
      ),
  );
  const repetidos = [...top[0]].filter((k) => top.every((s) => s.has(k)));
  if (repetidos.length) {
    const nomes = repetidos.map((k) => cs[ult].locais.find((l) => l.codigo === k)?.local || cs[0].locais.find((l) => l.codigo === k)?.local).filter(Boolean);
    frases.push(
      k === 1
        ? `${nomes[0]} foi o local mais forte em todas as eleições.`
        : `${juntarFrases(nomes)} ${nomes.length === 1 ? 'ficou' : 'ficaram'} entre os ${k} locais mais fortes em todas as eleições.`,
    );
  } else frases.push(k === 1 ? 'O local mais forte mudou de uma eleição para outra.' : `Os ${k} locais mais fortes mudaram de uma eleição para outra.`);
  return frases;
}

const minusculaInicial = (t) => t.charAt(0).toLowerCase() + t.slice(1);

function descricaoCurta(l) {
  const adj = [l.idade, l.escolaridade].filter(Boolean);
  return adj.length ? `${juntarFrases(adj)}${l.genero ? `, com ${l.genero}` : ''}` : 'na média da cidade';
}
