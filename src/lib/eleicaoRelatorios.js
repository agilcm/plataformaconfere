// Relatórios do painel eleitoral: abas do Excel e blocos do PDF (layout Ágil CM, pdfReport.ts).
import { cargosDe, comparecimento, dimensoesDe, matriz, nomeLocal, perfil, porPartido, resultadoCargo, tipoVoto, totaisComparecimento } from './eleicao.js';
import { rotuloCompleto } from './eleicaoUrnas.js';
import { QUADRANTES, dominioEixo, rotuloQuadrante } from './eleicaoComparar.js';

const pct = (v) => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const num = (v) => Number(v || 0).toLocaleString('pt-BR');
const nomeAba = (s) => s.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31);
/** Nome civil do cadastro do TSE (ou o nome de urna, quando não há cadastro) */
const civil = (c) => c.nomeCivil || c.nome;
/** Só a primeira letra em minúscula ("Eleito por QP" -> "eleito por QP") */
const minuscula1 = (t) => (t ? t.charAt(0).toLowerCase() + t.slice(1) : t);
/** Ordem alfabética pelo nome do candidato (nome civil) */
export const porNomeCivil = (a, b) => civil(a).localeCompare(civil(b), 'pt-BR') || a.nome.localeCompare(b.nome, 'pt-BR');
const situacaoCurta = (c) => (/^eleito/i.test(c.situacao || '') ? 'eleito' : /^suplente/i.test(c.situacao || '') ? 'suplente' : '');

/**
 * Excel completo de uma cidade e eleição (com os filtros de local/seção já aplicados em `f`).
 * Abas: Resumo, Resultado de cada cargo, Locais × candidatos e Seções × candidatos de cada cargo, Comparecimento e Perfil.
 */
export function abasExcelCompleto(f, { cidade, ano, filtrosTexto = '' }) {
  const abas = [];
  const cargos = cargosDe(f.votos);
  const t = totaisComparecimento(f.secoes);
  const resumo = [
    ['Município', cidade],
    ['Eleição', `${ano} (1º turno)`],
    ...(filtrosTexto ? [['Filtros', filtrosTexto]] : []),
    ['Locais de votação', t.locais],
    ['Seções com votação', t.secoes],
    ['Seções agregadas (votaram junto com outra)', t.agregadas],
    ['Eleitores aptos', t.aptos],
    ['Comparecimento', t.comparecimento],
    ['Comparecimento (%)', pct(t.pctComparecimento)],
    ['Abstenções', t.abstencoes],
    ['Abstenção (%)', pct(t.pctAbstencao)],
  ];
  for (const c of cargos) {
    const r = resultadoCargo(f.votos, c);
    resumo.push([`${c}: votos válidos`, r.validos], [`${c}: brancos`, r.brancos], [`${c}: nulos`, r.nulos]);
    if (r.candidatos[0]) resumo.push([`${c}: mais votado`, `${r.candidatos[0].nome} (${r.candidatos[0].partido}) · ${num(r.candidatos[0].votos)} votos · ${pct(r.candidatos[0].pctValidos)}`]);
  }
  abas.push({ nome: 'Resumo', colunas: [{ titulo: 'Item', largura: 44 }, { titulo: 'Valor', largura: 60 }], linhas: resumo });

  for (const c of cargos) {
    const r = resultadoCargo(f.votos, c);
    const linhas = r.candidatos.map((x) => [x.posicao, civil(x), x.nome, x.numero, x.partido, x.situacao, x.votos, Math.round(x.pctValidos * 10000) / 100]);
    for (const l of r.legendas)
      linhas.push(['', `Voto de legenda: ${l.partido}`, '', '', l.partido, '', l.votos, Math.round((r.validos ? l.votos / r.validos : 0) * 10000) / 100]);
    linhas.push(['', 'Brancos', '', '', '', '', r.brancos, null], ['', 'Nulos', '', '', '', '', r.nulos, null]);
    abas.push({
      nome: nomeAba(`${c} - resultado`),
      colunas: [
        { titulo: 'Posição', largura: 9, tipo: 'numero' },
        { titulo: 'Nome do candidato', largura: 40 },
        { titulo: 'Nome de urna', largura: 28 },
        { titulo: 'Número', largura: 9 },
        { titulo: 'Partido', largura: 14 },
        { titulo: 'Situação', largura: 16 },
        { titulo: 'Votos', largura: 12, tipo: 'numero' },
        { titulo: '% dos válidos', largura: 13, tipo: 'numero' },
      ],
      linhas,
    });
    if (r.proporcional) {
      abas.push({
        nome: nomeAba(`${c} - partidos`),
        colunas: [
          { titulo: 'Partido', largura: 14 },
          { titulo: 'Candidatos', largura: 11, tipo: 'numero' },
          { titulo: 'Votos nominais', largura: 15, tipo: 'numero' },
          { titulo: 'Votos de legenda', largura: 15, tipo: 'numero' },
          { titulo: 'Total', largura: 12, tipo: 'numero' },
          { titulo: '% dos válidos', largura: 13, tipo: 'numero' },
        ],
        linhas: porPartido(r).map((p) => [p.partido, p.candidatos, p.nominais, p.legenda, p.total, Math.round(p.pct * 10000) / 100]),
      });
    }
    for (const por of ['local', 'secao']) {
      const m = matriz(f.votos, c, por);
      const cab = m.colunas.map((k) => (por === 'local' ? k.nome : `${k.nome} · Z${k.zona} S${k.secao}`));
      abas.push({
        nome: nomeAba(`${c} - por ${por === 'local' ? 'local' : 'seção'}`),
        colunas: [
          { titulo: 'Nome do candidato', largura: 36 },
          { titulo: 'Nome de urna', largura: 26 },
          { titulo: 'Número', largura: 8 },
          { titulo: 'Partido', largura: 12 },
          ...cab.map((titulo) => ({ titulo, largura: 14, tipo: 'numero' })),
          { titulo: 'Total', largura: 11, tipo: 'numero' },
        ],
        linhas: [
          ...[...m.linhas].sort(porNomeCivil).map((l) => [civil(l), l.nome, l.numero, l.partido, ...l.votosCol, l.votos]),
          ['Votos válidos no local', '', '', '', ...m.validosCol, m.resultado.validos],
        ],
      });
    }
  }

  abas.push({
    nome: 'Comparecimento por seção',
    colunas: [
      { titulo: 'Local de votação', largura: 40 },
      { titulo: 'Zona', largura: 7 },
      { titulo: 'Seção', largura: 7 },
      { titulo: 'Aptos', largura: 10, tipo: 'numero' },
      { titulo: 'Comparecimento', largura: 15, tipo: 'numero' },
      { titulo: 'Abstenções', largura: 12, tipo: 'numero' },
      { titulo: 'Comparecimento (%)', largura: 18, tipo: 'numero' },
    ],
    linhas: comparecimento(f.secoes, 'secao').map((s) => [s.local, s.zona, s.secao, s.aptos, s.comparecimento, s.abstencoes, Math.round(s.pctComparecimento * 10000) / 100]),
  });

  const linhasPerfil = [];
  for (const d of dimensoesDe(f.perfil)) for (const p of perfil(f.perfil, d)) linhasPerfil.push([d, p.categoria, p.eleitores, Math.round(p.pct * 10000) / 100]);
  abas.push({
    nome: 'Perfil do eleitorado',
    colunas: [
      { titulo: 'Dimensão', largura: 24 },
      { titulo: 'Categoria', largura: 36 },
      { titulo: 'Eleitores', largura: 12, tipo: 'numero' },
      { titulo: '%', largura: 9, tipo: 'numero' },
    ],
    linhas: linhasPerfil,
  });
  return abas;
}

