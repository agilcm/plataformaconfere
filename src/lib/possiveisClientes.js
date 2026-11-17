// Abas "Possíveis clientes" e "Campeões": montam as listas a partir do que scripts/possiveis-clientes.mjs leu das atas.
//   Possíveis clientes  empresas das cidades escolhidas que disputaram e ficaram do 2º ao 5º lugar (ou ofertaram o
//                       melhor preço e não levaram);
//   Campeões            quem ganhou e levou cada item, de qualquer cidade.
// Puro: sem rede, para testar.

/** Até que colocação a empresa entra em Possíveis clientes */
export const MAX_COLOCACAO = 5;

export const normCidade = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Nome de MEI costuma trazer o CPF do titular ("FULANO DE TAL 12345678901"): os números saem */
export function nomeSemCpf(nome) {
  return String(nome || '')
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '')
    .replace(/^\d{2}\.\d{3}\.\d{3}\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Licitação por maior desconto: os lances são percentuais e a vencedora tem o maior. Sai da ordem das colocações (a
 * 1ª com valor maior que a 2ª) e de todos os valores estarem entre 0 e 100. Com um só participante não dá para saber.
 */
export function ehDesconto(it) {
  const ord = (it.c || []).filter((x) => x[1] >= 1).sort((a, b) => a[1] - b[1]);
  if (ord.length < 2) return false;
  return ord[0][2] > ord[1][2] && it.c.every((x) => x[2] >= 0 && x[2] <= 100);
}

/** Célula da planilha: no maior desconto o valor é percentual (número comum, não moeda) */
const celulaValor = (v, desconto) => (desconto && v != null && v !== '' ? { v, tipo: 'numero' } : v);

export const cnpjFormatado = (c) => String(c || '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

/** Texto da colocação: 0 = ofertou melhor que a vencedora e não levou */
export const textoColocacao = (col) => (col === 0 ? 'Melhor preço, não levou' : `${col}º lugar`);

/**
 * @param {{ compras: Record<string, any>, cnpj: Record<string, any> }} cache
 * @param {{ nome: string, uf: string }[]} cidades
 * @param {Record<string, any>} [meta]
 */
export function montarClientes(cache, cidades, meta = {}) {
  const alvo = new Map(cidades.map((c) => [`${normCidade(c.nome)}|${c.uf}`, c.nome]));
  const licitacoes = [];
  const empresas = new Map();
  let disputas = 0;
  for (const [id, c] of Object.entries(cache.compras || {}).sort((a, b) => String(b[1].data).localeCompare(String(a[1].data)))) {
    if (!c.itens?.length) continue;
    let iLic = -1;
    for (const it of c.itens) {
      for (const [cnpj, col, melhor, lances, nomeAta] of it.c) {
        const cad = cache.cnpj?.[cnpj];
        const cidade = cad && alvo.get(`${normCidade(cad.m)}|${cad.u}`);
        if (!cidade) continue;
        if (!empresas.has(cnpj))
          empresas.set(cnpj, {
            cnpj,
            razao: nomeSemCpf(cad.r || nomeAta),
            fantasia: nomeSemCpf(cad.f),
            cidade,
            uf: cad.u,
            porte: cad.p || '',
            atividade: cad.a || '',
            situacao: cad.s || '',
            vitorias: 0,
            disputas: [],
          });
        const e = empresas.get(cnpj);
        if (col === 1 && it.v != null) {
          e.vitorias++;
          continue;
        }
        // sem vencedora identificada, o menor lance não é "2º lugar": fica de fora
        if (col === 1 || col > MAX_COLOCACAO) continue;
        if (iLic < 0) {
          iLic = licitacoes.length;
          licitacoes.push({ id, orgao: c.orgao, municipio: c.municipio, uf: c.uf, titulo: c.titulo, objeto: c.objeto, modalidade: c.modalidade, data: c.data });
        }
        e.disputas.push({
          lic: iLic,
          item: it.n,
          desc: it.d,
          col,
          melhor,
          venc: it.v,
          lances,
          participantes: it.c.length,
          // valor total que a vencedora levou no item (segundo a ata)
          ...(it.t != null ? { vt: it.t } : {}),
          ...(it.l ? { lote: true } : {}),
          ...(ehDesconto(it) ? { desconto: true } : {}),
        });
        disputas++;
      }
    }
  }
  const perto = (e) => e.disputas.filter((d) => d.col >= 2 && d.col <= MAX_COLOCACAO).length;
  const lista = [...empresas.values()]
    .filter((e) => e.disputas.length)
    .sort((a, b) => perto(b) - perto(a) || b.disputas.length - a.disputas.length || a.razao.localeCompare(b.razao, 'pt-BR'));
  return {
    ...meta,
    cidades: cidades.map((c) => c.nome),
    resumo: { empresas: lista.length, disputas, licitacoes: licitacoes.length },
    licitacoes,
    empresas: lista,
  };
}

/** Quanto o melhor lance da empresa ficou do valor da vencedora, em % (positivo = mais caro) */
export function diferenca(d) {
  // no maior desconto os valores já são percentuais: a diferença em % de % confunde mais do que ajuda
  if (d.desconto || d.venc == null || !d.venc || d.melhor == null) return null;
  return ((d.melhor - d.venc) / d.venc) * 100;
}

/**
 * Filtra as empresas e as disputas de cada uma.
 * @param {any} dados  saída de montarClientes
 * @param {{ cidade?: string, colocacoes?: number[], q?: string, municipio?: string }} f  colocacoes: [] = todas
 */
export function filtrarClientes(dados, f = {}) {
  const termos = normCidade(f.q || '')
    .split(' ')
    .filter(Boolean);
  const cols = new Set(f.colocacoes || []);
  const out = [];
  for (const e of dados.empresas || []) {
    if (f.cidade && e.cidade !== f.cidade) continue;
    const disputas = e.disputas.filter((d) => {
      if (cols.size && !cols.has(d.col)) return false;
      const lic = dados.licitacoes[d.lic];
      if (f.municipio && lic.municipio !== f.municipio) return false;
      if (!termos.length) return true;
      const texto = normCidade(`${e.razao} ${e.fantasia} ${e.cnpj} ${e.atividade} ${d.desc} ${lic.orgao} ${lic.municipio} ${lic.objeto}`);
      return termos.every((t) => texto.includes(t));
    });
    if (disputas.length) out.push({ ...e, disputas });
  }
  return out;
}

/** Linhas da planilha (uma por item disputado) */
export function linhasPlanilha(dados, empresas) {
  const linhas = [];
  for (const e of empresas)
    for (const d of e.disputas) {
      const lic = dados.licitacoes[d.lic];
      const dif = diferenca(d);
      linhas.push({
        Empresa: e.razao,
        CNPJ: cnpjFormatado(e.cnpj),
        'Cidade da empresa': `${e.cidade} - ${e.uf}`,
        Porte: e.porte,
        'Atividade principal': e.atividade,
        Colocação: textoColocacao(d.col),
        Item: d.lote ? `Lote ${Number(d.item) || d.item}` : d.item,
        'Descrição do item': d.desc,
        Critério: d.desconto ? 'Maior desconto (%)' : 'Menor preço (R$)',
        'Melhor lance': celulaValor(d.melhor, d.desconto),
        'Valor da vencedora': celulaValor(d.venc ?? '', d.desconto),
        'Diferença (%)': dif == null ? '' : Math.round(dif * 10) / 10,
        'Empresas no item': d.participantes,
        Órgão: lic.orgao,
        'Cidade da licitação': `${lic.municipio} - ${lic.uf}`,
        Licitação: lic.titulo,
        Objeto: lic.objeto,
        Data: lic.data.split('-').reverse().join('/'),
        'Link no PNCP': `https://pncp.gov.br/app/editais/${lic.id}`,
      });
    }
  return linhas;
}

const tituloCidade = (m) =>
  String(m || '')
    .toLowerCase()
    .replace(/(^|\s)(\S)/g, (x) => x.toUpperCase())
    .replace(/ (De|Da|Do|Das|Dos|E) /g, (x) => x.toLowerCase());

/**
 * Campeões: quem ganhou e levou cada item (a vencedora da ata), de qualquer cidade.
 * @param {{ compras: Record<string, any>, cnpj: Record<string, any> }} cache
 * @param {{ nome: string, uf: string }[]} cidades  as cidades escolhidas (marcadas em cada empresa)
 * @param {Record<string, any>} [meta]
 * @param {{ nomeCidade?: (municipio: string, uf: string) => string }} [o]  nome da cidade com acento
 */
export function montarCampeoes(cache, cidades, meta = {}, o = {}) {
  const alvo = new Map(cidades.map((c) => [`${normCidade(c.nome)}|${c.uf}`, c.nome]));
  const nomeCidade = o.nomeCidade || tituloCidade;
  const licitacoes = [];
  const iLic = new Map();
  const empresas = new Map();
  let itens = 0;
  for (const [id, c] of Object.entries(cache.compras || {}).sort((a, b) => String(b[1].data).localeCompare(String(a[1].data)))) {
    for (const it of c.itens || []) {
      if (it.v == null) continue; // sem vencedora identificada na ata
      const venc = it.c.find((x) => x[1] === 1);
      if (!venc) continue;
      const [cnpj, , melhor, , nomeAta] = venc;
      const cad = cache.cnpj?.[cnpj] || {};
      if (!empresas.has(cnpj)) {
        const daLista = cad.m ? alvo.get(`${normCidade(cad.m)}|${cad.u}`) : undefined;
        empresas.set(cnpj, {
          cnpj,
          razao: nomeSemCpf(cad.r || nomeAta),
          fantasia: nomeSemCpf(cad.f),
          cidade: daLista || (cad.m ? nomeCidade(cad.m, cad.u) : ''),
          uf: cad.u || '',
          alvo: !!daLista,
          porte: cad.p || '',
          atividade: cad.a || '',
          situacao: cad.s || '',
          total: 0,
          vitorias: [],
        });
      }
      if (!iLic.has(id)) {
        iLic.set(id, licitacoes.length);
        licitacoes.push({ id, orgao: c.orgao, municipio: c.municipio, uf: c.uf, titulo: c.titulo, objeto: c.objeto, modalidade: c.modalidade, data: c.data });
      }
      const e = empresas.get(cnpj);
      e.vitorias.push({
        lic: iLic.get(id),
        item: it.n,
        desc: it.d,
        valor: melhor,
        total: it.t ?? null,
        participantes: it.c.length,
        ...(it.l ? { lote: true } : {}),
        ...(ehDesconto(it) ? { desconto: true } : {}),
      });
      if (it.t != null) e.total += it.t;
      itens++;
    }
  }
  const lista = [...empresas.values()]
    .map((e) => ({ ...e, total: Math.round(e.total * 100) / 100 }))
    .sort((a, b) => b.vitorias.length - a.vitorias.length || b.total - a.total || a.razao.localeCompare(b.razao, 'pt-BR'));
  return {
    ...meta,
    cidades: cidades.map((c) => c.nome),
    resumo: { empresas: lista.length, itens, licitacoes: licitacoes.length },
    licitacoes,
    empresas: lista,
  };
}

/**
 * @param {any} dados  saída de montarCampeoes
 * @param {{ cidade?: string, q?: string }} f  cidade: '' = todas; '*' = só as cidades escolhidas; ou o nome de uma delas
 */
export function filtrarCampeoes(dados, f = {}) {
  const termos = normCidade(f.q || '')
    .split(' ')
    .filter(Boolean);
  const out = [];
  for (const e of dados.empresas || []) {
    if (f.cidade === '*' ? !e.alvo : f.cidade && e.cidade !== f.cidade) continue;
    const vitorias = e.vitorias.filter((v) => {
      if (!termos.length) return true;
      const lic = dados.licitacoes[v.lic];
      const texto = normCidade(`${e.razao} ${e.fantasia} ${e.cnpj} ${e.cidade} ${e.atividade} ${v.desc} ${lic.orgao} ${lic.municipio} ${lic.objeto}`);
      return termos.every((t) => texto.includes(t));
    });
    if (vitorias.length) out.push({ ...e, vitorias, total: Math.round(vitorias.reduce((s, v) => s + (v.total || 0), 0) * 100) / 100 });
  }
  return out;
}

/** Linhas da planilha dos campeões (uma por item ganho) */
export function linhasPlanilhaCampeoes(dados, empresas) {
  const linhas = [];
  for (const e of empresas)
    for (const v of e.vitorias) {
      const lic = dados.licitacoes[v.lic];
      linhas.push({
        Empresa: e.razao,
        CNPJ: cnpjFormatado(e.cnpj),
        'Cidade da empresa': e.cidade ? `${e.cidade} - ${e.uf}` : '',
        Porte: e.porte,
        'Atividade principal': e.atividade,
        Item: v.lote ? `Lote ${Number(v.item) || v.item}` : v.item,
        'Descrição do item': v.desc,
        Critério: v.desconto ? 'Maior desconto (%)' : 'Menor preço (R$)',
        'Valor vencedor': celulaValor(v.valor, v.desconto),
        'Valor total ganho': v.total ?? '',
        'Empresas no item': v.participantes,
        Órgão: lic.orgao,
        'Cidade da licitação': `${lic.municipio} - ${lic.uf}`,
        Licitação: lic.titulo,
        Objeto: lic.objeto,
        Data: lic.data.split('-').reverse().join('/'),
        'Link no PNCP': `https://pncp.gov.br/app/editais/${lic.id}`,
      });
    }
  return linhas;
}
