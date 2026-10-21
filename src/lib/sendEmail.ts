// Envio de e-mail sem servidor próprio, usando o FormSubmit (https://formsubmit.co).
// A mensagem vai para o e-mail da Ágil CM e uma cópia (CC) vai para o e-mail que o visitante digitou.
//
// IMPORTANTE: no primeiro envio, o FormSubmit manda um e-mail de ativação para
// contato@agilcm.com.br. É só clicar em "Activate Form" uma vez e pronto.
import { COMPANY_PROFILE } from '../data/servicesData.ts';

const ENDPOINT = `https://formsubmit.co/ajax/${COMPANY_PROFILE.email}`;

export interface EmailPayload {
  subject: string;
  name: string;
  email: string; // e-mail do visitante (recebe a cópia)
  message: string;
  fields?: Record<string, string>;
}

export async function sendEmail({ subject, name, email, message, fields = {} }: EmailPayload) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      _subject: subject,
      _template: 'table',
      _captcha: 'false',
      _cc: email,
      _replyto: email,
      Nome: name,
      'E-mail': email,
      ...fields,
      Mensagem: message,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false || data.success === 'false') {
    throw new Error(data.message || 'Falha no envio');
  }
}

// Plano B: abre o aplicativo de e-mail do visitante já com a mensagem pronta
export function openMailto(subject: string, body: string, cc?: string) {
  const params = new URLSearchParams({ subject, body });
  if (cc) params.set('cc', cc);
  window.location.href = `mailto:${COMPANY_PROFILE.email}?${params.toString().replace(/\+/g, '%20')}`;
}
