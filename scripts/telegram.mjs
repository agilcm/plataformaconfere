// Envio de mensagens pelo bot do Telegram (monitor de pregões e alerta diário de editais).
// Segredos no GitHub: TELEGRAM_BOT_TOKEN (token do bot, @BotFather) e TELEGRAM_CHAT_ID (conversa que recebe).

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Manda o texto (HTML do Telegram); sem token ou conversa configurados, só mostra no log. */
export async function telegram(texto) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    console.log('[sem Telegram configurado]\n' + texto.replace(/<[^>]+>/g, ''));
    return;
  }
  // limite do Telegram: 4096 caracteres por mensagem; corta em quebra de linha para não partir uma tag HTML
  const partes = [];
  let atual = '';
  for (const linha of texto.split('\n')) {
    if (atual && atual.length + linha.length + 1 > 3900) {
      partes.push(atual);
      atual = '';
    }
    atual += (atual ? '\n' : '') + linha;
  }
  if (atual) partes.push(atual);
  for (const parte of partes) {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: parte, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!r.ok) throw new Error(`Telegram respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
}
