import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config();
const envSchema = z.object({
  X_WATCHER_MODE: z.enum(["cookie", "api"]).default("cookie"),
  X_USERNAME: z.string().trim().min(1),
  POLL_INTERVAL_MS: z.coerce.number().int().min(250).default(2000),
  X_BEARER_TOKEN: z.string().default(""),
  X_AUTH_TOKEN: z.string().default(""),
  X_CT0: z.string().default(""),
  RPC_URL: z.string().url().default("https://mainnet.base.org"),
  TARGET_TICKER: z.string().trim().min(1),
  TARGET_NAME: z.string().trim().min(1),
  BUY_AMOUNT_ETH: z.coerce.number().positive().default(0.01),
  MAX_SLIPPAGE_BPS: z.coerce.number().int().min(0).max(10000).default(2000),
  DRY_RUN: z.string().transform((v) => v.trim().toLowerCase() === "true").default("true"),
  DEMO_AUTO_BUY: z.string().transform((v) => v.trim().toLowerCase() === "true").default("true"),
  TELEGRAM_BOT_TOKEN: z.string().default(""),
  TELEGRAM_CHAT_ID: z.string().default(""),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) { const message = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "); throw new Error(`Invalid configuration: ${message}`); }
const env = parsed.data;
export const config = {
  xWatcherMode: env.X_WATCHER_MODE, xUsername: env.X_USERNAME.replace(/^@/, ""), xPollIntervalMs: env.POLL_INTERVAL_MS, xBearerToken: env.X_BEARER_TOKEN, xAuthToken: env.X_AUTH_TOKEN, xCt0: env.X_CT0,
  chainId: 8453 as const, rpcUrl: env.RPC_URL,
  targetTicker: env.TARGET_TICKER, targetName: env.TARGET_NAME, buyAmountEth: env.BUY_AMOUNT_ETH, maxSlippageBps: env.MAX_SLIPPAGE_BPS,
  dryRun: true, demoAutoBuy: env.DEMO_AUTO_BUY,
  telegramBotToken: env.TELEGRAM_BOT_TOKEN, telegramChatId: env.TELEGRAM_CHAT_ID, databasePath: path.resolve("data", "bot.db"),
};
export function validateConfig(): string[] {
  const problems: string[] = [];
  if (config.xWatcherMode === "api" && !config.xBearerToken) problems.push("X_BEARER_TOKEN is required for X_WATCHER_MODE=api");
  if (config.xWatcherMode === "cookie" && (!config.xAuthToken || !config.xCt0)) problems.push("X_AUTH_TOKEN and X_CT0 are required for X_WATCHER_MODE=cookie");
  if (!config.demoAutoBuy) problems.push("DEMO_AUTO_BUY should remain true for the demo build");
  return problems;
}