/**
 * Excel dos candidatos escolhidos, com as seções nas colunas (uma aba por eleição e cargo).
 * @param {{ ano: number, cargo: string, id: string }[]} selecionados
 */
export function abasCandidatosPorSecao(dados, cidade, selecionados) {
  const grupos = new Map();
  for (const s of selecionados) {
    const k = `${s.ano}|${s.cargo}`;
    if (!grupos.has(k)) grupos.set(k, { ano: s.ano, cargo: s.cargo, ids: new Set() });
    grupos.get(k).ids.add(s.id);
  }
  return [...grupos.values()]
    .sort((a, b) => a.ano - b.ano)
    .map((g) => {
      const votos = dados.votes.filter((r) => r.city === cidade && r.year === g.ano);
      const m = matriz(votos, g.cargo, 'secao');
      const linhas = m.linhas.filter((l) => g.ids.has(l.id));
      return {
        nome: nomeAba(`${g.ano} ${g.cargo}`),
        colunas: [
          { titulo: 'Nome do candidato', largura: 36 },
          { titulo: 'Nome de urna', largura: 26 },
          { titulo: 'Número', largura: 8 },
          { titulo: 'Partido', largura: 12 },
          ...m.colunas.map((k) => ({ titulo: `${k.nome} · Z${k.zona} S${k.secao}`, largura: 14, tipo: 'numero' })),
          { titulo: 'Total', largura: 11, tipo: 'numero' },
        ],
        linhas: [...linhas].sort(porNomeCivil).map((l) => [civil(l), l.nome, l.numero, l.partido, ...l.votosCol, l.votos]),
      };
    });
}

