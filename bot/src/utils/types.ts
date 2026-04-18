import { PublicKey } from '@solana/web3.js';
export interface RouteStep {
  dexProgramId: PublicKey;
  poolAccount: PublicKey;
  userAccount: PublicKey;
  mint: PublicKey;
  minOut: number;
  decimals: number;
  feeBps: number;
}
export interface SwapRoute { steps: RouteStep[]; }
export interface Opportunity { route: SwapRoute; amount: number; estProfit: number; }
