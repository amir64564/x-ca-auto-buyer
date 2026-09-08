import { config } from './config.js';
import { extractBaseAddresses, tickerMatches } from './caDetector.js';
import { dailySpendEth, getState, hasPost, hasTradeForCa, recentTradeCount, savePost, saveTrade, setState } from './database.js';
import { fetchRecentPosts, XPost } from './xWatcher.js';
import { getBuyQuote, executeBuy } from './zeroXTrader.js';
import { getEthBalance, getTokenInfo, nameMatchesTarget, symbolMatchesTarget } from './tokenChecker.js';
import { pollTelegramCommands, sendControlPanel, sendTelegram } from './telegram.js';
import { ethers } from 'ethers';

async function processPost(post: XPost): Promise<void> {
  if (hasPost(post.id)) return;

  if (config.requireTicker && !tickerMatches(post.text, config.targetTicker)) {
    savePost(post.id);
    return;
  }

  const addresses = extractBaseAddresses(post.text);
  if (!addresses.length) {
    savePost(post.id);
    return;
  }

  for (const ca of addresses) {
    if (hasTradeForCa(ca)) continue;

    try {
      // Identity verification is the hard safety gate. No buy until BOTH pass.
      const token = await getTokenInfo(ca);
      const symbolOk = symbolMatchesTarget(token.symbol);
      const nameOk = nameMatchesTarget(token.name);

      if (!symbolOk || !nameOk) {
        const reason = `Token verification failed: symbol=${token.symbol}, name=${token.name}, expected symbol=${config.targetTicker}, name=${config.targetName}`;
        saveTrade(post.id, config.targetTicker, ca, 'rejected', undefined, reason);
        // Alert is intentionally deferred until after the trading path.
        queueAlert(`⛔ BUY SKIPPED\n\nCA: ${ca}\n${reason}`);
        continue;
      }

      const quote = await getBuyQuote(ca);
      if (quote.liquidityAvailable === false || !quote.buyAmount || quote.buyAmount === '0') {
        saveTrade(post.id, config.targetTicker, ca, 'rejected', undefined, 'No executable 0x liquidity');
        queueAlert(`⛔ BUY SKIPPED\n\nTicker: $${config.targetTicker}\nName: ${token.name}\nCA: ${ca}\nReason: 0x returned no executable liquidity.`);
        continue;
      }

      const spend = Number(config.buyAmountEth);
      if (recentTradeCount(1) >= config.maxTradesPerHour) throw new Error('Hourly trade limit reached');
      if (dailySpendEth() + spend > Number(config.maxDailySpendEth)) throw new Error('Daily spend limit reached');

      const balance = await getEthBalance();
      if (balance < ethers.parseEther(config.buyAmountEth)) throw new Error('Insufficient Base ETH balance');

      if (!config.snipingEnabled) {
        saveTrade(post.id, config.targetTicker, ca, 'simulated', undefined, undefined, config.buyAmountEth);
        queueAlert(`🟡 VERIFIED SIGNAL\n\nTicker: $${config.targetTicker}\nName: ${token.name}\nChain: Base\nAmount: ${config.buyAmountEth} ETH\nCA: ${ca}\n\nIdentity: VERIFIED ✓\nSniping is currently CANCELLED.`);
        continue;
      }

      // Absolutely no Telegram/network alert is awaited before this transaction.
      saveTrade(post.id, config.targetTicker, ca, 'pending', undefined, undefined, config.buyAmountEth);
      const result = await executeBuy(ca);
      saveTrade(post.id, config.targetTicker, ca, 'success', result.hash, undefined, config.buyAmountEth);

      // Alert happens only AFTER execution has completed and is fire-and-forget.
      queueAlert(`🟢 SNIPER BUY SUCCESS\n\nTicker: $${config.targetTicker}\nName: ${token.name}\nChain: Base\nAmount: ${config.buyAmountEth} ETH\nSlippage: ${(config.maxSlippageBps / 100).toFixed(0)}%\nCA: ${ca}\nTX: https://basescan.org/tx/${result.hash}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      saveTrade(post.id, config.targetTicker, ca, 'failed', undefined, message);
      queueAlert(`🔴 BUY FAILED\n\nTicker: $${config.targetTicker}\nCA: ${ca}\nReason: ${message}`);
    }
  }

  savePost(post.id);
}

// Alerts are deliberately low priority. They never block X polling or trade execution.
const alertQueue: string[] = [];
let alertSending = false;
function queueAlert(message: string): void {
  alertQueue.push(message);
}
async function flushAlerts(): Promise<void> {
  if (alertSending || !alertQueue.length) return;
  alertSending = true;
  try {
    while (alertQueue.length) {
      const message = alertQueue.shift();
      if (message) {
        try { await sendTelegram(message); } catch (error) { console.error('Telegram alert failed:', error); }
      }
    }
  } finally {
    alertSending = false;
  }
}

async function loop(): Promise<void> {
  queueAlert(`🤖 Sniper bot started\nX: @${config.xUsername}\nTicker: $${config.targetTicker}\nName: ${config.targetName}\nChain: Base\nPoll: ${config.pollIntervalMs}ms\nSniping: ${config.snipingEnabled ? 'ARMED' : 'CANCELLED'}`);
  queueAlert('Use /panel for Telegram controls.');

  let telegramOffset = Number(getState('telegram_offset') ?? 0);

  while (true) {
    const cycleStart = Date.now();
    try {
      // Telegram commands are checked, but Telegram is never awaited inside processPost.
      const commandResult = await pollTelegramCommands(telegramOffset);
      telegramOffset = commandResult.offset;
      setState('telegram_offset', String(telegramOffset));

      const sinceId = getState('last_x_id');
      const posts = await fetchRecentPosts(sinceId);
      for (const post of [...posts].reverse()) {
        await processPost(post);
      }
      if (posts.length) setState('last_x_id', posts.reduce((max, p) => p.id > max ? p.id : max, posts[0].id));
    } catch (error) {
      console.error(error);
      queueAlert(`⚠️ Bot error\n${error instanceof Error ? error.message : String(error)}`);
    }

    // Flush only after the scan/trade cycle, never before it.
    void flushAlerts();

    const elapsed = Date.now() - cycleStart;
    const wait = Math.max(100, config.pollIntervalMs - elapsed);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

loop().catch((error) => {
  console.error(error);
  process.exit(1);
});
