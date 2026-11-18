// Consulta CNPJ (aba das Licitações, só da equipe): busca e filtros no cadastro das empresas ativas das cidades
// escolhidas, tirado do cnpj.db da Receita (scripts/cadastro-cnpj.mjs). Puro: sem rede, para testar.
import { cnpjFormatado } from './possiveisClientes.js';

/** Porte da empresa na Receita (o MEI vem do Simples) */
export const PORTES = { '01': 'Microempresa', '03': 'Empresa de pequeno porte', '05': 'Demais', '00': 'Não informado' };
export const porteDe = (e) => (e.mei ? 'MEI' : PORTES[e.porte] || 'Não informado');

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();

/** Texto de busca de cada empresa: nomes, atividades (principal e secundárias), bairro e cidade */
export function textoBusca(e, cnae = {}) {
  return norm([e.razao, e.fantasia, e.cnpj, cnae[e.cnae], ...(e.cnaes || []).map((c) => cnae[c]), e.bairro, e.cidade].filter(Boolean).join(' | '));
}

/** Uma empresa tem um ramo? Pela atividade principal ou por qualquer secundária (texto da Receita) */
export const temRamo = (e, termo, cnae = {}) => {
  const t = norm(termo);
  return [e.cnae, ...(e.cnaes || [])].some((c) => norm(cnae[c]).includes(t));
};

/**
 * @param {{ empresas: any[], cnae: Record<string, string> }} dados
 * @param {{ q?: string, cidade?: string, porte?: string, telefone?: boolean, email?: boolean, licitacao?: '' | 'sim' | 'nao' }} f
 * @param {Map<any, string>} [indice]  textos de busca já prontos (textoBusca), para não refazer a cada tecla
 */
export function filtrarCadastro(dados, f = {}, indice) {
  const digitos = String(f.q || '').replace(/\D/g, '');
  const soNumero = digitos.length >= 5 && !/[a-z]/i.test(String(f.q || '').replace(/[\d./\s-]/g, ''));
  const termos = soNumero
    ? []
    : norm(f.q)
        .split(/\s+/)
        .filter((t) => t.length >= 2);
  return (dados.empresas || []).filter((e) => {
    if (f.cidade && e.cidade !== f.cidade) return false;
    if (f.porte && porteDe(e) !== f.porte) return false;
    if (f.telefone && !e.tel1 && !e.tel2) return false;
    if (f.email && !e.email) return false;
    if (f.licitacao === 'sim' && !e.lic) return false;
    if (f.licitacao === 'nao' && e.lic) return false;
    if (soNumero) return e.cnpj.includes(digitos);
    if (!termos.length) return true;
    const texto = indice?.get(e) ?? textoBusca(e, dados.cnae);
    return termos.every((t) => texto.includes(t));
  });
}

/** Ordem da lista: quem já disputou licitação primeiro (é quem a assessoria ajuda mais rápido), depois pelo nome */
export const ordemCadastro = (a, b) =>
  Number(!!b.lic) - Number(!!a.lic) || (b.lic?.perto || 0) - (a.lic?.perto || 0) || a.razao.localeCompare(b.razao, 'pt-BR');

const dataBR = (iso) => (iso ? String(iso).split('-').reverse().join('/') : '');
const fone = (n) => (n ? `(${n.slice(0, 2)}) ${n.length === 11 ? `${n.slice(2, 7)}-${n.slice(7)}` : `${n.slice(2, 6)}-${n.slice(6)}`}` : '');

