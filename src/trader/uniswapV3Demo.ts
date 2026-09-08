import { getAddress, parseEther } from 'viem';
import { base, publicClient } from '../base.js';
import { config } from '../config.js';

const FACTORY_ABI = [
  {
    type: 'function',
    name: 'getPool',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' },
    ],
    outputs: [{ name: 'pool', type: 'address' }],
  },
] as const;

const QUOTER_ABI = [
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const;

export type DemoQuote = {
  pool: string;
  feeTier: number;
  amountInWei: bigint;
  amountOutWei: bigint;
  amountOutMinimumWei: bigint;
};

export async function getUniswapV3DemoQuote(tokenAddress: string): Promise<DemoQuote> {
  const token = getAddress(tokenAddress);
  const weth = getAddress(config.wethAddress);
  const amountInWei = parseEther(config.buyAmountEth);

  const pool = await publicClient.readContract({
    address: getAddress(config.uniswapV3FactoryAddress),
    abi: FACTORY_ABI,
    functionName: 'getPool',
    args: [weth, token, config.uniswapFeeTier],
    chain: base,
  });

  if (pool === '0x0000000000000000000000000000000000000000') {
    throw new Error(`No Uniswap V3 pool found for configured ${config.uniswapFeeTier / 10000}% fee tier`);
  }

  const result = await publicClient.simulateContract({
    address: getAddress(config.uniswapQuoterV2Address),
    abi: QUOTER_ABI,
    functionName: 'quoteExactInputSingle',
    args: [{
      tokenIn: weth,
      tokenOut: token,
      amountIn: amountInWei,
      fee: config.uniswapFeeTier,
      sqrtPriceLimitX96: 0n,
    }],
    chain: base,
  });

  const amountOutWei = result.result[0];
  const amountOutMinimumWei = amountOutWei * BigInt(10_000 - config.maxSlippageBps) / 10_000n;

  return {
    pool,
    feeTier: config.uniswapFeeTier,
    amountInWei,
    amountOutWei,
    amountOutMinimumWei,
  };
}
