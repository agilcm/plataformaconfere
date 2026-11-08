// Painel eleitoral: comparar dois candidatos (por exemplo, um vereador e um prefeito) urna por urna e ver as conexões:
// se vão bem nos mesmos lugares, quantos redutos têm em comum, como um vai nos redutos do outro e quem é o
// eleitorado onde os dois são fortes. A ligação é entre urnas, não entre eleitores (o voto é secreto).
// Puro: sem tela, para testar.
import { indicadores, juntar, juntarFrases, leitura, perfisPorUrna, votosPorUrna } from './eleicaoUrnas.js';

/* ------------------------------------------------------------------ estatística */

/** Postos (1..n) com empate pela média: base da correlação de Spearman */
export function postos(v) {
  const ordem = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(v.length);
  for (let i = 0; i < ordem.length; ) {
    let j = i;
    while (j + 1 < ordem.length && ordem[j + 1][0] === ordem[i][0]) j++;
    const media = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[ordem[k][1]] = media;
    i = j + 1;
  }
  return r;
}

function pearson(x, y) {
  const n = x.length;
  if (n < 3) return null;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

/** Correlação de Spearman (pelos postos): resistente a urnas extremas e à fatia zero de candidatos pequenos */
export const spearman = (x, y) => pearson(postos(x), postos(y));

function lnGama(z) {
  const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const c of g) ser += c / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betaCf(a, b, x) {
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}

/** Beta incompleta regularizada I_x(a, b) */
function betaInc(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lnGama(a + b) - lnGama(a) - lnGama(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betaCf(a, b, x)) / a : 1 - (bt * betaCf(b, a, 1 - x)) / b;
}

/** p-valor bilateral de uma correlação r com n pares (t de Student com n - 2 graus de liberdade) */
export function pValorCorrelacao(r, n) {
  if (r == null || n < 4) return null;
  if (Math.abs(r) >= 1) return 0;
  const gl = n - 2;
  const t = Math.abs(r) * Math.sqrt(gl / (1 - r * r));
  return betaInc(gl / 2, 0.5, gl / (gl + t * t));
}

/** Intervalo de 95% de uma correlação (transformação z de Fisher) */
export function intervaloCorrelacao(r, n) {
  if (r == null || n < 5) return null;
  const z = Math.atanh(Math.max(-0.999999, Math.min(0.999999, r)));
  const ep = 1 / Math.sqrt(n - 3);
  return [Math.tanh(z - 1.96 * ep), Math.tanh(z + 1.96 * ep)];
}

const lnFat = (n) => lnGama(n + 1);
const lnComb = (n, k) => lnFat(n) - lnFat(k) - lnFat(n - k);

/**
 * Chance de, ao acaso, haver pelo menos `k` urnas em comum entre os `a` redutos de um e os `b` do outro,
 * num total de `N` urnas (hipergeométrica, cauda superior).
 */
export function pValorSobreposicao(k, N, a, b) {
  let p = 0;
  for (let x = k; x <= Math.min(a, b); x++) p += Math.exp(lnComb(a, x) + lnComb(N - a, b - x) - lnComb(N, b));
  return Math.min(1, p);
}

/** Chance de, ao acaso, haver no máximo `k` urnas em comum (cauda inferior: bases que se evitam) */
export function pValorSobreposicaoMenor(k, N, a, b) {
  let p = 0;
  for (let x = Math.max(0, a + b - N); x <= k; x++) p += Math.exp(lnComb(a, x) + lnComb(N - a, b - x) - lnComb(N, b));
  return Math.min(1, p);
}

/* ------------------------------------------------------------------ comparação */

export const QUADRANTES = [
  { id: 'ambos', rotulo: 'Os dois acima da média', cor: '#0478CA' },
  { id: 'soA', rotulo: 'Só o primeiro acima', cor: '#D97706' },
  { id: 'soB', rotulo: 'Só o segundo acima', cor: '#7C3AED' },
  { id: 'nenhum', rotulo: 'Os dois abaixo da média', cor: '#94A3B8' },
];

export const AVISO_COMPARACAO =
  'A ligação é entre urnas, não entre eleitores: mostra que os dois candidatos vão bem (ou mal) nos mesmos lugares, não que as mesmas pessoas votaram nos dois. ' +
  'O voto é secreto. Correlação de Spearman (pela ordem das urnas), com intervalo de 95% e p-valor; redutos = 25% das urnas com maior fatia dos votos válidos de cada um. ' +
  'Média = fatia do candidato no total da cidade.';

/** Ligação em palavras a partir da correlação e do p-valor */
export function ligacao(rho, p) {
  if (rho == null) return { id: 'sem', texto: 'sem dados suficientes', curto: 'Sem dados', sinal: 0 };
  if (p == null || p >= 0.05 || Math.abs(rho) < 0.1) return { id: 'nenhuma', texto: 'ausência de ligação clara', curto: 'Sem ligação clara', sinal: 0 };
  const a = Math.abs(rho);
  const forca = a >= 0.5 ? 'forte' : a >= 0.3 ? 'moderada' : 'fraca';
  return rho > 0
    ? { id: `positiva-${forca}`, texto: `uma ligação ${forca}`, curto: `Ligação ${forca}`, forca, sinal: 1 }
    : { id: `negativa-${forca}`, texto: `bases opostas (ligação negativa ${forca})`, curto: `Bases opostas (${forca})`, forca, sinal: -1 };
}

const pctTxt = (v, casas = 1) => (v == null ? '—' : `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`);
const dec = (v, casas = 2) => (v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }));
const pontos = (d) => {
  const v = Math.round(Math.abs(d) * 1000) / 10;
  const txt = v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return v === 0 ? 'igual' : `${d > 0 ? '+' : '−'}${txt} ${v >= 2 ? 'pontos' : 'ponto'}`;
};

