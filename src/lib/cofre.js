// Cofre da lista Possíveis clientes: o arquivo publicado no site vai cifrado (AES-GCM) com uma chave tirada da senha do
// Privado (PBKDF2). Sem a senha, o arquivo não tem leitura; com ela, o navegador decifra. Quem cifra é a publicação do
// site no GitHub, com a senha guardada no segredo PRIVADO_SENHA. Funciona no navegador e no Node (Web Crypto).

/** Sal fixo da chave da lista (público; só impede tabelas prontas). Não é o mesmo do login do Privado. */
export const SAL_PROSPECCAO = 'e8e72016b043e7834dbe7ad4f40d8fd2';
export const ITERACOES_PROSPECCAO = 210000;
/** Começo do arquivo cifrado: "AGC1" */
const MARCA = [0x41, 0x47, 0x43, 0x31];

const deHex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const sutil = () => globalThis.crypto.subtle;

/** Chave AES-GCM a partir da senha do Privado */
export async function chaveDaSenha(senha) {
  const base = await sutil().importKey('raw', new TextEncoder().encode(String(senha)), 'PBKDF2', false, ['deriveKey']);
  return sutil().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: deHex(SAL_PROSPECCAO), iterations: ITERACOES_PROSPECCAO },
    base,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

/** A chave em texto (para guardar na sessão do navegador) e de volta */
export const chaveParaTexto = async (chave) => hex(await sutil().exportKey('raw', chave));
export const chaveDoTexto = (texto) => sutil().importKey('raw', deHex(texto), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);

/**
 * @param {Uint8Array} dados
 * @returns {Promise<Uint8Array>}  "AGC1" + 12 bytes do vetor inicial + dados cifrados
 */
export async function cifrar(dados, chave) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const c = new Uint8Array(await sutil().encrypt({ name: 'AES-GCM', iv }, chave, dados));
  const out = new Uint8Array(4 + 12 + c.length);
  out.set(MARCA, 0);
  out.set(iv, 4);
  out.set(c, 16);
  return out;
}

/**
 * @param {Uint8Array} arquivo
 * @returns {Promise<Uint8Array>}  falha (DOMException/Error) com a chave errada
 */
export async function decifrar(arquivo, chave) {
  const b = new Uint8Array(arquivo);
  if (b.length < 17 || MARCA.some((x, i) => b[i] !== x)) throw new Error('Arquivo da lista em formato desconhecido');
  return new Uint8Array(await sutil().decrypt({ name: 'AES-GCM', iv: b.subarray(4, 16) }, chave, b.subarray(16)));
}
