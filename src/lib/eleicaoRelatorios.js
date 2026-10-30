// Relatórios do painel eleitoral: abas do Excel e blocos do PDF (layout Ágil CM, pdfReport.ts).
import { cargosDe, comparecimento, dimensoesDe, matriz, perfil, porPartido, resultadoCargo, totaisComparecimento } from './eleicao.js';

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

/**
 * PDF de uma cidade e eleição: resumo, resultado de cada cargo e votos por local de votação.
 * Nos cargos proporcionais, a tabela por local mostra os `maxProporcionais` mais votados (todos se 0).
 */
export function blocosPdf(f, { cidade, ano, dataText, maxProporcionais = 12, filtrosTexto = '' }) {
  const t = totaisComparecimento(f.secoes);
  const b = [
    { type: 'date', text: dataText },
    { type: 'title', text: `Resultado eleitoral · ${cidade} · ${ano}` },
    {
      type: 'para',
      text: `1º turno · ${num(t.aptos)} eleitores aptos em ${num(t.secoes)} seções e ${num(t.locais)} locais · comparecimento de ${pct(t.pctComparecimento)} (${num(t.comparecimento)}) · abstenção de ${pct(t.pctAbstencao)}.${filtrosTexto ? ` Filtros: ${filtrosTexto}.` : ''}`,
      gapAfter: 8,
    },
  ];
  for (const c of cargosDe(f.votos)) {
    const r = resultadoCargo(f.votos, c);
    b.push({ type: 'heading', text: c });
    b.push({
      type: 'para',
      text: `Votos válidos: ${num(r.validos)}${r.legenda ? ` (${num(r.legenda)} de legenda)` : ''} · brancos: ${num(r.brancos)} · nulos: ${num(r.nulos)}`,
      size: 9,
      color: 'muted',
    });
    const lista = r.proporcional && maxProporcionais ? r.candidatos.slice(0, Math.max(maxProporcionais, 20)) : r.candidatos;
    b.push({
      type: 'table',
      widths: [0.08, 0.44, 0.1, 0.14, 0.12, 0.12],
      header: ['Pos.', 'Candidato', 'Número', 'Partido', 'Votos', '% válidos'],
      headerAlign: ['center', 'left', 'center', 'left', 'right', 'right'],
      rows: lista.map((x) => [
        { text: `${x.posicao}º`, align: 'center' },
        x.nome,
        { text: x.numero, align: 'center' },
        x.partido,
        { text: num(x.votos), align: 'right' },
        { text: pct(x.pctValidos), align: 'right' },
      ]),
    });
    if (lista.length < r.candidatos.length) b.push({ type: 'note', text: `Mostrando os ${lista.length} mais votados de ${r.candidatos.length} candidatos. O Excel traz todos.` });

    // votos por local: locais nas linhas, até 4 candidatos por tabela
    const m = matriz(f.votos, c, 'local');
    const cands = r.proporcional && maxProporcionais ? m.linhas.slice(0, maxProporcionais) : m.linhas;
    for (let i = 0; i < cands.length; i += 4) {
      const grupo = cands.slice(i, i + 4);
      const ultimo = i + 4 >= cands.length;
      b.push({ type: 'para', text: `${c} · votos por local de votação${cands.length > 4 ? ` (${i + 1}–${i + grupo.length} de ${cands.length})` : ''}`, size: 9, color: 'muted', gapAfter: 2 });
      b.push({
        type: 'table',
        widths: [0.36, ...grupo.map(() => 0.64 / (grupo.length + (ultimo ? 1 : 0))), ...(ultimo ? [0.64 / (grupo.length + 1)] : [])],
        header: ['Local de votação', ...grupo.map((g) => `${g.nome} (${g.numero})`), ...(ultimo ? ['Válidos no local'] : [])],
        headerAlign: ['left', ...grupo.map(() => 'right'), ...(ultimo ? ['right'] : [])],
        rows: [
          ...m.colunas.map((k, ci) => [
            k.nome,
            ...grupo.map((g) => ({ text: num(g.votosCol[ci]), align: 'right' })),
            ...(ultimo ? [{ text: num(m.validosCol[ci]), align: 'right' }] : []),
          ]),
          [
            { text: 'Total', bold: true },
            ...grupo.map((g) => ({ text: num(g.votos), align: 'right', bold: true })),
            ...(ultimo ? [{ text: num(m.resultado.validos), align: 'right', bold: true }] : []),
          ],
        ],
        totalRows: 1,
      });
    }
  }
  b.push({ type: 'note', text: 'Fonte: Tribunal Superior Eleitoral (TSE), dados abertos por seção eleitoral. Seções agregadas não entram nos totais de comparecimento.' });
  return b;
}