/**
 * Compara dois candidatos da mesma cidade, urna por urna.
 * a e b: { ano, cargo, id } (id = cargo|número|nome de urna). Anos diferentes: entram só as urnas (zona e seção) que existem nos dois.
 */
export function compararCandidatos(dados, { cidade, a, b }) {
  const ta = votosPorUrna(dados, { cidade, ano: a.ano, cargo: a.cargo, ids: [a.id] });
  const tb = votosPorUrna(dados, { cidade, ano: b.ano, cargo: b.cargo, ids: [b.id] });
  const ca = ta.candidatos[0];
  const cb = tb.candidatos[0];
  if (!ca || !cb) return null;
  const mesmoAno = Number(a.ano) === Number(b.ano);
  // perfil do eleitorado: do ano do segundo candidato (o mais recente, quando os anos são diferentes)
  const anoPerfil = Math.max(Number(a.ano), Number(b.ano));
  const perfis = perfisPorUrna(dados, cidade, anoPerfil);
  const mapaB = new Map(tb.linhas.map((l) => [l.id, l]));
  const pares = [];
  for (const la of ta.linhas) {
    const lb = mapaB.get(la.id);
    if (!lb || !la.validos || !lb.validos) continue;
    const acc = perfis.get(la.id) || null;
    pares.push({
      id: la.id,
      zona: la.zona,
      secao: la.secao,
      local: (Number(b.ano) >= Number(a.ano) ? lb : la).local,
      localId: (Number(b.ano) >= Number(a.ano) ? lb : la).localId,
      votosA: la.cand[0].votos,
      validosA: la.validos,
      pA: la.cand[0].pct,
      votosB: lb.cand[0].votos,
      validosB: lb.validos,
      pB: lb.cand[0].pct,
      venceuA: la.cand[0].venceu,
      venceuB: lb.cand[0].venceu,
      acc,
      ind: acc ? indicadores(acc) : null,
    });
  }
  const N = pares.length;
  if (N < 3) return { ca, cb, mesmoAno, pares, N, insuficiente: true };

  // médias: fatia de cada um no conjunto de urnas comparadas
  const soma = (k) => pares.reduce((s, p) => s + p[k], 0);
  const mediaA = soma('votosA') / soma('validosA');
  const mediaB = soma('votosB') / soma('validosB');
  const xa = pares.map((p) => p.pA);
  const xb = pares.map((p) => p.pB);
  const rho = spearman(xa, xb);
  const r = pearson(xa, xb);
  const p = pValorCorrelacao(rho, N);
  const ic = intervaloCorrelacao(rho, N);
  const mx = xa.reduce((s, v) => s + v, 0) / N;
  const my = xb.reduce((s, v) => s + v, 0) / N;
  const sxx = xa.reduce((s, v) => s + (v - mx) ** 2, 0);
  const inclinacao = sxx ? xa.reduce((s, v, i) => s + (v - mx) * (xb[i] - my), 0) / sxx : 0;
  const tendencia = { a: my - inclinacao * mx, b: inclinacao };

  // redutos (25% urnas com maior fatia de cada um) e o que tem em comum
  const n = Math.max(1, Math.ceil(N / 4));
  const topo = (k, votos) =>
    new Set(
      [...pares]
        .filter((x) => x[votos] > 0)
        .sort((x, y) => y[k] - x[k])
        .slice(0, n)
        .map((x) => x.id),
    );
  const fortesA = topo('pA', 'votosA');
  const fortesB = topo('pB', 'votosB');
  const comuns = [...fortesA].filter((id) => fortesB.has(id));
  const esperado = (fortesA.size * fortesB.size) / N;
  const sobreposicao = {
    redutosA: fortesA.size,
    redutosB: fortesB.size,
    comuns: comuns.length,
    esperado,
    vezes: esperado ? comuns.length / esperado : 0,
    p: pValorSobreposicao(comuns.length, N, fortesA.size, fortesB.size),
    pMenor: pValorSobreposicaoMenor(comuns.length, N, fortesA.size, fortesB.size),
  };
  const fatia = (lista, votos, validos) => {
    const v = lista.reduce((s, x) => s + x[validos], 0);
    return v ? lista.reduce((s, x) => s + x[votos], 0) / v : 0;
  };
  const cruzado = {
    bNosRedutosDeA: fatia(
      pares.filter((x) => fortesA.has(x.id)),
      'votosB',
      'validosB',
    ),
    aNosRedutosDeB: fatia(
      pares.filter((x) => fortesB.has(x.id)),
      'votosA',
      'validosA',
    ),
  };

  // quadrantes: acima ou abaixo da própria média
  for (const x of pares) x.quadrante = x.pA >= mediaA ? (x.pB >= mediaB ? 'ambos' : 'soA') : x.pB >= mediaB ? 'soB' : 'nenhum';
  const comPerfil = pares.filter((x) => x.ind);
  const grupo = (lista) => {
    const votosA = lista.reduce((s, x) => s + x.votosA, 0);
    const votosB = lista.reduce((s, x) => s + x.votosB, 0);
    return {
      urnas: lista.length,
      votos: votosA,
      validos: lista.reduce((s, x) => s + x.validosA, 0),
      votosA,
      votosB,
      pctA: fatia(lista, 'votosA', 'validosA'),
      pctB: fatia(lista, 'votosB', 'validosB'),
      ind: indicadores(juntar(lista.map((x) => x.acc))),
    };
  };
  const todas = grupo(pares);
  const quadrantes = QUADRANTES.map((q) => {
    const lista = pares.filter((x) => x.quadrante === q.id);
    const g = grupo(lista);
    return { ...q, ...g, leitura: lista.length ? leitura(g, todas, comPerfil) : null };
  });

  // locais de votação
  const mapa = new Map();
  for (const x of pares) {
    const l = mapa.get(x.localId) || { local: x.local, urnas: 0, votosA: 0, validosA: 0, votosB: 0, validosB: 0 };
    l.urnas++;
    l.votosA += x.votosA;
    l.validosA += x.validosA;
    l.votosB += x.votosB;
    l.validosB += x.validosB;
    mapa.set(x.localId, l);
  }
  const locais = [...mapa.values()]
    .map((l) => {
      const pA = l.validosA ? l.votosA / l.validosA : 0;
      const pB = l.validosB ? l.votosB / l.validosB : 0;
      return {
        ...l,
        pA,
        pB,
        quadrante: pA >= mediaA ? (pB >= mediaB ? 'ambos' : 'soA') : pB >= mediaB ? 'soB' : 'nenhum',
        indice: pA / (mediaA || 1) + pB / (mediaB || 1),
      };
    })
    .sort((x, y) => y.indice - x.indice);

  const res = {
    cidade,
    ca,
    cb,
    a: { ...a, ano: Number(a.ano) },
    b: { ...b, ano: Number(b.ano) },
    mesmoAno,
    anoPerfil,
    mesmoPartido: ca.partido === cb.partido,
    mesmaPessoa: !!ca.pessoa && ca.pessoa === cb.pessoa,
    N,
    urnasA: ta.linhas.length,
    urnasB: tb.linhas.length,
    mediaA,
    mediaB,
    rho,
    r,
    p,
    ic,
    ligacao: ligacao(rho, p),
    tendencia,
    sobreposicao,
    cruzado,
    quadrantes,
    locais,
    pares: pares.map(({ acc, ...x }) => x),
    aviso: AVISO_COMPARACAO,
  };
  return { ...res, ...textoDaComparacao(res) };
}

