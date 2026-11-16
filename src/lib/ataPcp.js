// Leitor da "Ata Final" do Portal de Compras Públicas (o PDF que o portal anexa no PNCP depois da sessão).
// A ata traz, por item, todas as propostas e lances com o CNPJ de quem ofertou: é daí que sai a classificação
// (o PNCP só registra o vencedor). Puro: recebe as linhas de texto do PDF, sem rede.

const RE_DATA = /^(\d{2})\/(\d{2})\/(\d{4}) - (\d{2}):(\d{2}):(\d{2})$/;
const RE_CNPJ = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/;
const RE_ITEM = /^(?:lote\s+)?(\d{3,5}) - (.+)$/i;
const SECOES =
  /^(Itens Licitados|Documentos Anexados ao Processo|Mensagens Enviadas pelo Pregoeiro|Vencedores|Propostas Enviadas|Validade das Propostas|Lances Enviados|Documentos dos Fornecedores|Prazos|Chat|Recursos|Inabilitados|Desclassificados)$/;
const RODAPE =
  /^(Página \d+ de \d+|A autenticidade do documento pode ser verificada|Documento gerado eletronicamente no Portal de Compras|Código verificador:)/;

const numero = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
const soDigitos = (s) => String(s || '').replace(/\D/g, '');
const semAcento = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();

/** É a ata final do Portal de Compras Públicas? */
export function ehAtaPcp(linhas) {
  const inicio = linhas.slice(0, 40).join('\n');
  return /ATA (FINAL|PARCIAL)/.test(inicio) && linhas.some((l) => /^Lances Enviados$/.test(l.trim()));
}

/**
 * Lê a seção "Lances Enviados" e a tabela "Vencedores".
 * @param {string[]} linhas  linhas de texto do PDF, na ordem de leitura (colunas separadas por 3 espaços ou mais)
 * No julgamento por lote, cada "item" devolvido é um lote (lote: true) e a vencedora vem pelo CNPJ.
 * @returns {{ orgao: string, itens: { codigo: string, descricao: string, lances: { quando: string, valor: number, proposta: boolean, cnpj: string, nome: string, situacao: string }[], vencedorNome: string, vencedorValor: number | null }[] }}
 */
