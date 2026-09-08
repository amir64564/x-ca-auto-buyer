import { config } from './config.js';
import { extractBaseAddresses, tickerMatches } from './caDetector.js';
import { dailySpendEth, getState, hasPost, hasTradeForCa, recentTradeCount, savePost, saveTrade, setState } from './database.js';
import { fetchRecentPosts, XPost } from './xWatcher.js';
import { getBuyQuote, executeBuy } from './zeroXTrader.js';
import { getEthBalance, getTokenInfo, nameMatchesTarget, symbolMatchesTarget } from './tokenChecker.js';
import { pollTelegramCommands, sendTelegram } from './telegram.js';
import { ethers } from 'ethers';

let stopped = false;
let telegramOffset = Number(getState('telegram_offset') ?? 0);

async function processPost(post: XPost): Promise<void> {
  if (hasPost(post.id)) return;

  // Fast gate #1: the configured ticker must appear in the X post.
  if (config.requireTicker && !tickerMatches(post.text, config.targetTicker)) {
    savePost(post.id);
    return;
  }

  // Fast gate #2: extract the Base/EVM contract immediately.
  const addresses = extractBaseAddresses(post.text);
  if (!addresses.length) {
    savePost(post.id);
    return;
  }

  for (const ca of addresses) {
    if (hasTradeForCa(ca)) continue;

    try {
      // Security gate: the CA must resolve on Base and BOTH the on-chain symbol
      // and token name must match the configured target before a buy is allowed.
      const token = await getTokenInfo(ca);
      const symbolOk = symbolMatchesTarget(token.symbol);
      const nameOk = nameMatchesTarget(token.name);

      if (!symbolOk || !nameOk) {
        const reason = `Token verification failed: symbol=${token.symbol}, name=${token.name}, expected symbol=${config.targetTicker}, name=${config.targetName}`;
        saveTrade(post.id, config.targetTicker, ca, 'rejected', undefined, reason);
        await sendTelegram(`⛔ BUY SKIPPED\n\nCA: ${ca}\n${reason}`);
        continue;
      }

      // Only after both identity checks pass do we request a live executable quote.
      const quote = await getBuyQuote(ca);
      if (quote.liquidityAvailable === false || !quote.buyAmount || quote.buyAmount === '0') {
        saveTrade(post.id, config.targetTicker, ca, 'rejected', undefined, 'No executable 0x liquidity');
        await sendTelegram(`⛔ BUY SKIPPED\n\nTicker: $${config.targetTicker}\nName: ${token.name}\nCA: ${ca}\nReason: 0x returned no executable liquidity.`);
        continue;
      }

      const spend = Number(config.buyAmountEth);
      if (recentTradeCount(1) >= config.maxTradesPerHour) throw new Error('Hourly trade limit reached');
      if (dailySpendEth() + spend > Number(config.maxDailySpendEth)) throw new Error('Daily spend limit reached');

      const balance = await getEthBalance();
      if (balance < ethers.parseEther(config.buyAmountEth)) throw new Error('Insufficient Base ETH balance');

      if (config.dryRun || !config.autoBuy) {
        saveTrade(post.id, config.targetTicker, ca, 'simulated', undefined, undefined, config.buyAmountEth);
        await sendTelegram(`🟡 SIMULATED SNIPER BUY\n\nTicker: $${config.targetTicker}\nName: ${token.name}\nChain: Base\nAmount: ${config.buyAmountEth} ETH\nCA: ${ca}\n\nIdentity: VERIFIED ✓\nDRY_RUN=${config.dryRun}\nAUTO_BUY=${config.autoBuy}`);
        continue;
      }

      // No Telegram notification is sent before the buy: alerts must never sit
      // in the critical execution path.
      saveTrade(post.id, config.targetTicker, ca, 'pending', undefined, undefined, config.buyAmountEth);
      const result = await executeBuy(ca);
      saveTrade(post.id, config.targetTicker, ca, 'success', result.hash, undefined, config.buyAmountEth);
      await sendTelegram(`🟢 SNIPER BUY SUCCESS\n\nTicker: $${config.targetTicker}\nName: ${token.name}\nChain: Base\nAmount: ${config.buyAmountEth} ETH\nCA: ${ca}\nTX: https://basescan.org/tx/${result.hash}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      saveTrade(post.id, config.targetTicker, ca, 'failed', undefined, message);
      await sendTelegram(`🔴 BUY FAILED\n\nTicker: $${config.targetTicker}\nCA: ${ca}\nReason: ${message}`);
    }
  }

  savePost(post.id);
}

async function loop(): Promise<void> {
  await sendTelegram(`🤖 Sniper bot started\nX: @${config.xUsername}\nTicker: $${config.targetTicker}\nName: ${config.targetName}\nChain: Base\nPoll: ${config.pollIntervalMs}ms\nDRY_RUN=${config.dryRun}\nAUTO_BUY=${config.autoBuy}`);

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
      // Newest posts are processed first so the latest launch is not delayed by older posts.
      for (const post of [...posts].reverse()) {
        await processPost(post);
      }
      if (posts.length) setState('last_x_id', posts.reduce((max, p) => p.id > max ? p.id : max, posts[0].id));
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
