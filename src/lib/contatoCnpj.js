// Telefone e e-mail de uma empresa no cadastro público do CNPJ (Receita Federal), consultados na hora pelo navegador
// na BrasilAPI ou, se ela falhar, no minhareceita.org (os dois devolvem o mesmo formato). Nada fica gravado no site:
// a lista publicada continua sem telefone e sem e-mail.

const FONTES = ['https://brasilapi.com.br/api/cnpj/v1/', 'https://minhareceita.org/'];

/**
 * Telefones do cadastro, formatados. Celular ganha o link do WhatsApp: 9 dígitos começando com 9, ou 8 dígitos
 * começando de 6 a 9 (celular cadastrado antes do nono dígito, de 2016: o 9 entra na frente).
 * @param {Record<string, any>} d  resposta do cadastro
 * @returns {{ texto: string, numero: string, celular: boolean }[]}
 */
export function telefonesDe(d) {
  const out = [];
  for (const campo of ['ddd_telefone_1', 'ddd_telefone_2']) {
    const n = String(d?.[campo] || '').replace(/\D/g, '');
    if (n.length < 10 || n.length > 11 || out.some((t) => t.numero === n)) continue;
    const ddd = n.slice(0, 2);
    let resto = n.slice(2);
    if (resto.length === 8 && /^[6-9]/.test(resto)) resto = `9${resto}`;
    const celular = resto.length === 9 && resto.startsWith('9');
    const texto = `(${ddd}) ${resto.length === 9 ? `${resto.slice(0, 5)}-${resto.slice(5)}` : `${resto.slice(0, 4)}-${resto.slice(4)}`}`;
    if (out.some((t) => t.numero === ddd + resto)) continue;
    out.push({ texto, numero: ddd + resto, celular });
  }
  return out;
}

/**
 * O que interessa para o contato: telefones, e-mail e endereço.
 * @param {Record<string, any>} d
 */
export function contatoDe(d) {
  const email = String(d?.email || '')
    .trim()
    .toLowerCase();
  const endereco = [
    [d?.descricao_tipo_de_logradouro, d?.logradouro].filter(Boolean).join(' '),
    d?.numero,
    d?.bairro,
    [d?.municipio, d?.uf].filter(Boolean).join(' - '),
  ]
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .join(', ');
  return {
    telefones: telefonesDe(d),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
    endereco,
  };
}

/** Link do WhatsApp para um celular brasileiro (com o 55 do país) */
export const linkWhatsApp = (numero, texto = '') => `https://wa.me/55${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;

/**
 * Consulta o cadastro do CNPJ agora e devolve só o contato.
 * @param {string} cnpj  só os 14 dígitos
 * @returns {Promise<ReturnType<typeof contatoDe>>}
 */
export async function buscarContato(cnpj, fetchImpl = fetch) {
  return contatoDe(await consultarReceita(cnpj, fetchImpl));
}

/**
 * O cadastro completo do CNPJ na Receita, como a BrasilAPI (ou o minhareceita.org) devolve.
 * @param {string} cnpj  só os 14 dígitos
 * @returns {Promise<Record<string, any>>}
 */
export async function consultarReceita(cnpj, fetchImpl = fetch) {
  let ultimoErro = 'O cadastro da Receita não respondeu agora. Tente de novo em alguns minutos.';
  for (const base of FONTES) {
    try {
      const r = await fetchImpl(`${base}${cnpj}`, { headers: { Accept: 'application/json' } });
      if (r.status === 404) {
        ultimoErro = 'CNPJ não encontrado no cadastro da Receita.';
        continue;
      }
      if (!r.ok) continue;
      return await r.json();
    } catch {
      /* tenta a outra fonte */
    }
  }
  throw new Error(ultimoErro);
}
