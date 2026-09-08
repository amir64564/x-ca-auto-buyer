import { ethers } from 'ethers';
import { BASE_CHAIN_ID, config, ETH } from './config.js';

const ZEROX_URL = 'https://api.0x.org/swap/allowance-holder/quote';

export type QuoteResult = {
  buyAmount: string;
  transaction: { to: string; data: string; value?: string; gas?: string; gasPrice?: string };
  issues?: { allowance?: { spender?: string } | null };
  liquidityAvailable?: boolean;
};

async function quote(buyToken: string): Promise<QuoteResult> {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl, BASE_CHAIN_ID, { staticNetwork: true });
  const wallet = new ethers.Wallet(config.privateKey, provider);
  const params = new URLSearchParams({
    chainId: String(BASE_CHAIN_ID),
    buyToken,
    sellToken: ETH,
    sellAmount: ethers.parseEther(config.buyAmountEth).toString(),
    taker: wallet.address,
    slippageBps: String(config.maxSlippageBps),
  });

  const res = await fetch(`${ZEROX_URL}?${params}`, {
    headers: { '0x-api-key': config.zeroXApiKey, '0x-version': 'v2', 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`0x quote ${res.status}: ${await res.text()}`);
  return await res.json() as QuoteResult;
}

export async function getBuyQuote(token: string): Promise<QuoteResult> {
  return quote(token);
}

export async function executeBuy(token: string): Promise<{ hash: string; buyAmount: string }> {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl, BASE_CHAIN_ID, { staticNetwork: true });
  const wallet = new ethers.Wallet(config.privateKey, provider);
  const q = await quote(token);

  if (!q.transaction?.to || !q.transaction?.data) throw new Error('0x returned no executable transaction');

  // For an ETH sell, no ERC20 approval is required. The API response transaction.to is used
  // directly; do not hard-code a Settler or AllowanceHolder address.
  const tx = await wallet.sendTransaction({
    to: q.transaction.to,
    data: q.transaction.data,
    value: q.transaction.value ? BigInt(q.transaction.value) : 0n,
    gasLimit: q.transaction.gas ? BigInt(q.transaction.gas) : undefined,
    gasPrice: q.transaction.gasPrice ? BigInt(q.transaction.gasPrice) : undefined,
  });
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`Transaction failed: ${tx.hash}`);
  return { hash: tx.hash, buyAmount: q.buyAmount };
}
