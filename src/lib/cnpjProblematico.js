// Consulta CNPJ → "CNPJ problemático": empresas das cidades escolhidas (src/data/problematicosConfig.js) com o CNPJ
// inapto ou excluídas do Simples ou do MEI no ano da base da Receita ou no anterior, com sócios, contato e o motivo
// provável. A Receita não publica o motivo da exclusão na base aberta (só a Consulta Optantes do Portal do Simples, por
// CNPJ e com captcha), então ele é deduzido pelo que aconteceu com a empresa. Regras puras: o script
// scripts/cnpj-problematico.mjs monta a lista e a página src/pages/CnpjProblematico.tsx mostra, filtra e exporta.

import { telefonesDe } from './contatoCnpj.js';

export const CLASSES = {
  problema: 'Problema (ato administrativo)',
  crescimento: 'Crescimento (faturamento)',
  verificar: 'Verificar',
};
export const PRIORIDADES = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const ORDEM_CLASSE = { problema: 0, verificar: 1, crescimento: 2 };
const ORDEM_PRIORIDADE = { alta: 0, media: 1, baixa: 2 };

export const SITUACOES = { '01': 'Nula', '02': 'Ativa', '03': 'Suspensa', '04': 'Inapta', '08': 'Baixada' };
export const PORTES = { '00': 'Não informado', '01': 'Microempresa', '03': 'Empresa de pequeno porte', '05': 'Demais' };
export const FAIXAS = {
  0: 'Não se aplica',
  1: 'Até 12 anos',
  2: '13 a 20 anos',
  3: '21 a 30 anos',
  4: '31 a 40 anos',
  5: '41 a 50 anos',
  6: '51 a 60 anos',
  7: '61 a 70 anos',
  8: '71 a 80 anos',
  9: 'Mais de 80 anos',
};

// ---------------------------------------------------------------- formatos

