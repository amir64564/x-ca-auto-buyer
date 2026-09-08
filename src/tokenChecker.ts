import { ethers } from 'ethers';
import { BASE_CHAIN_ID, config } from './config.js';

const provider = new ethers.JsonRpcProvider(config.rpcUrl, BASE_CHAIN_ID, { staticNetwork: true });

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)',
];

export type TokenInfo = { address: string; symbol: string; name: string; decimals: number };

export async function getTokenInfo(address: string): Promise<TokenInfo> {
  const token = new ethers.Contract(address, ERC20_ABI, provider);
  const [symbol, name, decimals] = await Promise.all([
    token.symbol(),
    token.name(),
    token.decimals(),
  ]);
  return { address, symbol: String(symbol), name: String(name), decimals: Number(decimals) };
}

export async function getEthBalance(): Promise<bigint> {
  const wallet = new ethers.Wallet(config.privateKey, provider);
  return provider.getBalance(wallet.address);
}

export function symbolMatchesTarget(actual: string): boolean {
  return actual.replace(/^\$/, '').trim().toUpperCase() === config.targetTicker;
}

export function nameMatchesTarget(actual: string): boolean {
  if (!config.requireName) return true;
  return actual.trim().toLowerCase() === config.targetName.trim().toLowerCase();
}
