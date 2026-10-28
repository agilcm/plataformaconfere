// Porta de entrada da área Privado. Confere o login no navegador comparando o hash (PBKDF2), sem guardar a senha.
// Atenção: num site estático isto só esconde a tela; a proteção dos documentos é o login Google com acesso à pasta.
import { LOGIN } from '../../data/privadoConfig.ts';

const CHAVE = 'agilcm:privado:sessao';
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const deHex = (h: string) => new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));

export async function conferirLogin(email: string, senha: string): Promise<boolean> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(`${email.trim().toLowerCase()}\n${senha}`), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: deHex(LOGIN.salt), iterations: LOGIN.iteracoes }, base, 256);
  const ok = hex(bits) === LOGIN.hash;
  if (ok) {
    try {
      sessionStorage.setItem(CHAVE, LOGIN.hash.slice(0, 16));
    } catch {
      /* sem armazenamento: vale só enquanto a página estiver aberta */
    }
  }
  return ok;
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
  } catch {
    /* nada a limpar */
  }
}