/** Nome curto do local para cabeçalho de coluna: "ESCOLA ESTADUAL PROFESSOR SOUZA PRIMO" -> "EE Prof. Souza Primo" */
export function localCurto(nome) {
  return nomeLocal(
    String(nome || '')
      .replace(/^\s*ESCOLA\s+ESTADUAL\s*[-–:]?\s*/i, 'EE ')
      .replace(/^\s*ESCOLA\s+MUNICIPAL\s*[-–:]?\s*/i, 'EM ')
      .replace(/\bCENTRO MUNICIPAL DE EDUCAÇÃO INFANTIL\b/gi, 'CMEI')
      .replace(/\bCENTRO DE REFERÊNCIA (DE )?ASSISTÊNCIA SOCIAL\b/gi, '')
      .replace(/\bPROFESSORA\b/gi, 'Profa.')
      .replace(/\bPROFESSOR\b/gi, 'Prof.')
      .replace(/\bDOUTORA\b/gi, 'Dra.')
      .replace(/\bDOUTOR\b/gi, 'Dr.')
      .replace(/\s*-\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim(),
  )
    .replace(/^Ee /, 'EE ')
    .replace(/^Em /, 'EM ')
    .replace(/^Cras\b/, 'CRAS');
}

/**
 * PDF de uma cidade e eleição no modelo "resultado por local de votação" (página deitada):
 * um cargo por página (quebra de página a cada cargo), candidatos em ordem alfabética, a coluna do número,
 * os locais de votação nas colunas e o total. Cargos com muitos candidatos seguem em várias páginas.
 * Com mais de `locaisPorPagina` locais, as colunas se dividem em blocos.
 */
export function blocosPdf(f, { cidade, ano, dataText, filtrosTexto = '', locaisPorPagina = 10 }) {
  const t = totaisComparecimento(f.secoes);
  const b = [
    { type: 'date', text: dataText },
    { type: 'title', text: `Resultado por local de votação · ${cidade} · ${ano}` },
    {
      type: 'para',
      text: `1º turno · ${num(t.aptos)} eleitores aptos em ${num(t.secoes)} seções e ${num(t.locais)} locais · comparecimento de ${pct(t.pctComparecimento)} (${num(t.comparecimento)}) · abstenção de ${pct(t.pctAbstencao)}.${filtrosTexto ? ` Filtros: ${filtrosTexto}.` : ''}`,
      size: 9.5,
      color: 'muted',
      gapAfter: 4,
    },
  ];
  let primeiro = true;
  for (const c of cargosDe(f.votos)) {
    const r = resultadoCargo(f.votos, c);
    const m = matriz(f.votos, c, 'local');
    if (!m.linhas.length) continue;
    // brancos, nulos e legenda por local
    const extra = { legenda: new Map(), branco: new Map(), nulo: new Map() };
    for (const v of f.votos) {
      if (v.cargo !== c) continue;
      const tipo = tipoVoto(v);
      if (tipo === 'nominal') continue;
      const k = `${v.localCode}|${v.localName}`;
      extra[tipo].set(k, (extra[tipo].get(k) || 0) + v.votes);
    }
    const alfabetica = [...m.linhas].sort(porNomeCivil);
    const grupos = [];
    for (let i = 0; i < m.colunas.length; i += locaisPorPagina) grupos.push([i, Math.min(i + locaisPorPagina, m.colunas.length)]);
    grupos.forEach(([ini, fim], gi) => {
      if (!primeiro) b.push({ type: 'pagebreak' });
      primeiro = false;
      const cols = m.colunas.slice(ini, fim);
      const ultimo = gi === grupos.length - 1;
      b.push({
        type: 'heading',
        text: `${c.toUpperCase()} · ${cidade} · ${ano}${grupos.length > 1 ? ` · locais ${ini + 1} a ${fim} de ${m.colunas.length}` : ''}`,
      });
      b.push({
        type: 'para',
        text: `${alfabetica.length} candidatos em ordem alfabética do nome · votos válidos: ${num(r.validos)}${r.legenda ? ` (${num(r.legenda)} de legenda)` : ''} · brancos: ${num(r.brancos)} · nulos: ${num(r.nulos)}`,
        size: 8.5,
        color: 'muted',
        gapAfter: 2,
      });
      const somaCol = (mapa) => cols.map((k) => mapa.get(k.id) || 0);
      const linhaTotal = (rotulo, valores, total) => [
        { text: rotulo, bold: true },
        '',
        '',
        ...valores.map((v) => ({ text: num(v), align: 'center', bold: true })),
        ...(ultimo ? [{ text: num(total), align: 'center', bold: true }] : []),
      ];
      const nominaisCol = cols.map((_, ci) => alfabetica.reduce((s2, l) => s2 + l.votosCol[ini + ci], 0));
      const totais = [linhaTotal('Total dos candidatos', nominaisCol, alfabetica.reduce((s2, l) => s2 + l.votos, 0))];
      if (r.legenda) totais.push(linhaTotal('Votos de legenda', somaCol(extra.legenda), r.legenda));
      totais.push(linhaTotal('Brancos', somaCol(extra.branco), r.brancos), linhaTotal('Nulos', somaCol(extra.nulo), r.nulos));
      const larguraLocais = 0.5 + (ultimo ? 0 : 0.07);
      b.push({
        type: 'table',
        size: cols.length > 8 ? 7.2 : 7.6,
        widths: [0.21, 0.17, 0.05, ...cols.map(() => larguraLocais / cols.length), ...(ultimo ? [0.07] : [])],
        header: ['Nome do candidato', 'Nome de urna (partido)', 'Nº', ...cols.map((k) => localCurto(k.nome)), ...(ultimo ? ['Total'] : [])],
        headerAlign: ['left', 'left', 'center', ...cols.map(() => 'center'), ...(ultimo ? ['center'] : [])],
        rows: [
          ...alfabetica.map((l) => [
            civil(l),
            `${l.nome} (${l.partido})${situacaoCurta(l) ? ` · ${situacaoCurta(l)}` : ''}`,
            { text: String(l.numero), align: 'center' },
            ...cols.map((_, ci) => ({ text: num(l.votosCol[ini + ci]), align: 'center' })),
            ...(ultimo ? [{ text: num(l.votos), align: 'center', bold: true }] : []),
          ]),
          ...totais,
        ],
        totalRows: totais.length,
      });
    });
  }
  b.push({ type: 'note', text: 'Fonte: Tribunal Superior Eleitoral (TSE), dados abertos por seção eleitoral, 1º turno. Votos nominais por local de votação.' });
  return b;
}

/* ------------------------------------------------------------------ votos por urna e perfil do candidato */

const pct1 = (v) => (v == null ? '—' : `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);
const dec1 = (v) => (v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const emPct = (v) => (v == null ? null : Math.round(v * 10000) / 100); // fração -> número em % com 2 casas
const umaCasa = (v) => (v == null ? null : Math.round(v * 10) / 10);
const ateFundamental = (ind) => (ind?.e0 == null && ind?.e1 == null ? null : (ind.e0 || 0) + (ind.e1 || 0));
const GRUPOS_PERFIL = [
  ['venceu', 'Onde ficou em 1º'],
  ['fortes', '25% mais fortes'],
  ['fracas', '25% mais fracas'],
  ['todas', 'Cidade'],
];
const valorIndicador = (g, d) => (!g.urnas ? null : d.tipo === 'pct' ? emPct(g.ind[d.id]) : umaCasa(g.ind[d.id]));
const textoIndicador = (g, d) => (!g.urnas ? '—' : d.tipo === 'pct' ? pct1(g.ind[d.id]) : `${dec1(g.ind[d.id])} anos`);

/**
 * Excel do relatório "votos por urna": uma linha por urna, os candidatos nas colunas (votos, % e posição na urna)
 * e o perfil do eleitorado de cada urna. Com o perfil traçado, mais três abas (comparação, relação com o voto e locais).
 * @param {any} t resultado de votosPorUrna
 * @param {any} [perfil] resultado de perfilDoCandidato (opcional)
 * @param {any} [traj] resultado de trajetoria (opcional): outras eleições da mesma pessoa
 * @param {any} [urnasPessoa] resultado de urnasDaPessoa (opcional): a mesma urna em cada eleição da pessoa
 */
export function abasVotosPorUrna(t, perfil = null, traj = null, urnasPessoa = null) {
  const rotulo = (c) => `${c.nome} (${c.numero})`;
  const temPerfil = t.linhas.some((l) => l.ind);
  const colunas = [
    { titulo: 'Zona', largura: 7, tipo: 'numero' },
    { titulo: 'Seção (urna)', largura: 9, tipo: 'numero' },
    { titulo: 'Local de votação', largura: 40 },
    { titulo: 'Eleitores aptos', largura: 11, tipo: 'numero' },
    { titulo: 'Comparecimento', largura: 14, tipo: 'numero' },
    { titulo: `Votos válidos (${t.cargo})`, largura: 14, tipo: 'numero' },
    ...t.candidatos.flatMap((c) => [
      { titulo: `${rotulo(c)} - votos`, largura: 16, tipo: 'numero' },
      { titulo: `${rotulo(c)} - % dos válidos`, largura: 15, tipo: 'numero' },
      { titulo: `${rotulo(c)} - posição na urna`, largura: 14, tipo: 'numero' },
    ]),
    { titulo: 'Mais votado na urna', largura: 30 },
    { titulo: 'Votos do mais votado', largura: 12, tipo: 'numero' },
    ...(temPerfil
      ? [
          { titulo: 'Idade média do eleitorado (estimada)', largura: 14, tipo: 'numero' },
          { titulo: '% de 16 a 29 anos', largura: 11, tipo: 'numero' },
          { titulo: '% de 60 anos ou mais', largura: 11, tipo: 'numero' },
          { titulo: '% com ensino superior', largura: 11, tipo: 'numero' },
          { titulo: '% só até o fundamental', largura: 11, tipo: 'numero' },
          { titulo: 'Anos de estudo (estimados)', largura: 11, tipo: 'numero' },
          { titulo: '% mulheres', largura: 10, tipo: 'numero' },
        ]
      : []),
  ];
  const linhas = t.linhas.map((l) => [
    Number(l.zona),
    Number(l.secao),
    l.local,
    l.aptos,
    l.comparecimento,
    l.validos,
    ...l.cand.flatMap((x) => [x.votos, emPct(x.pct), x.posicao]),
    l.maisVotado,
    l.votosMaisVotado,
    ...(temPerfil
      ? [umaCasa(l.ind?.idadeMedia), emPct(l.ind?.i16), emPct(l.ind?.i60), emPct(l.ind?.e3), emPct(ateFundamental(l.ind)), umaCasa(l.ind?.estudo), emPct(l.ind?.mulheres)]
      : []),
  ]);
  linhas.push([
    '',
    '',
    `Total (${t.totais.urnas} urnas)`,
    t.totais.aptos,
    t.totais.comparecimento,
    t.totais.validos,
    ...t.candidatos.flatMap((c) => [c.votos, emPct(c.pctValidos), '']),
  ]);

  const resumo = [
    ['Município', t.cidade],
    ['Eleição', `${t.ano} (1º turno)`],
    ['Cargo', t.cargo],
    ['Urnas (seções com votação)', t.totais.urnas],
    [`Votos válidos (${t.cargo})`, t.totais.validos],
  ];
  for (const c of t.candidatos) {
    resumo.push(
      ['', ''],
      ['Nome do candidato', civil(c)],
      ['Nome de urna', `${c.nome} · nº ${c.numero} · ${c.partido}${c.situacao ? ` · ${c.situacao}` : ''}`],
      ['Votos', c.votos],
      ['% dos válidos', pct(c.pctValidos)],
      ['Posição no município', `${c.posicao}º`],
      ['Urnas com voto', `${c.urnasComVoto} de ${t.totais.urnas}`],
      ['Urnas em que ficou em 1º lugar', c.urnasVencidas],
      ['Metade dos votos saiu de', `${c.metadeDosVotosEm} urnas`],
      ['Melhor urna (maior % dos válidos)', c.melhor ? `Zona ${c.melhor.zona}, seção ${c.melhor.secao} (${c.melhor.local}): ${num(c.melhor.votos)} votos, ${pct(c.melhor.pct)}` : '—'],
    );
  }
  if (perfil) {
    resumo.push(['', ''], ['Perfil de onde foi mais forte', perfil.manchete], ...perfil.frases.map((f, i) => [i ? '' : 'Leitura', f]), ['Aviso', perfil.aviso]);
  }
  const abas = [
    { nome: 'Votos por urna', colunas, linhas },
    { nome: 'Resumo', colunas: [{ titulo: 'Item', largura: 36 }, { titulo: 'Valor', largura: 110 }], linhas: resumo },
  ];
  if (perfil) {
    const g = perfil.grupos;
    abas.push({
      nome: 'Perfil - comparação',
      colunas: [
        { titulo: 'Tema', largura: 14 },
        { titulo: 'Indicador', largura: 34 },
        ...GRUPOS_PERFIL.map(([k, nome]) => ({ titulo: `${nome} (${g[k].urnas} urnas)`, largura: 20, tipo: 'numero' })),
      ],
      linhas: [
        ['Votação', '% dos votos válidos do candidato', ...GRUPOS_PERFIL.map(([k]) => (g[k].urnas ? emPct(g[k].pct) : null))],
        ...perfil.indicadores.map((d) => [d.grupo, `${d.rotulo}${d.tipo === 'pct' ? ' (%)' : ''}`, ...GRUPOS_PERFIL.map(([k]) => valorIndicador(g[k], d))]),
      ],
    });
    abas.push({
      nome: 'Perfil - relação com o voto',
      colunas: [
        { titulo: 'Indicador do eleitorado da urna', largura: 34 },
        { titulo: 'Correlação com a % de votos (r)', largura: 16, tipo: 'numero' },
        { titulo: 'Leitura', largura: 80 },
      ],
      linhas: perfil.relacoes.map((r) => [
        r.rotulo,
        r.r == null ? null : Math.round(r.r * 100) / 100,
        r.r == null ? 'sem dados suficientes' : Math.abs(r.r) < 0.15 ? r.forca : `${r.forca}: quanto ${r.r > 0 ? r.mais : r.menos}, maior a votação`,
      ]),
    });
    abas.push({
      nome: 'Perfil - locais mais fortes',
      colunas: [
        { titulo: 'Local de votação', largura: 44 },
        { titulo: 'Urnas entre as 25% mais fortes', largura: 16, tipo: 'numero' },
        { titulo: 'Urnas no local', largura: 12, tipo: 'numero' },
        { titulo: 'Votos nessas urnas', largura: 14, tipo: 'numero' },
      ],
      linhas: perfil.locais.map((l) => [l.local, l.urnas, l.total, l.votos]),
    });
  }
  if (urnasPessoa) abas.push(abaUrnasDaPessoa(urnasPessoa));
  if (traj && traj.candidaturas.length > 1) abas.push(...abasTrajetoria(traj));
  return abas;
}

const valorTraj = (v, tipo) => (v.valor == null ? '—' : tipo === 'pct' ? pct1(v.valor) : `${dec1(v.valor)} anos`);
const difTraj = (v, tipo) =>
  v.dif == null ? '' : tipo === 'pct' ? `${v.dif >= 0 ? '+' : '−'}${dec1(Math.abs(v.dif) * 100)} p.p.` : `${v.dif >= 0 ? '+' : '−'}${dec1(Math.abs(v.dif))}`;

/** Abas do Excel com as outras eleições da mesma pessoa */
export function abasTrajetoria(tr) {
  const cs = tr.candidaturas;
  return [
    {
      nome: 'Trajetória',
      colunas: [
        { titulo: 'Ano', largura: 7, tipo: 'numero' },
        { titulo: 'Cargo', largura: 18 },
        { titulo: 'Nome do candidato', largura: 36 },
        { titulo: 'Nome de urna', largura: 26 },
        { titulo: 'Número', largura: 9 },
        { titulo: 'Partido', largura: 12 },
        { titulo: 'Situação', largura: 16 },
        { titulo: 'Votos', largura: 10, tipo: 'numero' },
        { titulo: '% dos válidos', largura: 12, tipo: 'numero' },
        { titulo: 'Posição', largura: 9, tipo: 'numero' },
        { titulo: 'Concorrentes', largura: 12, tipo: 'numero' },
        { titulo: 'Urnas em 1º lugar', largura: 12, tipo: 'numero' },
        { titulo: 'Urnas', largura: 8, tipo: 'numero' },
        { titulo: 'Perfil dos redutos', largura: 60 },
      ],
      linhas: [
        ...cs.map((c) => [
          c.ano,
          c.cargo,
          tr.nomeCivil,
          c.nome,
          c.numero,
          c.partido,
          c.situacao,
          c.votos,
          emPct(c.pctValidos),
          c.posicao,
          c.concorrentes,
          c.urnasVencidas,
          c.urnas,
          c.perfil?.manchete || '',
        ]),
        [''],
        ...tr.frases.map((f, i) => ['', i ? '' : 'Comparativo', f]),
      ],
    },
    {
      nome: 'Trajetória - redutos',
      colunas: [{ titulo: 'Eleitorado das 25% urnas mais fortes', largura: 30 }, ...cs.flatMap((c) => [{ titulo: `${c.ano} ${c.cargo}`, largura: 18 }, { titulo: `${c.ano}: diferença para a cidade`, largura: 18 }])],
      linhas: tr.comparacao.map((x) => [x.rotulo, ...x.valores.flatMap((v) => [valorTraj(v, x.tipo), difTraj(v, x.tipo)])]),
    },
    {
      nome: 'Trajetória - locais',
      colunas: [{ titulo: 'Local de votação', largura: 44 }, ...cs.flatMap((c) => [{ titulo: `${c.ano}: % dos válidos`, largura: 14, tipo: 'numero' }, { titulo: `${c.ano}: votos`, largura: 10, tipo: 'numero' }])],
      linhas: tr.locais.map((l) => [l.local, ...l.por.flatMap((x) => (x ? [emPct(x.pct), x.votos] : [null, null]))]),
    },
  ];
}

/** Blocos do PDF com as outras eleições da mesma pessoa (cartão por eleição, comparativo, redutos e locais) */
export function blocosTrajetoria(tr) {
  if (!tr || tr.candidaturas.length < 2) return [];
  const cs = tr.candidaturas;
  const largura = 0.7 / cs.length;
  return [
    { type: 'heading', text: `${tr.nomeCivil} em ${cs.length} eleições` },
    { type: 'para', text: 'Mesma pessoa no cadastro do TSE, mesmo quando muda o nome de urna, o partido ou o cargo.', size: 9, color: 'muted', gapAfter: 3 },
    {
      type: 'table',
      size: 8,
      widths: [0.07, 0.15, 0.2, 0.09, 0.1, 0.1, 0.09, 0.09, 0.11],
      header: ['Ano', 'Cargo', 'Nome de urna', 'Partido', 'Votos', '% válidos', 'Posição', '1º lugar em', 'Situação'],
      headerAlign: ['center', 'left', 'left', 'left', 'center', 'center', 'center', 'center', 'left'],
      rows: cs.map((c) => [
        { text: String(c.ano), align: 'center', bold: c.atual },
        c.cargo,
        c.nome,
        c.partido,
        { text: num(c.votos), align: 'center', bold: true },
        { text: pct1(c.pctValidos), align: 'center' },
        { text: `${c.posicao}º de ${c.concorrentes}`, align: 'center' },
        { text: `${c.urnasVencidas} urnas`, align: 'center' },
        c.situacao || '—',
      ]),
    },
    { type: 'bullets', items: tr.frases },
    {
      type: 'table',
      size: 8,
      widths: [0.3, ...cs.map(() => largura)],
      header: ['Redutos: eleitorado das 25% urnas mais fortes', ...cs.map((c) => `${c.ano} · ${c.cargo}`)],
      headerAlign: ['left', ...cs.map(() => 'center')],
      rows: tr.comparacao.map((x) => [x.rotulo, ...x.valores.map((v) => ({ text: `${valorTraj(v, x.tipo)}${v.dif == null ? '' : ` (${difTraj(v, x.tipo)})`}`, align: 'center' }))]),
    },
    {
      type: 'table',
      size: 8,
      widths: [0.3, ...cs.map(() => largura)],
      header: ['Local de votação: % dos válidos (votos)', ...cs.map((c) => String(c.ano))],
      headerAlign: ['left', ...cs.map(() => 'center')],
      rows: tr.locais.slice(0, 10).map((l) => [localCurto(l.local), ...l.por.map((x) => ({ text: x ? `${pct1(x.pct)} (${num(x.votos)})` : '—', align: 'center' }))]),
    },
    { type: 'note', text: 'Entre parênteses, nos redutos: diferença para a média da cidade naquele ano (p.p. = pontos percentuais).' },
  ];
}

/** Blocos do PDF com o perfil traçado (manchete, leitura, comparação, locais e aviso) */
export function blocosPerfilCandidato(p) {
  const g = p.grupos;
  return [
    { type: 'heading', text: `Perfil de onde ${p.candidato.nome} foi mais forte${p.candidato.nomeCivil && p.candidato.nomeCivil !== p.candidato.nome ? ` (${p.candidato.nomeCivil})` : ''}` },
    { type: 'para', text: p.manchete, bold: true, gapAfter: 4 },
    { type: 'bullets', items: p.frases },
    {
      type: 'table',
      size: 8.2,
      widths: [0.32, 0.17, 0.17, 0.17, 0.17],
      header: ['Eleitorado da urna (TSE)', ...GRUPOS_PERFIL.map(([k, nome]) => `${nome} (${g[k].urnas} urnas)`)],
      headerAlign: ['left', 'center', 'center', 'center', 'center'],
      rows: [
        [{ text: 'Votos do candidato (% dos válidos)', bold: true }, ...GRUPOS_PERFIL.map(([k]) => ({ text: g[k].urnas ? pct1(g[k].pct) : '—', align: 'center', bold: true }))],
        ...p.indicadores.map((d) => [rotuloCompleto(d), ...GRUPOS_PERFIL.map(([k]) => ({ text: textoIndicador(g[k], d), align: 'center' }))]),
      ],
    },
    {
      type: 'table',
      size: 8,
      widths: [0.07, 0.07, 0.3, 0.09, 0.1, 0.12, 0.12, 0.13],
      header: ['Zona', 'Seção', 'As 10 urnas mais fortes', 'Votos', '% válidos', 'Idade média', '60 anos ou mais', 'Ensino superior'],
      headerAlign: ['center', 'center', 'left', 'center', 'center', 'center', 'center', 'center'],
      rows: p.melhores.map((u) => [
        { text: u.zona, align: 'center' },
        { text: u.secao, align: 'center' },
        localCurto(u.local),
        { text: num(u.votos), align: 'center', bold: true },
        { text: pct1(u.pct), align: 'center' },
        { text: u.ind ? `${dec1(u.ind.idadeMedia)} anos` : '—', align: 'center' },
        { text: pct1(u.ind?.i60), align: 'center' },
        { text: pct1(u.ind?.e3), align: 'center' },
      ]),
    },
    ...(p.locais.length
      ? [
          {
            type: 'para',
            text: `Locais de votação das urnas mais fortes: ${p.locais
              .slice(0, 8)
              .map((l) => `${localCurto(l.local)} (${l.urnas} de ${l.total} ${l.total === 1 ? 'urna' : 'urnas'})`)
              .join('; ')}.`,
            size: 9,
            gapAfter: 4,
          },
        ]
      : []),
    { type: 'note', text: p.aviso },
  ];
}

/**
 * PDF "votos por urna": resumo dos candidatos e uma linha por urna (zona, seção, local), com os votos de cada candidato.
 * Com o perfil traçado, ele vem antes, na primeira página. A ordem das urnas é a de `t.linhas`.
 * @param {any} t resultado de votosPorUrna
 * @param {{ dataText: string, perfil?: any, trajetoria?: any, urnasPessoa?: any }} opcoes
 */
export function blocosVotosPorUrna(t, { dataText, perfil = null, trajetoria = null, urnasPessoa = null }) {
  const umSo = t.candidatos.length === 1;
  const b = [
    { type: 'date', text: dataText },
    { type: 'title', text: `Votos por urna · ${t.cargo} · ${t.cidade} · ${t.ano}` },
    {
      type: 'para',
      text: `1º turno · ${num(t.totais.urnas)} urnas (seções eleitorais com votação) · ${num(t.totais.validos)} votos válidos · ${t.candidatos.map((c) => `${civil(c)}, nome de urna ${c.nome} (${c.numero}, ${c.partido})`).join('; ')}.`,
      size: 9.5,
      color: 'muted',
      gapAfter: 4,
    },
  ];
  if (perfil) b.push(...blocosPerfilCandidato(perfil), ...blocosTrajetoria(trajetoria), { type: 'pagebreak' });
  b.push(
    { type: 'heading', text: 'Resumo' },
    {
      type: 'table',
      size: 8.2,
      widths: [0.2, 0.17, 0.06, 0.08, 0.08, 0.08, 0.11, 0.1, 0.12],
      header: ['Nome do candidato', 'Nome de urna (partido)', 'Nº', 'Votos', '% válidos', 'Posição', 'Urnas com voto', '1º lugar em', 'Metade dos votos em'],
      headerAlign: ['left', 'left', 'center', 'center', 'center', 'center', 'center', 'center', 'center'],
      rows: t.candidatos.map((c) => [
        civil(c),
        `${c.nome} (${c.partido})${c.situacao ? ` · ${minuscula1(c.situacao)}` : ''}`,
        { text: String(c.numero), align: 'center' },
        { text: num(c.votos), align: 'center', bold: true },
        { text: pct1(c.pctValidos), align: 'center' },
        { text: `${c.posicao}º`, align: 'center' },
        { text: `${c.urnasComVoto} de ${t.totais.urnas}`, align: 'center' },
        { text: `${c.urnasVencidas} ${c.urnasVencidas === 1 ? 'urna' : 'urnas'}`, align: 'center' },
        { text: `${c.metadeDosVotosEm} ${c.metadeDosVotosEm === 1 ? 'urna' : 'urnas'}`, align: 'center' },
      ]),
    },
    { type: 'heading', text: 'Votos em cada urna' },
  );
  const celulaCand = (x) => ({ text: `${num(x.votos)} (${pct1(x.pct)})${x.venceu ? ' 1º' : ''}`, align: 'center', bold: x.venceu });
  const header = umSo
    ? ['Zona', 'Seção', 'Local de votação', 'Votos', '% válidos', 'Posição', 'Válidos', 'Mais votado na urna']
    : ['Zona', 'Seção', 'Local de votação', ...t.candidatos.map((c) => c.nome), 'Válidos', 'Mais votado na urna'];
  const widths = umSo ? [0.06, 0.07, 0.3, 0.08, 0.09, 0.08, 0.08, 0.24] : [0.06, 0.07, 0.24, ...t.candidatos.map(() => 0.38 / t.candidatos.length), 0.07, 0.18];
  const rows = t.linhas.map((l) => [
    { text: l.zona, align: 'center' },
    { text: l.secao, align: 'center' },
    localCurto(l.local),
    ...(umSo
      ? [
          { text: num(l.cand[0].votos), align: 'center', bold: l.cand[0].venceu },
          { text: pct1(l.cand[0].pct), align: 'center' },
          { text: l.cand[0].posicao ? `${l.cand[0].posicao}º` : '—', align: 'center', bold: l.cand[0].venceu },
        ]
      : l.cand.map(celulaCand)),
    { text: num(l.validos), align: 'center' },
    l.maisVotado ? `${l.maisVotado} (${num(l.votosMaisVotado)})` : '—',
  ]);
  rows.push([
    '',
    '',
    { text: `Total (${t.totais.urnas} urnas)`, bold: true },
    ...(umSo
      ? [
          { text: num(t.candidatos[0].votos), align: 'center' },
          { text: pct1(t.candidatos[0].pctValidos), align: 'center' },
          { text: `${t.candidatos[0].posicao}º na cidade`, align: 'center' },
        ]
      : t.candidatos.map((c) => ({ text: `${num(c.votos)} (${pct1(c.pctValidos)})`, align: 'center' }))),
    { text: num(t.totais.validos), align: 'center' },
    '',
  ]);
  b.push({ type: 'table', size: 7.8, widths, header, headerAlign: header.map((_, i) => (i === 2 || i === header.length - 1 ? 'left' : 'center')), rows, totalRows: 1 });
  b.push({
    type: 'note',
    text: `Fonte: Tribunal Superior Eleitoral (TSE), dados abertos por seção eleitoral, 1º turno. Cada urna é uma seção eleitoral; "1º" marca a urna em que o candidato foi o mais votado do cargo. % sobre os votos válidos da urna (candidatos${t.resultado.proporcional ? ' e legenda' : ''}).`,
  });
  if (urnasPessoa) b.push({ type: 'pagebreak' }, ...blocosUrnasDaPessoa(urnasPessoa));
  return b;
}

const rotuloEleicao = (e) => `${e.ano} · ${e.cargo}`;
const difTxt = (d) => (d == null ? '—' : d === 0 ? '0' : `${d > 0 ? '+' : '-'}${num(Math.abs(d))}`);

/** Excel: a mesma urna em cada eleição da pessoa (votos e % de cada ano, e a diferença entre a última e a primeira) */
export function abaUrnasDaPessoa(u) {
  const e = u.eleicoes;
  const ult = e.length - 1;
  return {
    nome: 'Urnas em cada eleição',
    colunas: [
      { titulo: 'Zona', largura: 7, tipo: 'numero' },
      { titulo: 'Seção (urna)', largura: 9, tipo: 'numero' },
      { titulo: 'Local de votação', largura: 40 },
      ...e.flatMap((x) => [
        { titulo: `${x.ano} ${x.cargo} (${x.nome}, ${x.partido}): votos`, largura: 18, tipo: 'numero' },
        { titulo: `${x.ano}: % dos válidos`, largura: 12, tipo: 'numero' },
      ]),
      { titulo: `Diferença de votos (${e[ult].ano} - ${e[0].ano})`, largura: 16, tipo: 'numero' },
    ],
    linhas: [
      ...u.linhas.map((l) => [Number(l.zona), Number(l.secao), l.local, ...l.por.flatMap((p) => (p ? [p.votos, emPct(p.pct)] : [null, null])), l.diferenca]),
      ['', '', 'Total na cidade', ...e.flatMap((x) => [x.votos, emPct(x.pctValidos)]), e[ult].votos - e[0].votos],
    ],
  };
}

/** PDF: a mesma urna em cada eleição da pessoa */
export function blocosUrnasDaPessoa(u) {
  const e = u.eleicoes;
  const ult = e.length - 1;
  const largura = 0.53 / e.length;
  return [
    { type: 'heading', text: `${u.nomeCivil}: votação urna por urna em ${e.length} eleições` },
    {
      type: 'para',
      text: `${e.map((x) => `${x.ano}: ${x.cargo.toLowerCase()}, como ${x.nome} (${x.partido}), ${num(x.votos)} votos`).join('; ')}. Mesma urna (zona e seção) em cada eleição; "—" quando a seção não existia ou não teve votação naquele ano. ${u.emTodas} urnas aparecem em todas. Em negrito, a urna em que foi o mais votado do cargo.`,
      size: 9,
      color: 'muted',
      gapAfter: 4,
    },
    {
      type: 'table',
      size: e.length > 3 ? 7.2 : 7.8,
      widths: [0.06, 0.07, 0.25, ...e.map(() => largura), 0.09],
      header: ['Zona', 'Seção', 'Local de votação', ...e.map(rotuloEleicao), `Diferença ${e[0].ano}-${e[ult].ano}`],
      headerAlign: ['center', 'center', 'left', ...e.map(() => 'center'), 'center'],
      rows: [
        ...u.linhas.map((l) => [
          { text: l.zona, align: 'center' },
          { text: l.secao, align: 'center' },
          localCurto(l.local),
          ...l.por.map((p) => ({ text: p ? `${num(p.votos)} (${pct1(p.pct)})` : '—', align: 'center', bold: !!p?.venceu })),
          { text: difTxt(l.diferenca), align: 'center' },
        ]),
        [
          '',
          '',
          { text: 'Total na cidade', bold: true },
          ...e.map((x) => ({ text: `${num(x.votos)} (${pct1(x.pctValidos)})`, align: 'center' })),
          { text: difTxt(e[ult].votos - e[0].votos), align: 'center' },
        ],
      ],
      totalRows: 1,
    },
  ];
}

/* ------------------------------------------------------------------ comparação de dois candidatos */

const descreverCand = (c, x) => `${c.nome}${c.nomeCivil && c.nomeCivil !== c.nome ? ` (${c.nomeCivil})` : ''}, ${x.cargo.toLowerCase()} ${x.ano}, ${c.partido}${c.situacao ? `, ${minuscula1(c.situacao)}` : ''}`;

/** PDF da comparação: conexão, gráfico de pontos (uma urna por ponto), quadrantes, locais e a tabela urna por urna */
export function blocosComparacao(o, { dataText }) {
  const A = o.ca.nome;
  const B = o.cb.nome;
  const q = Object.fromEntries(o.quadrantes.map((x) => [x.id, x]));
  const dx = dominioEixo(o.pares.map((p) => p.pA));
  const dy = dominioEixo(o.pares.map((p) => p.pB));
  const pontosTxt = (d) => `${d >= 0 ? '+' : '-'}${dec1(Math.abs(d) * 100)}`;
  return [
    { type: 'date', text: dataText },
    { type: 'title', text: `Comparação de candidatos · ${o.cidade}` },
    { type: 'para', text: `Primeiro: ${descreverCand(o.ca, o.a)}. Segundo: ${descreverCand(o.cb, o.b)}. ${o.N} urnas comparadas.`, size: 9.5, color: 'muted', gapAfter: 4 },
    { type: 'heading', text: 'Conexão entre os dois' },
    { type: 'para', text: o.manchete, bold: true, gapAfter: 4 },
    {
      type: 'table',
      size: 8.4,
      widths: [0.25, 0.25, 0.25, 0.25],
      header: ['Correlação nas urnas', 'Redutos em comum', `${B} nos redutos de ${A}`, `${A} nos redutos de ${B}`],
      headerAlign: ['center', 'center', 'center', 'center'],
      rows: [
        [
          { text: `${o.rho.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ${o.ligacao.curto}`, align: 'center', bold: true },
          { text: `${o.sobreposicao.comuns} de ${o.sobreposicao.redutosA} (acaso: ~${Math.round(o.sobreposicao.esperado)})`, align: 'center', bold: true },
          { text: `${pct1(o.cruzado.bNosRedutosDeA)} (${pontosTxt(o.cruzado.bNosRedutosDeA - o.mediaB)} p.p.)`, align: 'center', bold: true },
          { text: `${pct1(o.cruzado.aNosRedutosDeB)} (${pontosTxt(o.cruzado.aNosRedutosDeB - o.mediaA)} p.p.)`, align: 'center', bold: true },
        ],
      ],
    },
    { type: 'para', text: 'Como ler o gráfico', bold: true, gapAfter: 2 },
    {
      type: 'bullets',
      items: o.comoLer.passos.map(
        (p, i) =>
          `${i + 1}. ${p.titulo}. ${p.texto}${i === 2 ? ` ${o.comoLer.grupos.map((g) => `${g.rotulo}, ${g.onde}: ${g.urnas} urnas`).join('; ')}.` : ''}`,
      ),
    },
    {
      type: 'scatter',
      height: 260,
      xLabel: `% dos válidos de ${A} na urna`,
      yLabel: `% dos válidos de ${B} na urna`,
      xMin: dx.min,
      xMax: dx.max,
      yMin: dy.min,
      yMax: dy.max,
      xRef: o.mediaA,
      yRef: o.mediaB,
      trend: o.tendencia,
      points: o.pares.map((p) => ({ x: p.pA, y: p.pB, color: QUADRANTES.find((x) => x.id === p.quadrante).cor })),
      legend: QUADRANTES.map((x) => ({ label: `${rotuloQuadrante(x.id, o)} (${q[x.id].urnas})`, color: x.cor })),
    },
    { type: 'note', text: `Cada ponto é uma urna. As linhas cinzas marcam a média de cada um na cidade (${pct1(o.mediaA)} e ${pct1(o.mediaB)}); a linha azul-marinho mostra a tendência.` },
    { type: 'bullets', items: o.frases },
    {
      type: 'table',
      size: 8,
      widths: [0.27, 0.08, 0.11, 0.11, 0.1, 0.1, 0.23],
      header: ['Grupo de urnas', 'Urnas', `% ${A}`, `% ${B}`, 'Idade média', 'Ensino superior', 'Eleitorado'],
      headerAlign: ['left', 'center', 'center', 'center', 'center', 'center', 'left'],
      rows: [
        ...o.quadrantes.map((x) => [
          rotuloQuadrante(x.id, o),
          { text: String(x.urnas), align: 'center' },
          { text: x.urnas ? pct1(x.pctA) : '—', align: 'center' },
          { text: x.urnas ? pct1(x.pctB) : '—', align: 'center' },
          { text: x.urnas && x.ind.idadeMedia != null ? `${dec1(x.ind.idadeMedia)} anos` : '—', align: 'center' },
          { text: x.urnas ? pct1(x.ind.e3) : '—', align: 'center' },
          x.leitura ? [x.leitura.idade, x.leitura.escolaridade].filter(Boolean).join(', ') || 'na média da cidade' : '—',
        ]),
      ],
    },
    {
      type: 'table',
      size: 8,
      widths: [0.4, 0.08, 0.13, 0.13, 0.26],
      header: ['Local de votação', 'Urnas', `% ${A}`, `% ${B}`, 'Grupo'],
      headerAlign: ['left', 'center', 'center', 'center', 'left'],
      rows: o.locais.map((l) => [localCurto(l.local), { text: String(l.urnas), align: 'center' }, { text: pct1(l.pA), align: 'center' }, { text: pct1(l.pB), align: 'center' }, rotuloQuadrante(l.quadrante, o)]),
    },
    { type: 'pagebreak' },
    { type: 'heading', text: 'Urna por urna' },
    {
      type: 'table',
      size: 7.8,
      widths: [0.07, 0.07, 0.3, 0.16, 0.16, 0.24],
      header: ['Zona', 'Seção', 'Local de votação', `${A}: votos (%)`, `${B}: votos (%)`, 'Grupo'],
      headerAlign: ['center', 'center', 'left', 'center', 'center', 'left'],
      rows: o.pares.map((p) => [
        { text: p.zona, align: 'center' },
        { text: p.secao, align: 'center' },
        localCurto(p.local),
        { text: `${num(p.votosA)} (${pct1(p.pA)})`, align: 'center', bold: p.venceuA },
        { text: `${num(p.votosB)} (${pct1(p.pB)})`, align: 'center', bold: p.venceuB },
        rotuloQuadrante(p.quadrante, o),
      ]),
    },
    { type: 'note', text: `${o.aviso} Em negrito, a urna em que o candidato foi o mais votado do cargo. Fonte: TSE, dados abertos por seção, 1º turno.` },
  ];
}

/** Excel da comparação: resumo, urna por urna (com o perfil do eleitorado), grupos e locais */
export function abasComparacao(o) {
  const A = o.ca.nome;
  const B = o.cb.nome;
  return [
    {
      nome: 'Comparação',
      colunas: [{ titulo: 'Item', largura: 40 }, { titulo: 'Valor', largura: 120 }],
      linhas: [
        ['Município', o.cidade],
        ['Primeiro candidato', descreverCand(o.ca, o.a)],
        ['Segundo candidato', descreverCand(o.cb, o.b)],
        ['Urnas comparadas', o.N],
        ['Conexão', o.manchete],
        ['Correlação de Spearman (urnas)', Math.round(o.rho * 1000) / 1000],
        ['Intervalo de 95% da correlação', o.ic ? o.ic.map((v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })).join(' a ') : '—'],
        ['p-valor', o.p == null ? '—' : o.p < 0.001 ? '< 0,001' : Math.round(o.p * 1000) / 1000],
        ['Correlação de Pearson (urnas)', Math.round(o.r * 1000) / 1000],
        [`Média de ${A} (% dos válidos)`, pct(o.mediaA)],
        [`Média de ${B} (% dos válidos)`, pct(o.mediaB)],
        ['Redutos em comum', `${o.sobreposicao.comuns} de ${o.sobreposicao.redutosA} (acaso: cerca de ${Math.round(o.sobreposicao.esperado)})`],
        [`${B} nos redutos de ${A}`, pct(o.cruzado.bNosRedutosDeA)],
        [`${A} nos redutos de ${B}`, pct(o.cruzado.aNosRedutosDeB)],
        [''],
        ...o.frases.map((f, i) => [i ? '' : 'Leitura', f]),
        ['Aviso', o.aviso],
      ],
    },
    {
      nome: 'Urnas',
      colunas: [
        { titulo: 'Zona', largura: 7, tipo: 'numero' },
        { titulo: 'Seção', largura: 8, tipo: 'numero' },
        { titulo: 'Local de votação', largura: 40 },
        { titulo: `${A}: votos`, largura: 12, tipo: 'numero' },
        { titulo: `${A}: % dos válidos`, largura: 14, tipo: 'numero' },
        { titulo: `${B}: votos`, largura: 12, tipo: 'numero' },
        { titulo: `${B}: % dos válidos`, largura: 14, tipo: 'numero' },
        { titulo: 'Grupo', largura: 30 },
        { titulo: 'Idade média do eleitorado', largura: 12, tipo: 'numero' },
        { titulo: '% de 60 anos ou mais', largura: 11, tipo: 'numero' },
        { titulo: '% com ensino superior', largura: 11, tipo: 'numero' },
      ],
      linhas: o.pares.map((p) => [
        Number(p.zona),
        Number(p.secao),
        p.local,
        p.votosA,
        emPct(p.pA),
        p.votosB,
        emPct(p.pB),
        rotuloQuadrante(p.quadrante, o),
        umaCasa(p.ind?.idadeMedia),
        emPct(p.ind?.i60),
        emPct(p.ind?.e3),
      ]),
    },
    {
      nome: 'Grupos de urnas',
      colunas: [
        { titulo: 'Grupo', largura: 34 },
        { titulo: 'Urnas', largura: 8, tipo: 'numero' },
        { titulo: `% ${A}`, largura: 12, tipo: 'numero' },
        { titulo: `% ${B}`, largura: 12, tipo: 'numero' },
        { titulo: 'Idade média', largura: 11, tipo: 'numero' },
        { titulo: '% 60 anos ou mais', largura: 11, tipo: 'numero' },
        { titulo: '% ensino superior', largura: 11, tipo: 'numero' },
        { titulo: 'Eleitorado', largura: 40 },
      ],
      linhas: o.quadrantes.map((x) => [
        rotuloQuadrante(x.id, o),
        x.urnas,
        x.urnas ? emPct(x.pctA) : null,
        x.urnas ? emPct(x.pctB) : null,
        x.urnas ? umaCasa(x.ind.idadeMedia) : null,
        x.urnas ? emPct(x.ind.i60) : null,
        x.urnas ? emPct(x.ind.e3) : null,
        x.leitura ? [x.leitura.idade, x.leitura.escolaridade, x.leitura.genero].filter(Boolean).join(', ') || 'na média da cidade' : '',
      ]),
    },
    {
      nome: 'Locais',
      colunas: [
        { titulo: 'Local de votação', largura: 44 },
        { titulo: 'Urnas', largura: 8, tipo: 'numero' },
        { titulo: `% ${A}`, largura: 12, tipo: 'numero' },
        { titulo: `% ${B}`, largura: 12, tipo: 'numero' },
        { titulo: 'Grupo', largura: 30 },
      ],
      linhas: o.locais.map((l) => [l.local, l.urnas, emPct(l.pA), emPct(l.pB), rotuloQuadrante(l.quadrante, o)]),
    },
  ];
}
