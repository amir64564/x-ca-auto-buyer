import { config } from './config.js';
import { extractBaseAddresses, tickerMatches } from './caDetector.js';
import { dailySpendEth, getState, hasPost, hasTradeForCa, recentTradeCount, savePost, saveTrade, setState } from './database.js';
import { fetchRecentPosts, XPost } from './xWatcher.js';
import { getBuyQuote, executeBuy } from './zeroXTrader.js';
import { getEthBalance, getTokenInfo, symbolMatchesTarget } from './tokenChecker.js';
import { pollTelegramCommands, sendTelegram } from './telegram.js';
import { ethers } from 'ethers';

let stopped = false;
let telegramOffset = Number(getState('telegram_offset') ?? 0);

async function processPost(post: XPost): Promise<void> {
  if (hasPost(post.id)) return;
  savePost(post.id);

  if (config.requireTicker && !tickerMatches(post.text, config.targetTicker)) return;

  const addresses = extractBaseAddresses(post.text);
  if (!addresses.length) return;

  for (const ca of addresses) {
    if (hasTradeForCa(ca)) continue;
    const label = `$${config.targetTicker}`;

    try {
      await sendTelegram(`🔎 CA DETECTED\n\nTicker: ${label}\nCA: ${ca}\nSource: @${config.xUsername}\nPost: ${post.id}`);

      const token = await getTokenInfo(ca);
      if (!symbolMatchesTarget(token.symbol)) {
        saveTrade(post.id, config.targetTicker, ca, 'rejected', undefined, `On-chain symbol is ${token.symbol}, expected ${config.targetTicker}`);
        await sendTelegram(`⛔ BUY SKIPPED\n\nCA: ${ca}\nReason: on-chain symbol is ${token.symbol}, not ${label}.`);
        continue;
      }

      const quote = await getBuyQuote(ca);
      if (quote.liquidityAvailable === false || !quote.buyAmount || quote.buyAmount === '0') {
        saveTrade(post.id, config.targetTicker, ca, 'rejected', undefined, 'No executable 0x liquidity');
        await sendTelegram(`⛔ BUY SKIPPED\n\nTicker: ${label}\nCA: ${ca}\nReason: 0x returned no executable liquidity.`);
        continue;
      }

      const spend = Number(config.buyAmountEth);
      if (recentTradeCount(1) >= config.maxTradesPerHour) throw new Error('Hourly trade limit reached');
      if (dailySpendEth() + spend > Number(config.maxDailySpendEth)) throw new Error('Daily spend limit reached');

      const balance = await getEthBalance();
      if (balance < ethers.parseEther(config.buyAmountEth)) throw new Error('Insufficient Base ETH balance');

      if (config.dryRun || !config.autoBuy) {
        saveTrade(post.id, config.targetTicker, ca, 'simulated', undefined, undefined, config.buyAmountEth);
        await sendTelegram(`🟡 SIMULATED BUY\n\nTicker: ${label}\nChain: Base\nAmount: ${config.buyAmountEth} ETH\nCA: ${ca}\n\nAUTO_BUY=${config.autoBuy}\nDRY_RUN=${config.dryRun}`);
        continue;
      }

      saveTrade(post.id, config.targetTicker, ca, 'pending', undefined, undefined, config.buyAmountEth);
      const result = await executeBuy(ca);
      saveTrade(post.id, config.targetTicker, ca, 'success', result.hash, undefined, config.buyAmountEth);
      await sendTelegram(`🟢 AUTO BUY SUCCESS\n\nTicker: ${label}\nChain: Base\nAmount: ${config.buyAmountEth} ETH\nCA: ${ca}\nTX: https://basescan.org/tx/${result.hash}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      saveTrade(post.id, config.targetTicker, ca, 'failed', undefined, message);
      await sendTelegram(`🔴 BUY FAILED\n\nTicker: ${label}\nCA: ${ca}\nReason: ${message}`);
    }
  }
}

async function loop(): Promise<void> {
  await sendTelegram(`🤖 Bot started\nX: @${config.xUsername}\nTicker: $${config.targetTicker}\nChain: Base\nDRY_RUN=${config.dryRun}\nAUTO_BUY=${config.autoBuy}`);

  while (!stopped) {
    try {
      const commandResult = await pollTelegramCommands(telegramOffset);
      telegramOffset = commandResult.offset;
      setState('telegram_offset', String(telegramOffset));
      if (commandResult.stop) {
        stopped = true;
        await sendTelegram('🛑 Emergency stop received. Bot will not execute more buys.');
        break;
      }

      const sinceId = getState('last_x_id');
      const posts = await fetchRecentPosts(sinceId);
      for (const post of posts) {
        await processPost(post);
        setState('last_x_id', post.id);
      }
    } catch (error) {
      console.error(error);
      try { await sendTelegram(`⚠️ Bot error\n${error instanceof Error ? error.message : String(error)}`); } catch { /* ignore alert failure */ }
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

loop().catch((error) => {
  console.error(error);
  process.exit(1);
});