/** Linhas da planilha Excel (uma por empresa) */
export function linhasPlanilhaCadastro(dados, empresas) {
  return empresas.map((e) => ({
    Empresa: e.razao,
    'Nome fantasia': e.fantasia,
    CNPJ: cnpjFormatado(e.cnpj),
    Cidade: `${e.cidade} - ${e.uf}`,
    Porte: porteDe(e),
    'Atividade principal': dados.cnae?.[e.cnae] || e.cnae,
    'Aberta em': dataBR(e.abertura),
    Telefone: fone(e.tel1),
    'Telefone 2': fone(e.tel2),
    'E-mail': e.email,
    Endereço: [e.endereco, e.bairro].filter(Boolean).join(' - '),
    CEP: e.cep,
    'Itens disputados em licitações': e.lic?.itens ?? 0,
    'Itens vencidos': e.lic?.vitorias ?? 0,
    'Última licitação': dataBR(e.lic?.ultima),
  }));
}

/**
 * Mensagem para o primeiro contato. Quem já disputa licitação recebe o link do diagnóstico; quem nunca disputou, o
 * convite para começar a vender para prefeituras.
 * @param {{ razao: string, cidade: string, lic?: any, cnpj: string }} e
 * @param {{ site?: string }} [o]
 */
export function mensagemCadastro(e, o = {}) {
  const site = o.site || 'https://www.agilcm.com.br';
  if (e.lic?.itens)
    return (
      `Olá! Sou da Ágil CM, de Astolfo Dutra. Vimos que a ${e.razao} disputa licitações em Minas Gerais e preparamos um diagnóstico gratuito ` +
      `mostrando onde dá para vencer mais, que você pode ver aqui: ${site}/diagnostico-licitacoes/?cnpj=${e.cnpj} . Podemos conversar?`
    );
  return (
    `Olá! Sou da Ágil CM, de Astolfo Dutra. As prefeituras e órgãos públicos de ${e.cidade} e região compram o ano inteiro por licitação, ` +
    `e a ${e.razao} pode vender para eles. Cuidamos do cadastro, dos documentos e das propostas para a sua empresa começar com segurança. Podemos conversar?`
  );
}

// ---------------------------------------------------------------- consulta na Receita (um CNPJ ou vários)

/**
 * CNPJs num texto colado (com ou sem pontuação, separados por qualquer coisa), sem repetir.
 * @returns {{ validos: string[], invalidos: string[], sobraram: number }}  só os dígitos (sobraram: válidos além do máximo)
 */
export function cnpjsDoTexto(texto, max = 100) {
  const achados = String(texto || '').match(/\d{2}\.?\d{3}\.?\d{3}\s*\/?\s*\d{4}\s*-?\s*\d{2}/g) || [];
  const validos = [];
  const invalidos = [];
  for (const a of achados) {
    const d = a.replace(/\D/g, '');
    if (validos.includes(d) || invalidos.includes(d)) continue;
    (dvCnpjOk(d) ? validos : invalidos).push(d);
  }
  return { validos: validos.slice(0, max), invalidos, sobraram: Math.max(0, validos.length - max) };
}
function dvCnpjOk(d) {
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (n) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (((n - i - 1) % 8) + 2);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

const tituloCaso = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/(^|\s)(\S)/g, (x) => x.toUpperCase())
    .replace(/ (De|Da|Do|Das|Dos|E) /g, (x) => x.toLowerCase());
const dataIso = (s) => (/^\d{4}-\d{2}-\d{2}/.test(String(s || '')) ? String(s).slice(0, 10) : '');

/**
 * O cadastro como a BrasilAPI (ou o minhareceita.org) devolve, no formato da tela. Sem os sócios.
 * @param {Record<string, any>} d
 */
