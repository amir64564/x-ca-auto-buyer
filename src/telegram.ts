import { config } from './config.js';

export type TelegramCommandResult = {
  offset: number;
  stop: boolean;
};

async function telegramApi(method: string, body: Record<string, unknown>): Promise<any> {
  const url = `https://api.telegram.org/bot${config.telegramBotToken}/${method}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function sendTelegram(message: string): Promise<void> {
  await telegramApi('sendMessage', {
    chat_id: config.telegramChatId,
    text: message,
    disable_web_page_preview: true,
  });
}

export async function sendControlPanel(): Promise<void> {
  await telegramApi('sendMessage', {
    chat_id: config.telegramChatId,
    text: `🎯 SNIPER CONTROL\n\nSlippage: ${(config.maxSlippageBps / 100).toFixed(0)}%\nStatus: ${config.snipingEnabled ? 'ARMED' : 'CANCELLED'}`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🛑 CANCEL SNIPING', callback_data: 'stop' },
          { text: '▶️ RESUME', callback_data: 'resume' },
        ],
        [
          { text: '5%', callback_data: 'slip:500' },
          { text: '10%', callback_data: 'slip:1000' },
          { text: '20%', callback_data: 'slip:2000' },
          { text: '40%', callback_data: 'slip:4000' },
        ],
      ],
    },
  });
}

export async function pollTelegramCommands(offset = 0): Promise<TelegramCommandResult> {
  const url = `https://api.telegram.org/bot${config.telegramBotToken}/getUpdates?timeout=0&offset=${offset}`;
  const res = await fetch(url);
  if (!res.ok) return { offset, stop: false };

  const body = await res.json() as {
    result?: Array<{
      update_id: number;
      message?: { chat?: { id: number }; text?: string };
      callback_query?: { id: string; data?: string; message?: { chat?: { id: number } } };
    }>;
  };

  let next = offset;
  let stop = false;

  for (const update of body.result ?? []) {
    next = update.update_id + 1;

    const messageChat = update.message?.chat?.id?.toString();
    const callbackChat = update.callback_query?.message?.chat?.id?.toString();
    const authorized = messageChat === config.telegramChatId || callbackChat === config.telegramChatId;
    if (!authorized) continue;

    const text = update.message?.text?.trim().toLowerCase();
    const data = update.callback_query?.data;

    if (text === '/stop' || text === '/cancel' || data === 'stop') {
      config.snipingEnabled = false;
      stop = true;
      await sendTelegram('🛑 Sniping cancelled. No new buys will be executed.');
    } else if (text === '/resume' || data === 'resume') {
      // Resume only if LIVE buying was explicitly enabled in .env.
      config.snipingEnabled = config.autoBuy && !config.dryRun;
      await sendTelegram(config.snipingEnabled
        ? `▶️ Sniping resumed. Slippage: ${(config.maxSlippageBps / 100).toFixed(0)}%`
        : '⚠️ Resume ignored. Set AUTO_BUY=true and DRY_RUN=false in .env for live mode.');
    } else if (data?.startsWith('slip:')) {
      const bps = Number(data.slice(5));
      if ([500, 1000, 2000, 4000].includes(bps)) {
        config.maxSlippageBps = bps;
        await sendTelegram(`⚙️ Slippage updated to ${(bps / 100).toFixed(0)}%`);
      }
    } else if (text === '/panel' || text === '/status') {
      await sendControlPanel();
    }

    if (update.callback_query?.id) {
      try { await telegramApi('answerCallbackQuery', { callback_query_id: update.callback_query.id }); } catch { /* ignore */ }
    }
  }

  return { offset: next, stop };
}
