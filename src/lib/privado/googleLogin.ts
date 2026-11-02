// Login do Google fora da área Privado (Contratos, Super Sugestão): usa o mesmo Client ID configurado no Privado.
import { GOOGLE_CLIENT_ID } from '../../data/privadoConfig.ts';
import { conectado, conectar, usuario } from './drive.ts';

const CHAVE_CLIENT = 'agilcm:privado:clientId';

export function lerClientId(): string {
  if (GOOGLE_CLIENT_ID) return GOOGLE_CLIENT_ID;
  try {
    return localStorage.getItem(CHAVE_CLIENT) || '';
  } catch {
    return '';
  }
}

/** Conecta ao Google se ainda não estiver conectado; devolve o e-mail da conta. */
export async function garantirGoogle(): Promise<string> {
  if (conectado()) return (await usuario()).email;
  const clientId = lerClientId();
  if (!clientId) throw new Error('Falta configurar o login do Google: entre na área Privado, abra "Configurações" e informe o Client ID.');
  await conectar(clientId);
  return (await usuario()).email;
}
