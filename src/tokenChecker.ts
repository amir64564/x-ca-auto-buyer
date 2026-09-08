import { ethers } from 'ethers';
import { BASE_CHAIN_ID, config } from './config.js';

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

export type TokenInfo = { address: string; symbol: string; decimals: number };

export async function getTokenInfo(address: string): Promise<TokenInfo> {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl, BASE_CHAIN_ID, { staticNetwork: true });
  const token = new ethers.Contract(address, ERC20_ABI, provider);
  const [symbol, decimals] = await Promise.all([token.symbol(), token.decimals()]);
  return { address, symbol: String(symbol), decimals: Number(decimals) };
}

export async function getEthBalance(): Promise<bigint> {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl, BASE_CHAIN_ID, { staticNetwork: true });
  const wallet = new ethers.Wallet(config.privateKey, provider);
  return provider.getBalance(wallet.address);
}

export function symbolMatchesTarget(actual: string): boolean {
  return actual.replace(/^\$/, '').trim().toUpperCase() === config.targetTicker;
}
