# X CA Auto Buyer — Base

A small TypeScript bot that watches one X account, requires an exact ticker, extracts a Base/EVM contract address, verifies the token symbol on-chain, gets a 0x Swap API v2 quote, and (only when explicitly enabled) buys with ETH on Base.

## Safety defaults

The repository starts in safe mode:

```env
DRY_RUN=true
AUTO_BUY=false
```

Do not change those until the detector and validation flow have been tested.

## What it does

```text
X account
  ↓
new post
  ↓
exact ticker check
  ↓
Base CA detection
  ↓
on-chain symbol check
  ↓
0x executable quote
  ↓
risk limits + ETH balance
  ↓
DRY RUN or real buy
  ↓
Telegram alert
```

The bot is Base-only and uses chain ID `8453`.

## Requirements

- Node.js 20+
- An X API bearer token with access to recent search
- A Telegram bot and chat ID
- A 0x API key
- A Base RPC URL
- A dedicated EVM wallet funded only with an amount you can afford to lose

Never commit `.env` or your private key to GitHub.

## Setup

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Create `.env` from `.env.example`.
4. Fill in the credentials and strategy settings.

Example:

```env
X_BEARER_TOKEN=...
X_USERNAME=someaccount
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
ZEROX_API_KEY=...
RPC_URL=https://mainnet.base.org
PRIVATE_KEY=0xyour_private_key

TARGET_TICKER=$ABC
REQUIRE_TICKER=true
BUY_AMOUNT_ETH=0.001
MAX_SLIPPAGE_BPS=1000
MAX_DAILY_SPEND_ETH=0.01
MAX_TRADES_PER_HOUR=5

DRY_RUN=true
AUTO_BUY=false
```

## Ticker rule

If `TARGET_TICKER=$ABC`, a post containing `$ABC` can continue to validation. `$ABCD` does not count as `$ABC`.

The bot then reads the ERC-20 `symbol()` from the CA itself. If the on-chain symbol is not exactly `ABC`, the trade is rejected.

Therefore the buy path requires both:

- the X post matches the target ticker
- the CA's on-chain token symbol matches the target ticker

## Dry run

Keep:

```env
DRY_RUN=true
AUTO_BUY=false
```

Run:

```bash
npm run dev
```

The bot can detect posts, CAs, validate the token, and request a 0x quote, but it will not broadcast a trade.

## Live trading

Only after testing:

```env
DRY_RUN=false
AUTO_BUY=true
```

Start with a very small `BUY_AMOUNT_ETH` and a dedicated wallet.

The bot uses the 0x Swap API v2 AllowanceHolder quote endpoint. For an ETH sell, no ERC-20 approval is required. The transaction destination is taken from the 0x quote response rather than hard-coded.

## Emergency stop

Send `/stop` to the configured Telegram chat. The running process will stop taking further trade actions.

You can also stop the process directly with Ctrl+C.

## Important limitations

- X polling is used instead of a private realtime stream, so detection speed depends on the X API and `POLL_INTERVAL_MS`.
- A newly launched token may have no executable route yet. In that case the bot skips it.
- A ticker in an X post is not proof that the CA belongs to that ticker. The on-chain symbol check is therefore mandatory.
- This is not a guarantee against malicious contracts, taxes, honeypots, or rapid liquidity removal. Use a small dedicated wallet.

## 0x API

The code targets Swap API v2. Base is chain ID `8453`. API v2 requires the `0x-api-key` and `0x-version: v2` headers.
