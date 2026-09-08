# x-ca-auto-buyer — Demo / Test Version

Base-only CA-first X monitoring and on-chain verification demo.

The project keeps the same overall structure and detection flow, but this repository is intentionally **demo-only**: it never signs, broadcasts, or submits a real on-chain swap.

## Pipeline

`X post -> post dedupe -> CA extraction -> CA dedupe -> parallel Base RPC reads -> TARGET_TICKER/TARGET_NAME match -> Telegram alert -> simulated buy result`

The X post does **not** need to contain the ticker or token name. A valid EVM/Base contract address is extracted first, then Base is used as the authority for `name()`, `symbol()`, and `decimals()`.

## Demo execution

`DEMO_AUTO_BUY=true` enables the simulated execution step after a token passes the configured on-chain name/symbol checks.

The demo trader returns a `SIMULATED_*` transaction identifier and records the result in SQLite. There is no private-key wallet client, transaction signer, swap router, or broadcast path in this version.

## X watcher

- `X_WATCHER_MODE=api`: official X API v2 recent search, filtered to the configured username.
- `X_WATCHER_MODE=cookie`: X web GraphQL using `X_AUTH_TOKEN` + `X_CT0`.

Cookie mode uses undocumented X web endpoints/query IDs and can break if X changes authentication or endpoint behavior.

## Telegram

Supported runtime controls include `/stop`, `/resume`, `SLIPPAGE 20%`, and `/status`. Telegram delivery is asynchronous and is not used as a prerequisite for CA detection or Base verification.

## Install

```bash
npm install
cp .env.example .env
npm run build
npm start
```

## Safety

This repository is a testing/demo build. Keep real credentials out of `.env` commits. The demo execution layer is deliberately non-custodial and simulation-only.