/** "20261231" → "2026-12-31"; vazio para data nula ("00000000", "0", "") */
export const dataIso = (s) => {
  const v = String(s || '').trim();
  return /^\d{8}$/.test(v) && !v.startsWith('0000') ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}` : '';
};
/** "2026-12-31" → "31/12/2026" */
export const dataBr = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
const dias = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400e3;

/** CPF mascarado como a Receita publica ("***654321**") → "***.654.321-**"; CNPJ de sócio PJ formatado */
export function docMascarado(d) {
  const v = String(d || '').trim();
  if (/^\*{3}\d{6}\*{2}$/.test(v)) return `***.${v.slice(3, 6)}.${v.slice(6, 9)}-**`;
  if (/^\d{14}$/.test(v)) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
  return v;
}

/** Empresário individual/MEI antigo: a Receita grava o CPF no fim do nome. Fica só a parte do meio, mascarada. */
export function titularCpf(nome) {
  const m = /(\d{11})\s*$/.exec(String(nome || ''));
  return m ? `***.${m[1].slice(3, 6)}.${m[1].slice(6, 9)}-**` : '';
}
/** Nome empresarial sem o CPF do fim (empresário individual) */
export const semCpf = (nome) =>
  String(nome || '')
    .replace(/\s*\d{11}\s*$/, '')
    .trim();
/** Nome do titular do MEI: sem o CNPJ do começo ("11.222.333 FULANA DE TAL ...") e sem o CPF do fim */
export const nomeTitular = (nome) => semCpf(nome).replace(/^\d{2}\.\d{3}\.\d{3}\s+/, '');

/** Telefone "ddd + número" só com dígitos; vazio se não houver número */
export function telefone(ddd, numero) {
  const n = String(numero || '').replace(/\D/g, '');
  if (!n) return '';
  return String(ddd || '').replace(/\D/g, '') + n;
}

/** E-mail que parece ser do contador da empresa (sinal de que ela já tem contabilidade) */
export const emailDeContador = (email) => /contab|contador|cont[aá]bil|escritorio|escritório|assessoria|fiscal|consultoria/i.test(String(email || ''));

export const individual = (natureza) => /Empres[aá]rio|Individual/i.test(String(natureza || ''));

// ---------------------------------------------------------------- motivo provável

/**
 * Motivo provável da saída do MEI.
 * @param {{ situacao: string, dataSituacao: string, motivoSituacao: string }} est
 * @param {{ opcao: string, dataExclusao: string, dataExclusaoMei: string }} s
 * @param {string} naturezaNome
 * @returns {{ classe: 'problema' | 'crescimento' | 'verificar', motivo: string }}
 */
export function motivoMei(est, s, naturezaNome) {
  const dm = s.dataExclusaoMei;
  const ds = s.dataExclusao;
  if (est.situacao === '04' && est.dataSituacao && dias(est.dataSituacao, dm) <= 45)
    return { classe: 'problema', motivo: `Saiu do MEI quando o CNPJ foi declarado inapto (${(est.motivoSituacao || 'motivo não informado').toLowerCase()})` };
  if (ds && ds === dm) return { classe: 'problema', motivo: 'Excluído do MEI e do Simples na mesma data, de ofício (em geral por débitos ou irregularidade)' };
  if (s.opcao === 'S') {
    let motivo = 'Saiu do MEI e continua no Simples como ME: faturamento acima do limite, entrada de sócio, filial ou atividade não permitida ao MEI';
    if (naturezaNome && !individual(naturezaNome)) motivo += `. Hoje é ${naturezaNome}`;
    return { classe: 'crescimento', motivo };
  }
  if (ds && ds > dm) return { classe: 'problema', motivo: `Saiu do MEI e depois foi excluído também do Simples, em ${dataBr(ds)}` };
  return { classe: 'verificar', motivo: 'Saiu do MEI e não está no Simples; confirmar na Consulta Optantes' };
}

/**
 * Motivo provável da exclusão do Simples.
 * @returns {{ classe: 'problema' | 'verificar', motivo: string }}
 */
export function motivoSimples(est, s) {
  const ds = s.dataExclusao;
  const voltou = s.dataOpcao && s.dataOpcao > ds && s.opcao === 'S' ? ` Já voltou ao Simples em ${dataBr(s.dataOpcao)}.` : '';
  if (est.situacao === '04' && est.dataSituacao && dias(est.dataSituacao, ds) <= 45)
    return {
      classe: 'problema',
      motivo: `Excluído do Simples quando o CNPJ foi declarado inapto (${(est.motivoSituacao || 'motivo não informado').toLowerCase()}).${voltou}`,
    };
  if (s.dataExclusaoMei && s.dataExclusaoMei === ds)
    return { classe: 'problema', motivo: `Excluído do Simples e do MEI na mesma data, de ofício (em geral por débitos).${voltou}` };
  if (ds.endsWith('-12-31'))
    return {
      classe: 'problema',
      motivo: `Exclusão com efeito em 1º de janeiro: em geral a exclusão anual de ofício por débitos; pode também ter sido pedido da empresa.${voltou}`,
    };
  return { classe: 'verificar', motivo: `Exclusão no meio do ano: pedido da empresa, mudança de atividade, excesso de receita ou ato de ofício.${voltou}` };
}

/**
 * Os casos de um estabelecimento: inapto, excluído do Simples e/ou do MEI nos anos pedidos (só empresas ainda abertas
 * entram pelas exclusões). Vazio se não houver nenhum.
 * @param {{ situacao: string, dataSituacao: string, motivoSituacao: string }} est
 * @param {{ opcao: string, dataOpcao: string, dataExclusao: string, mei: string, dataOpcaoMei: string, dataExclusaoMei: string } | null} s
 * @param {string} naturezaNome
 * @param {string[]} anos  ex.: ['2025', '2026']
 */
export function casosDe(est, s, naturezaNome, anos) {
  const casos = [];
  if (est.situacao === '04')
    casos.push({
      tipo: 'inapta',
      data: est.dataSituacao,
      classe: 'problema',
      motivo: `CNPJ inapto desde ${dataBr(est.dataSituacao)}: ${(est.motivoSituacao || 'motivo não informado').toLowerCase()}`,
    });
  const aberta = ['02', '03', '04'].includes(est.situacao);
  if (s && aberta) {
    if (s.dataExclusao && anos.includes(s.dataExclusao.slice(0, 4))) casos.push({ tipo: 'simples', data: s.dataExclusao, ...motivoSimples(est, s) });
    if (s.dataExclusaoMei && anos.includes(s.dataExclusaoMei.slice(0, 4)))
      casos.push({ tipo: 'mei', data: s.dataExclusaoMei, ...motivoMei(est, s, naturezaNome) });
  }
  return casos;
}

/** A classe mais grave entre os casos */
export const classeDe = (casos) => casos.map((c) => c.classe).sort((a, b) => ORDEM_CLASSE[a] - ORDEM_CLASSE[b])[0] || 'verificar';

/**
 * Alta: problema e com telefone ou e-mail que não é de contador. Média: problema com e-mail de contador, ou crescimento
 * sem contador. Baixa: o resto.
 */
export function prioridadeDe(r) {
  const contato = Boolean(r.tel1 || r.tel2 || r.email);
  const contador = emailDeContador(r.email);
  if (r.classe === 'problema' && contato) return contador ? 'media' : 'alta';
  if (r.classe === 'crescimento' && contato && !contador) return 'media';
  return 'baixa';
}

export const rotuloCaso = (c) =>
  c.tipo === 'inapta' ? 'CNPJ inapto' : c.tipo === 'simples' ? `Excluída do Simples em ${dataBr(c.data)}` : `Excluída do MEI em ${dataBr(c.data)}`;

// ---------------------------------------------------------------- lista na página

export function ordemProblematicos(a, b) {
  return (
    ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade] ||
    ORDEM_CLASSE[a.classe] - ORDEM_CLASSE[b.classe] ||
    a.cidade.localeCompare(b.cidade, 'pt-BR') ||
    a.razao.localeCompare(b.razao, 'pt-BR')
  );
}

const semAcento = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Texto em que a busca procura: CNPJ, nomes, sócios, e-mail, telefones e atividade */
export function textoBuscaProblematico(r, cnae = {}) {
  return semAcento(
    [r.cnpj, r.razao, r.fantasia, r.email, r.tel1, r.tel2, r.cnae, cnae[r.cnae], r.bairro, ...(r.socios || []).map((s) => s.nome)].filter(Boolean).join(' '),
  );
}

/**
 * @param {{ empresas: any[], cnae?: Record<string, string> }} dados
 * @param {{ q?: string, cidade?: string, classe?: string, caso?: string, prioridade?: string, telefone?: boolean, email?: boolean, semContador?: boolean }} f
 *   caso: 'inapta' | 'simples' | 'mei' | 'simples-AAAA' | 'mei-AAAA'
 * @param {Map<any, string>} [indice]  texto de busca de cada registro (textoBuscaProblematico)
 */
export function filtrarProblematicos(dados, f, indice) {
  const q = semAcento(f.q || '').trim();
  const dig = q.replace(/\D/g, '');
  const termos = q.split(/\s+/).filter(Boolean);
  return dados.empresas.filter((r) => {
    if (f.cidade && r.cidade !== f.cidade) return false;
    if (f.classe && r.classe !== f.classe) return false;
    if (f.prioridade && r.prioridade !== f.prioridade) return false;
    if (f.telefone && !(r.tel1 || r.tel2)) return false;
    if (f.email && !r.email) return false;
    if (f.semContador && emailDeContador(r.email)) return false;
    if (f.caso) {
      const [tipo, ano] = f.caso.split('-');
      if (!r.casos.some((c) => c.tipo === tipo && (!ano || c.data.startsWith(ano)))) return false;
    }
    if (q) {
      if (dig.length >= 8 && r.cnpj.includes(dig)) return true;
      const t = indice?.get(r) ?? textoBuscaProblematico(r, dados.cnae);
      return termos.every((x) => t.includes(x));
    }
    return true;
  });
}

/** Mensagem do WhatsApp/e-mail, conforme o caso mais grave */
export function mensagemProblematico(r) {
  const nome = (r.socios?.[0]?.nome || nomeTitular(r.razao) || '').split(' ')[0];
  const ola = nome ? `Olá, ${nome[0]}${nome.slice(1).toLowerCase()}!` : 'Olá!';
  const quem = `a ${semCpf(r.razao)} (CNPJ ${r.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')})`;
  const inapta = r.casos.find((c) => c.tipo === 'inapta');
  const simples = r.casos.find((c) => c.tipo === 'simples');
  const mei = r.casos.find((c) => c.tipo === 'mei');
  let fato;
  if (inapta) fato = `está com o CNPJ inapto na Receita Federal${/omiss/i.test(inapta.motivo) ? ' por falta de declarações' : ''}`;
  else if (simples && simples.data >= new Date().toISOString().slice(0, 10)) fato = `tem a exclusão do Simples Nacional marcada para ${dataBr(simples.data)}`;
  else if (simples) fato = `foi excluída do Simples Nacional em ${dataBr(simples.data)}`;
  else if (mei && mei.classe === 'crescimento') fato = `saiu do MEI em ${dataBr(mei.data)} e passou a ser microempresa no Simples`;
  else fato = `foi desenquadrada do MEI em ${dataBr(mei?.data)}`;
  const oferta =
    mei && mei.classe === 'crescimento' && !inapta && !simples
      ? 'Como microempresa, ela passa a ter obrigações mensais que o MEI não tinha. Cuidamos da contabilidade e das declarações para a empresa crescer sem multa.'
      : 'Isso pode gerar multa, bloqueio de notas e impedir empréstimos e vendas para órgãos públicos. Fazemos a regularização completa: declarações em atraso, parcelamento de débitos e volta ao Simples.';
  return `${ola} Vimos no cadastro público da Receita Federal que ${quem} ${fato}. ${oferta} Posso te explicar como funciona?`;
}

/** Linhas da planilha Excel (uma por estabelecimento), com todos os dados */
export function linhasPlanilhaProblematicos(dados, lista, NSOC = 4) {
  const q = dados.qualificacao || {};
  const nat = dados.natureza || {};
  const cnae = dados.cnae || {};
  const fone = (n) => telefonesDe({ ddd_telefone_1: n })[0]?.texto || '';
  return lista.map((r) => {
    const s = r.simples || {};
    const linha = {
      Prioridade: PRIORIDADES[r.prioridade],
      'Tipo de caso': CLASSES[r.classe],
      'Situação encontrada': r.casos.map(rotuloCaso).join('; '),
      'Motivo provável': r.casos.map((c) => c.motivo).join(' | '),
      CNPJ: r.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5'),
      Município: r.cidade,
      'Matriz/filial': r.matriz ? 'Matriz' : 'Filial',
      'Razão social': semCpf(r.razao),
      'Nome fantasia': r.fantasia,
      'Telefone 1': fone(r.tel1),
      'Telefone 2': fone(r.tel2),
      Fax: fone(r.fax),
      'E-mail': r.email,
      'E-mail de contador': emailDeContador(r.email) ? 'Sim' : '',
      'Nº de sócios': (r.socios || []).length || '',
    };
    (r.socios || []).slice(0, NSOC).forEach((x, i) => {
      const n = i + 1;
      linha[`Sócio ${n} - nome`] = x.nome;
      linha[`Sócio ${n} - CPF/CNPJ`] = docMascarado(x.doc);
      linha[`Sócio ${n} - qualificação`] = q[x.qual] || x.qual;
      linha[`Sócio ${n} - entrada`] = dataBr(x.entrada);
      linha[`Sócio ${n} - faixa etária`] = x.pj ? '' : FAIXAS[x.faixa] || '';
      linha[`Sócio ${n} - representante legal`] = x.rep ? `${x.rep} (${(q[x.repQual] || x.repQual || '').toLowerCase()})` : '';
    });
    for (let n = (r.socios || []).length + 1; n <= NSOC; n++)
      for (const c of ['nome', 'CPF/CNPJ', 'qualificação', 'entrada', 'faixa etária', 'representante legal']) linha[`Sócio ${n} - ${c}`] = '';
    const resto = (r.socios || []).slice(NSOC);
    linha['Demais sócios'] =
      resto
        .slice(0, 20)
        .map((x) => `${x.nome} (${(q[x.qual] || x.qual).toLowerCase()})`)
        .join('; ') + (resto.length > 20 ? ` e mais ${resto.length - 20}` : '');
    linha['Titular do MEI/empresário'] = r.socios?.length ? '' : individual(nat[r.natureza]) ? nomeTitular(r.razao) : '';
    linha['Titular - CPF'] = r.titularCpf || '';
    Object.assign(linha, {
      Endereço: r.endereco,
      Bairro: r.bairro,
      CEP: r.cep ? r.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2') : '',
      'Atividade principal': r.cnae ? `${r.cnae} - ${cnae[r.cnae] || ''}` : '',
      'Atividades secundárias': (r.cnaes || []).map((c) => `${c} - ${cnae[c] || ''}`).join('; '),
      'Natureza jurídica': nat[r.natureza] || r.natureza,
      'Qualificação do responsável': q[r.qualResp] || '',
      Porte: PORTES[r.porte] || '',
      'Capital social': r.capital ?? '',
      'Situação cadastral': SITUACOES[r.situacao] || r.situacao,
      'Data da situação': dataBr(r.dataSituacao),
      'Motivo da situação': r.motivoSituacao || '',
      'Situação especial': r.situacaoEspecial || '',
      'Início da atividade': dataBr(r.abertura),
      'Optante do Simples hoje': s.opcao === 'S' ? 'Sim' : s.opcao === 'N' ? 'Não' : '',
      'Opção pelo Simples': dataBr(s.dataOpcao),
      'Exclusão do Simples': dataBr(s.dataExclusao),
      'MEI hoje': s.mei === 'S' ? 'Sim' : s.mei === 'N' ? 'Não' : '',
      'Opção pelo MEI': dataBr(s.dataOpcaoMei),
      'Exclusão do MEI': dataBr(s.dataExclusaoMei),
    });
    return linha;
  });
}
