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
