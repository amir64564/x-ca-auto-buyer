import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function bool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  return value === undefined ? fallback : value.toLowerCase() === 'true';
}

export const config = {
  xBearerToken: required('X_BEARER_TOKEN'),
  xUsername: required('X_USERNAME').replace(/^@/, ''),
  telegramBotToken: required('TELEGRAM_BOT_TOKEN'),
  telegramChatId: required('TELEGRAM_CHAT_ID'),
  zeroXApiKey: required('ZEROX_API_KEY'),
  rpcUrl: required('RPC_URL'),
  privateKey: required('PRIVATE_KEY'),
  targetTicker: required('TARGET_TICKER').replace(/^\$/, '').toUpperCase(),
  requireTicker: bool('REQUIRE_TICKER', true),
  targetName: process.env.TARGET_NAME?.trim() || '',
  requireName: bool('REQUIRE_NAME', false),
  buyAmountEth: process.env.BUY_AMOUNT_ETH ?? '0.001',
  maxSlippageBps: Number(process.env.MAX_SLIPPAGE_BPS ?? 1000),
  maxDailySpendEth: process.env.MAX_DAILY_SPEND_ETH ?? '0.01',
  maxTradesPerHour: Number(process.env.MAX_TRADES_PER_HOUR ?? 5),
  maxRetries: Number(process.env.MAX_RETRIES ?? 1),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 1000),
  dryRun: bool('DRY_RUN', true),
  autoBuy: bool('AUTO_BUY', false),
};

export const BASE_CHAIN_ID = 8453;
export const ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
