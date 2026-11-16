// Aba "Possíveis clientes": monta a lista de empresas das cidades escolhidas que disputaram licitações e não venceram,
// a partir do que scripts/possiveis-clientes.mjs leu das atas. Puro: sem rede, para testar.

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
        if (col === 1) continue;
        if (iLic < 0) {
          iLic = licitacoes.length;
          licitacoes.push({ id, orgao: c.orgao, municipio: c.municipio, uf: c.uf, titulo: c.titulo, objeto: c.objeto, modalidade: c.modalidade, data: c.data });
        }
        e.disputas.push({ lic: iLic, item: it.n, desc: it.d, col, melhor, venc: it.v, lances, participantes: it.c.length, ...(it.l ? { lote: true } : {}) });
        disputas++;
      }
    }
  }
  const perto = (e) => e.disputas.filter((d) => d.col >= 2 && d.col <= 4).length;
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
  if (d.venc == null || !d.venc || d.melhor == null) return null;
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
        'Melhor lance': d.melhor,
        'Valor da vencedora': d.venc ?? '',
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