const nomeDe = (c) => c.nome;
const quem = (c, x) => `${c.nome} (${x.cargo.toLowerCase()} ${x.ano})`;

/** Manchete e frases da comparação, em linguagem simples */
function textoDaComparacao(o) {
  const { ca, cb, a, b, ligacao: lig, sobreposicao: s, cruzado, quadrantes } = o;
  const A = nomeDe(ca);
  const B = nomeDe(cb);
  const manchete =
    lig.id === 'nenhuma'
      ? `${A} e ${B} não têm ligação clara nas urnas de ${o.cidade}: a votação de um não acompanha a do outro.`
      : lig.sinal > 0
        ? `${A} e ${B} têm ligação ${lig.forca} nas urnas de ${o.cidade}: onde um vai bem, o outro tende a ir bem também.`
        : `${A} e ${B} têm bases opostas em ${o.cidade}: onde um vai bem, o outro tende a ir mal.`;
  const frases = [];
  frases.push(
    `Comparação de ${quem(ca, a)} com ${quem(cb, b)} em ${o.N} urnas${o.mesmoAno ? '' : ` (as que existem nos dois anos, de ${o.urnasA} e ${o.urnasB})`}.${o.mesmoPartido ? ` Os dois são do ${ca.partido}.` : ''}${o.mesmaPessoa ? ' É a mesma pessoa no cadastro do TSE.' : ''}`,
  );
  const ic = o.ic ? ` (intervalo de 95%: ${dec(o.ic[0])} a ${dec(o.ic[1])})` : '';
  frases.push(
    `Correlação entre as fatias de votos nas urnas: ${dec(o.rho)}${ic}${o.p != null ? `, p ${o.p < 0.001 ? '< 0,001' : `= ${dec(o.p, 3)}`}` : ''}, o que indica ${lig.texto}.`,
  );
  frases.push(
    `${s.comuns ? `Das ${s.redutosA} urnas mais fortes de ${A}, ${s.comuns} também ${s.comuns === 1 ? 'está' : 'estão'}` : `Nenhuma das ${s.redutosA} urnas mais fortes de ${A} está`} entre as ${s.redutosB} mais fortes de ${B}. Se não houvesse ligação, seriam cerca de ${Math.round(s.esperado)}${
      s.p < 0.05
        ? `: ${dec(s.vezes, 1)} vezes o esperado, diferença que dificilmente é acaso`
        : s.pMenor < 0.05
          ? ': bem menos que o esperado, os redutos de um quase não coincidem com os do outro'
          : ', e a diferença pode ser acaso'
    }.`,
  );
  frases.push(
    `Nas urnas mais fortes de ${A}, ${B} teve ${pctTxt(cruzado.bNosRedutosDeA)} dos válidos, contra ${pctTxt(o.mediaB)} no total (${pontos(cruzado.bNosRedutosDeA - o.mediaB)}). ` +
      `Nas urnas mais fortes de ${B}, ${A} teve ${pctTxt(cruzado.aNosRedutosDeB)}, contra ${pctTxt(o.mediaA)} (${pontos(cruzado.aNosRedutosDeB - o.mediaA)}).`,
  );
  const q = Object.fromEntries(quadrantes.map((x) => [x.id, x]));
  frases.push(
    `Os dois ficaram acima da própria média em ${q.ambos.urnas} urnas; só ${A} em ${q.soA.urnas}; só ${B} em ${q.soB.urnas}; nenhum dos dois em ${q.nenhum.urnas}.`,
  );
  const l = q.ambos.leitura;
  if (l && q.ambos.urnas >= 3) {
    const adj = [l.idade, l.escolaridade].filter(Boolean);
    frases.push(
      adj.length
        ? `Onde os dois estão acima da média, o eleitorado é ${juntarFrases(adj)} que a média da cidade${l.genero ? `, com ${l.genero}` : ''}.`
        : 'Onde os dois estão acima da média, o eleitorado tem idade e escolaridade parecidas com as da cidade.',
    );
  }
  const juntos = o.locais.filter((x) => x.quadrante === 'ambos').slice(0, 4);
  if (juntos.length) frases.push(`Locais onde os dois vão acima da média: ${juntarFrases(juntos.map((x) => x.local))}.`);
  if (o.N < 30) frases.push(`Com ${o.N} urnas, só ligações fortes aparecem com segurança; leia os números com cautela.`);
  return { manchete, frases };
}

