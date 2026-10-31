// Relatórios do painel eleitoral: abas do Excel e blocos do PDF (layout Ágil CM, pdfReport.ts).
import { cargosDe, comparecimento, dimensoesDe, matriz, nomeLocal, perfil, porPartido, resultadoCargo, tipoVoto, totaisComparecimento } from './eleicao.js';

const pct = (v) => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const num = (v) => Number(v || 0).toLocaleString('pt-BR');
const nomeAba = (s) => s.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31);

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
    const linhas = r.candidatos.map((x) => [x.posicao, x.nome, x.numero, x.partido, x.votos, Math.round(x.pctValidos * 10000) / 100]);
    for (const l of r.legendas) linhas.push(['', `Voto de legenda: ${l.partido}`, '', l.partido, l.votos, Math.round((r.validos ? l.votos / r.validos : 0) * 10000) / 100]);
    linhas.push(['', 'Brancos', '', '', r.brancos, null], ['', 'Nulos', '', '', r.nulos, null]);
    abas.push({
      nome: nomeAba(`${c} - resultado`),
      colunas: [
        { titulo: 'Posição', largura: 9, tipo: 'numero' },
        { titulo: 'Candidato', largura: 36 },
        { titulo: 'Número', largura: 9 },
        { titulo: 'Partido', largura: 14 },
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
          { titulo: 'Candidato', largura: 32 },
          { titulo: 'Número', largura: 8 },
          { titulo: 'Partido', largura: 12 },
          ...cab.map((titulo) => ({ titulo, largura: 14, tipo: 'numero' })),
          { titulo: 'Total', largura: 11, tipo: 'numero' },
        ],
        linhas: [
          ...m.linhas.map((l) => [l.nome, l.numero, l.partido, ...l.votosCol, l.votos]),
          ['Votos válidos no local', '', '', ...m.validosCol, m.resultado.validos],
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
          { titulo: 'Candidato', largura: 32 },
          { titulo: 'Número', largura: 8 },
          { titulo: 'Partido', largura: 12 },
          ...m.colunas.map((k) => ({ titulo: `${k.nome} · Z${k.zona} S${k.secao}`, largura: 14, tipo: 'numero' })),
          { titulo: 'Total', largura: 11, tipo: 'numero' },
        ],
        linhas: linhas.map((l) => [l.nome, l.numero, l.partido, ...l.votosCol, l.votos]),
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
export function blocosPdf(f, { cidade, ano, dataText, filtrosTexto = '', locaisPorPagina = 8 }) {
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
    const alfabetica = [...m.linhas].sort((a, b2) => a.nome.localeCompare(b2.nome, 'pt-BR'));
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
        text: `${alfabetica.length} candidatos em ordem alfabética · votos válidos: ${num(r.validos)}${r.legenda ? ` (${num(r.legenda)} de legenda)` : ''} · brancos: ${num(r.brancos)} · nulos: ${num(r.nulos)}`,
        size: 8.5,
        color: 'muted',
        gapAfter: 2,
      });
      const somaCol = (mapa) => cols.map((k) => mapa.get(k.id) || 0);
      const linhaTotal = (rotulo, valores, total) => [
        { text: rotulo, bold: true },
        '',
        ...valores.map((v) => ({ text: num(v), align: 'center', bold: true })),
        ...(ultimo ? [{ text: num(total), align: 'center', bold: true }] : []),
      ];
      const nominaisCol = cols.map((_, ci) => alfabetica.reduce((s2, l) => s2 + l.votosCol[ini + ci], 0));
      const totais = [linhaTotal('Total dos candidatos', nominaisCol, alfabetica.reduce((s2, l) => s2 + l.votos, 0))];
      if (r.legenda) totais.push(linhaTotal('Votos de legenda', somaCol(extra.legenda), r.legenda));
      totais.push(linhaTotal('Brancos', somaCol(extra.branco), r.brancos), linhaTotal('Nulos', somaCol(extra.nulo), r.nulos));
      const larguraLocais = 0.56 + (ultimo ? 0 : 0.1);
      b.push({
        type: 'table',
        size: 7.8,
        widths: [0.3, 0.06, ...cols.map(() => larguraLocais / cols.length), ...(ultimo ? [0.08] : [])],
        header: ['Candidato (partido)', 'Nº', ...cols.map((k) => localCurto(k.nome)), ...(ultimo ? ['Total'] : [])],
        headerAlign: ['left', 'center', ...cols.map(() => 'center'), ...(ultimo ? ['center'] : [])],
        rows: [
          ...alfabetica.map((l) => [
            `${l.nome} (${l.partido})`,
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
