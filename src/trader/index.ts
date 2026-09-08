import { BuyResult, Trader } from "./trader";
import { getUniswapV3DemoQuote } from "./uniswapV3Demo";

/** Demo trader: uses the real Base/Uniswap V3 pool + quote path, but never signs or broadcasts a transaction. */
class DemoTrader implements Trader {
  async executeBuy(address: string, buyAmountEth: number, maxSlippageBps: number): Promise<BuyResult> {
    const quote = await getUniswapV3DemoQuote(address);
    return {
      txHash: `SIMULATED_UNISWAP_V3_${Date.now()}_${address.slice(2, 10)}`,
      quotedTokenAmount: quote.amountOutWei,
      minTokenAmount: quote.amountOutMinimumWei,
    };
  }
}

export { Trader, BuyResult } from "./trader";
export function getTrader(): Trader { return new DemoTrader(); }