/** Nome do quadrante com os nomes dos candidatos */
export function rotuloQuadrante(id, o) {
  const A = o.ca.nome;
  const B = o.cb.nome;
  return { ambos: 'Os dois acima da média', soA: `Só ${A} acima`, soB: `Só ${B} acima`, nenhum: 'Os dois abaixo da média' }[id] || id;
}

/** Topo "redondo" do eixo, com folga, divisível em 4 marcas */
export function topoDoEixo(v) {
  const passos = [0.04, 0.08, 0.12, 0.16, 0.2, 0.24, 0.32, 0.4, 0.48, 0.6, 0.8, 1];
  return passos.find((x) => x >= v * 1.05) || 1;
}

/** Faixa do eixo ajustada aos dados (não precisa começar no zero), com 4 intervalos de passo "redondo" */
export function dominioEixo(valores) {
  const lo = Math.min(...valores);
  const hi = Math.max(...valores);
  const r = (v) => Math.round(v * 1e6) / 1e6;
  for (const p of [0.005, 0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25]) {
    const min = r(Math.max(0, Math.floor(r(lo / p)) * p));
    const max = r(min + 4 * p);
    if (max >= hi && max <= 1) return { min, max };
  }
  return { min: 0, max: 1 };
}

/** Pontos da linha de tendência que caem dentro do gráfico (para desenhar só o trecho visível) */
export function trechoTendencia(t, dx, dy) {
  const dentro = [];
  for (let i = 0; i <= 60; i++) {
    const x = dx.min + ((dx.max - dx.min) * i) / 60;
    const y = t.a + t.b * x;
    if (y >= dy.min && y <= dy.max) dentro.push([x, y]);
  }
  return dentro.length > 1 ? [dentro[0], dentro[dentro.length - 1]] : null;
}
