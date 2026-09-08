import { BuyResult, Trader } from "./trader";

/** Demo-only trader. It deliberately never signs or broadcasts an on-chain transaction. */
class DemoTrader implements Trader {
  async executeBuy(address: string, buyAmountEth: number, maxSlippageBps: number): Promise<BuyResult> {
    return { txHash: `SIMULATED_${Date.now()}_${address.slice(2, 10)}`, quotedTokenAmount: 0n, minTokenAmount: 0n };
  }
}

export { Trader, BuyResult } from "./trader";
export function getTrader(): Trader { return new DemoTrader(); }
