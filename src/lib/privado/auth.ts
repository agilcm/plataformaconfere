// Porta de entrada da área Privado. Confere o login no navegador comparando o hash (PBKDF2), sem guardar a senha.
// Atenção: num site estático isto só esconde a tela; a proteção dos documentos é o login Google com acesso à pasta.
import { LOGIN } from '../../data/privadoConfig.ts';
import { chaveDaSenha, chaveParaTexto } from '../cofre.js';

const CHAVE = 'agilcm:privado:sessao';
/** Chave da lista Possíveis clientes (cifrada com a senha do Privado), guardada só enquanto a aba do navegador estiver aberta */
export const CHAVE_PROSPECCAO = 'agilcm:prospeccao:chave';
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const deHex = (h: string) => new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));

export async function conferirLogin(email: string, senha: string): Promise<boolean> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(`${email.trim().toLowerCase()}\n${senha}`), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: deHex(LOGIN.salt), iterations: LOGIN.iteracoes }, base, 256);
  const ok = hex(bits) === LOGIN.hash;
  if (ok) {
    try {
      sessionStorage.setItem(CHAVE, LOGIN.hash.slice(0, 16));
      // quem entra no Privado também abre a lista Possíveis clientes (Licitações) sem digitar a senha de novo
      sessionStorage.setItem(CHAVE_PROSPECCAO, await chaveParaTexto(await chaveDaSenha(senha)));
    } catch {
      /* sem armazenamento: vale só enquanto a página estiver aberta */
    }
  }
  return ok;
}

/**
 * Senha esquecida: gera, no navegador, o código de um login novo (sal e PBKDF2 de "email\nsenha"), para quem cuida do
 * site trocar em src/data/privadoConfig.ts (LOGIN). O código não revela a senha, e a senha não sai do navegador.
 */
export async function codigoNovoLogin(email: string, senha: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(`${email.trim().toLowerCase()}\n${senha}`), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: LOGIN.iteracoes }, base, 256);
  return `NOVO-LOGIN:${hex(salt.buffer)}:${hex(bits)}`;
}

export function sessaoAtiva(): boolean {
  try {
    return sessionStorage.getItem(CHAVE) === LOGIN.hash.slice(0, 16);
  } catch {
    return false;
  }
}

export function sair() {
  try {
    sessionStorage.removeItem(CHAVE);
    sessionStorage.removeItem(CHAVE_PROSPECCAO);
  } catch {
    /* nada a limpar */
  }
}
