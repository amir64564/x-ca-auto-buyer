import { config } from './config.js';

export async function sendTelegram(message: string): Promise<void> {
  const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: config.telegramChatId, text: message, disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
}

export async function pollTelegramCommands(offset = 0): Promise<{ offset: number; stop: boolean } > {
  const url = `https://api.telegram.org/bot${config.telegramBotToken}/getUpdates?timeout=1&offset=${offset}`;
  const res = await fetch(url);
  if (!res.ok) return { offset, stop: false };
  const body = await res.json() as { result?: Array<{ update_id: number; message?: { chat?: { id: number }; text?: string } }> };
  let next = offset;
  let stop = false;
  for (const update of body.result ?? []) {
    next = update.update_id + 1;
    if (update.message?.chat?.id?.toString() === config.telegramChatId && update.message.text?.trim().toLowerCase() === '/stop') stop = true;
  }
  return { offset: next, stop };
}