export function lerAtaPcp(linhas) {
  const L = linhas.map((l) => String(l).replace(/ /g, ' ').trim()).filter((l) => l && !RODAPE.test(l));
  const iAta = L.findIndex((l) => /^ATA (FINAL|PARCIAL)$/.test(l));
  const orgao = iAta >= 0 ? L[iAta + 1] || '' : '';

  // seção -> linhas
  const secoes = {};
  let atual = '';
  for (const l of L) {
    if (SECOES.test(l)) {
      atual = l;
      secoes[atual] ??= [];
    } else if (atual) secoes[atual].push(l);
  }

  // Lances Enviados: "0001 - descrição" ... "Data Valor CNPJ Situação" ... uma linha por lance (o nome continua nas linhas seguintes)
  const itens = [];
  let item = null;
  let naDescricao = false;
  let ultimo = null;
  for (const l of secoes['Lances Enviados'] || []) {
    const partes = l.split(/\s{3,}/);
    const mData = RE_DATA.exec(partes[0]);
    if (mData && item) {
      naDescricao = false;
      ultimo = null;
      const iCnpj = partes.findIndex((p) => RE_CNPJ.test(p));
      if (iCnpj < 0) continue; // pessoa física (CPF) ou linha fora do padrão: fica de fora
      const mValor = /(-?[\d.]+,\d+)\s*(\(proposta\))?/.exec(partes.slice(1, iCnpj).join(' '));
      if (!mValor) continue;
      const [, cnpj] = RE_CNPJ.exec(partes[iCnpj]);
      ultimo = {
        quando: `${mData[3]}-${mData[2]}-${mData[1]}T${mData[4]}:${mData[5]}:${mData[6]}`,
        valor: numero(mValor[1]),
        proposta: !!mValor[2],
        cnpj: soDigitos(cnpj),
        nome: partes[iCnpj]
          .replace(RE_CNPJ, '')
          .replace(/^\s*-\s*/, '')
          .trim(),
        situacao:
          partes
            .slice(iCnpj + 1)
            .join(' ')
            .trim() || 'Válido',
      };
      item.lances.push(ultimo);
      continue;
    }
    if (/^Data\s+Valor\s+CNPJ\s+Situação$/.test(l.replace(/\s+/g, ' '))) {
      naDescricao = false;
      continue;
    }
    const mItem = RE_ITEM.exec(l);
    if (mItem) {
      // um cabeçalho novo só vale se o item anterior já teve a tabela de lances (ou se é o primeiro)
      if (!item || !naDescricao) {
        item = { codigo: mItem[1], descricao: mItem[2].trim(), lances: [], vencedorNome: '', vencedorValor: null, vencedorCnpj: '', lote: false };
        itens.push(item);
        naDescricao = true;
        ultimo = null;
        continue;
      }
    }
    if (naDescricao && item) item.descricao += ` ${l}`;
    else if (ultimo && partes.length === 1) ultimo.nome = `${ultimo.nome} ${l}`.trim(); // continuação do nome
  }

  // Vencedores, julgamento por item: a linha de cada item começa com o código e termina em "valor   quantidade   total"
  // Vencedores, julgamento por lote: cada vencedora vem num cabeçalho com "Documento <CNPJ>", seguido da tabela
  // "Lote Item Produto…", da linha do lote (código + descrição) e de "TOTAL DO LOTE R$ …"
  const porCodigo = new Map(itens.map((i) => [i.codigo, i]));
  let cnpjVenc = '';
  let esperaLote = false;
  let lote = null;
  for (const l of secoes['Vencedores'] || []) {
    const partes = l.split(/\s{3,}/);
    const mDoc = /Documento\s+(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/.exec(l);
    if (mDoc) {
      cnpjVenc = soDigitos(mDoc[1]);
      lote = null;
      continue;
    }
    if (/^Lote\s+Item\s+Produto/.test(l)) {
      esperaLote = true;
      continue;
    }
    const mTotal = /^TOTAL DO LOTE\s+R\$\s*([\d.]+,\d{2})/.exec(l);
    if (mTotal) {
      if (lote) lote.vencedorValor = numero(mTotal[1]);
      esperaLote = true; // a mesma vencedora pode ter outro lote em seguida
      continue;
    }
    if (/^TOTAL DO VENCEDOR/.test(l)) {
      esperaLote = false;
      continue;
    }
    if (esperaLote && /^\d{3,5}$/.test(partes[0]) && !/R\$/.test(l)) {
      lote = porCodigo.get(partes[0]) || null;
      if (lote && cnpjVenc) {
        lote.vencedorCnpj = cnpjVenc;
        lote.lote = true;
      }
      esperaLote = false;
      continue;
    }
    const it = /^\d{3,5}$/.test(partes[0]) ? porCodigo.get(partes[0]) : null;
    if (!it || partes.length < 6) continue;
    const valores = partes.filter((p) => /^[\d.]+,\d{2,4}$/.test(p));
    if (valores.length < 2) continue;
    it.vencedorValor = numero(valores[0]);
    it.vencedorNome = partes[2] || '';
  }
  return { orgao, itens };
}

/** Os lances sobem (maior desconto, maior oferta) em vez de descer? Olha a sequência de cada empresa. */
export function lancesSobem(lances) {
  const porEmpresa = new Map();
  let sobe = 0;
  let desce = 0;
  for (const l of [...lances].sort((a, b) => a.quando.localeCompare(b.quando))) {
    const ant = porEmpresa.get(l.cnpj);
    if (ant != null && !l.proposta) {
      if (l.valor > ant) sobe++;
      else if (l.valor < ant) desce++;
    }
    porEmpresa.set(l.cnpj, l.valor);
  }
  return sobe > desce;
}

/**
 * Classificação de um item pelo melhor lance válido de cada empresa.
 * `colocacao`: 1 para a vencedora; 2, 3, 4… para quem veio depois dela; 0 para quem ofertou melhor que a vencedora e
 * não levou (desclassificada, inabilitada ou desistente). Sem vencedora identificada, vale a ordem dos lances.
 * @returns {{ cnpj: string, nome: string, melhor: number, lances: number, ordem: number, colocacao: number, venceu: boolean }[]}
 */
export function classificarItem(item) {
  const validos = item.lances.filter((l) => /v[aá]lido/i.test(l.situacao) && !/inv[aá]lido/i.test(l.situacao));
  if (!validos.length) return [];
  const sobe = lancesSobem(validos);
  const melhor = new Map();
  for (const l of validos) {
    const m = melhor.get(l.cnpj);
    const ganha = !m || (sobe ? l.valor > m.melhor : l.valor < m.melhor) || (l.valor === m.melhor && l.quando < m.quando);
    if (ganha)
      melhor.set(l.cnpj, {
        cnpj: l.cnpj,
        nome: m?.nome && m.nome.length >= l.nome.length ? m.nome : l.nome,
        melhor: l.valor,
        quando: l.quando,
        lances: (m?.lances || 0) + 1,
      });
    else m.lances++;
  }
  const ordem = [...melhor.values()].sort((a, b) => (sobe ? b.melhor - a.melhor : a.melhor - b.melhor) || a.quando.localeCompare(b.quando));

  // vencedora: o nome da tabela "Vencedores" é o começo da razão social; no empate de nomes, a de valor mais próximo
  let iVenc = item.vencedorCnpj ? ordem.findIndex((e) => e.cnpj === item.vencedorCnpj) : -1;
  const alvo = semAcento(item.vencedorNome).replace(/\s+/g, ' ').trim();
  if (iVenc < 0 && alvo) {
    const candidatos = ordem.map((e, i) => ({ i, e })).filter(({ e }) => semAcento(e.nome).replace(/\s+/g, ' ').startsWith(alvo));
    if (candidatos.length === 1) iVenc = candidatos[0].i;
    else if (candidatos.length > 1 && item.vencedorValor != null)
      iVenc = candidatos.sort((a, b) => Math.abs(a.e.melhor - item.vencedorValor) - Math.abs(b.e.melhor - item.vencedorValor))[0].i;
  }
  return ordem.map((e, i) => ({
    cnpj: e.cnpj,
    nome: e.nome,
    melhor: e.melhor,
    lances: e.lances,
    ordem: i + 1,
    colocacao: iVenc < 0 ? i + 1 : i < iVenc ? 0 : i - iVenc + 1,
    venceu: i === iVenc,
  }));
}

/** Descrição curta do item (a ata repete o termo de referência inteiro) */
export function descricaoCurta(descricao, max = 110) {
  const t = String(descricao || '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, '')}…` : t;
}