export function cadastroDaReceita(d) {
  const tel = (campo) => {
    const n = String(d?.[campo] || '').replace(/\D/g, '');
    return n.length >= 10 && n.length <= 11 ? n : '';
  };
  const mei = d?.opcao_pelo_mei === true;
  return {
    cnpj: String(d?.cnpj || '')
      .replace(/\D/g, '')
      .padStart(14, '0'),
    razao: String(d?.razao_social || '').trim(),
    fantasia: String(d?.nome_fantasia || '').trim(),
    situacao: tituloCaso(d?.descricao_situacao_cadastral),
    situacaoDesde: dataIso(d?.data_situacao_cadastral),
    abertura: dataIso(d?.data_inicio_atividade),
    natureza: String(d?.natureza_juridica || '').replace(/^\d{3}-\d\s*-\s*/, ''),
    porte: mei ? 'MEI' : tituloCaso(d?.porte).replace('Micro Empresa', 'Microempresa') || 'Não informado',
    simples: d?.opcao_pelo_simples === true,
    mei,
    capital: Number(d?.capital_social) || 0,
    cnae: d?.cnae_fiscal ? { codigo: String(d.cnae_fiscal).padStart(7, '0'), descricao: String(d.cnae_fiscal_descricao || '') } : null,
    cnaes: (d?.cnaes_secundarios || [])
      .filter((c) => c && Number(c.codigo))
      .map((c) => ({ codigo: String(c.codigo).padStart(7, '0'), descricao: String(c.descricao || '') })),
    endereco: [[d?.descricao_tipo_de_logradouro, d?.logradouro].filter(Boolean).join(' '), d?.numero, d?.complemento]
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .join(', '),
    bairro: String(d?.bairro || '').trim(),
    cep: String(d?.cep || '').replace(/\D/g, ''),
    cidade: tituloCaso(d?.municipio),
    uf: String(d?.uf || ''),
    tel1: tel('ddd_telefone_1'),
    tel2: tel('ddd_telefone_2'),
    email: String(d?.email || '')
      .trim()
      .toLowerCase(),
  };
}

const moeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Linhas da planilha de "Vários CNPJs" (uma por CNPJ; os não encontrados também, com o motivo) */
export function linhasPlanilhaReceita(resultados) {
  return resultados.map(({ cnpj, c, erro }) => ({
    CNPJ: cnpjFormatado(cnpj),
    Empresa: c?.razao || '',
    'Nome fantasia': c?.fantasia || '',
    Situação: c ? c.situacao : erro || 'Não consultado',
    Cidade: c ? [c.cidade, c.uf].filter(Boolean).join(' - ') : '',
    Porte: c?.porte || '',
    'Simples Nacional': c ? (c.simples ? 'Sim' : 'Não') : '',
    'Atividade principal': c?.cnae?.descricao || '',
    'Aberta em': dataBR(c?.abertura),
    Telefone: fone(c?.tel1),
    'Telefone 2': fone(c?.tel2),
    'E-mail': c?.email || '',
    Endereço: c ? [c.endereco, c.bairro].filter(Boolean).join(' - ') : '',
    CEP: c?.cep || '',
    'Capital social': c ? moeda(c.capital) : '',
  }));
}

/** Os dados em texto, para colar no WhatsApp ou num e-mail */
export function textoCadastro(c) {
  return [
    c.razao,
    c.fantasia && c.fantasia !== c.razao ? `Nome fantasia: ${c.fantasia}` : '',
    `CNPJ: ${cnpjFormatado(c.cnpj)}`,
    `Situação: ${c.situacao}${c.situacaoDesde ? ` desde ${dataBR(c.situacaoDesde)}` : ''}`,
    c.abertura ? `Aberta em: ${dataBR(c.abertura)}` : '',
    `Porte: ${c.porte}${c.simples && !c.mei ? ' (Simples Nacional)' : ''}`,
    c.cnae ? `Atividade principal: ${c.cnae.descricao}` : '',
    `Endereço: ${[c.endereco, c.bairro, [c.cidade, c.uf].filter(Boolean).join(' - '), c.cep && `CEP ${c.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2')}`].filter(Boolean).join(', ')}`,
    [fone(c.tel1), fone(c.tel2)].filter(Boolean).length ? `Telefone: ${[fone(c.tel1), fone(c.tel2)].filter(Boolean).join(' / ')}` : '',
    c.email ? `E-mail: ${c.email}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
