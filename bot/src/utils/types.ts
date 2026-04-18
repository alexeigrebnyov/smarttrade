import { PublicKey } from '@solana/web3.js';

export interface RouteStep {
  dexProgramId: PublicKey;
  poolAccount: PublicKey;
  userAccount: PublicKey;
  mint: PublicKey;
  minOut: number;
  decimals: number;
  feeBps: number;
  dexType?: number; // 0 = Raydium, 1 = Whirlpool
  ammAuthority?: PublicKey; // For Raydium
  tokenVaultA?: PublicKey; // For Whirlpool
  tokenVaultB?: PublicKey; // For Whirlpool
}

export interface SwapRoute { 
  steps: RouteStep[]; 
  expectedProfit?: number;
  maxSlippageBps?: number;
}

export interface Opportunity { 
  route: SwapRoute; 
  amount: number; 
  estProfit: number;
  confidence?: number; // 0-1 score based on liquidity depth
}
