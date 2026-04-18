import { Connection, PublicKey } from '@solana/web3.js';
import { RaydiumAdapter } from '../dex/raydium';
import { DlmmAdapter } from '../dex/dlmm';
import { Opportunity, SwapRoute } from '../utils/types';

export class DlmmStrategy {
  private ray: RaydiumAdapter;
  private dlmm: DlmmAdapter;
  
  constructor(private connection: Connection) {
    this.ray = new RaydiumAdapter(connection);
    this.dlmm = new DlmmAdapter(connection);
  }
  
  async findOpportunities(params: {
    pairs: { 
      rayPool: PublicKey; 
      dlmmPool: PublicKey; 
      mints: { 
        in: PublicKey; 
        out: PublicKey; 
        decimalsIn: number;
        decimalsOut?: number;
      } 
    }[];
    amount: number;
    maxSlippage: number;
  }): Promise<Opportunity[]> {
    const out: Opportunity[] = [];
    
    for (const p of params.pairs) {
      try {
        // Fetch pool states in parallel
        const [rayState, dlmmState] = await Promise.all([
          this.ray.getPoolState(p.rayPool),
          this.dlmm.getPoolState(p.dlmmPool)
        ]);
        
        // Calculate prices
        const rayPrice = Number(rayState.quoteReserves) / Number(rayState.baseReserves);
        const dlmmPrice = Number(dlmmState.bReserves) / Number(dlmmState.aReserves);
        
        // Calculate edge (price difference)
        const edge = Math.abs(rayPrice - dlmmPrice);
        
        // Calculate total fees (Raydium + DLMM)
        const totalFees = rayState.fees + (dlmmState.feeBps / 10000);
        
        // Minimum edge must cover fees + slippage
        const minEdge = params.maxSlippage + totalFees;
        
        if (edge > minEdge) {
          // Get additional account data
          const [ammAuthority, vaults] = await Promise.all([
            this.ray.getAmmAuthority(p.rayPool),
            this.dlmm.getTokenVaults(p.dlmmPool)
          ]);
          
          // Determine direction: buy on cheaper DEX, sell on expensive
          const isRaydiumCheaper = rayPrice < dlmmPrice;
          
          // Build route steps
          const steps = isRaydiumCheaper ? [
            // Step 1: Buy on Raydium (cheaper)
            {
              dexProgramId: RaydiumAdapter.PROGRAM_ID,
              poolAccount: p.rayPool,
              userAccount: new PublicKey('11111111111111111111111111111111'), // Will be replaced with actual ATA
              mint: p.mints.in,
              minOut: 0,
              decimals: p.mints.decimalsIn,
              feeBps: Math.round(rayState.fees * 10000),
              dexType: 0, // Raydium
              ammAuthority
            },
            // Step 2: Sell on Whirlpool (more expensive)
            {
              dexProgramId: DlmmAdapter.PROGRAM_ID,
              poolAccount: p.dlmmPool,
              userAccount: new PublicKey('11111111111111111111111111111111'), // Will be replaced with actual ATA
              mint: p.mints.out,
              minOut: 0,
              decimals: p.mints.decimalsIn,
              feeBps: dlmmState.feeBps,
              dexType: 1, // Whirlpool
              tokenVaultA: vaults.vaultA,
              tokenVaultB: vaults.vaultB
            }
          ] : [
            // Step 1: Buy on Whirlpool (cheaper)
            {
              dexProgramId: DlmmAdapter.PROGRAM_ID,
              poolAccount: p.dlmmPool,
              userAccount: new PublicKey('11111111111111111111111111111111'),
              mint: p.mints.out,
              minOut: 0,
              decimals: p.mints.decimalsIn,
              feeBps: dlmmState.feeBps,
              dexType: 1,
              tokenVaultA: vaults.vaultA,
              tokenVaultB: vaults.vaultB
            },
            // Step 2: Sell on Raydium (more expensive)
            {
              dexProgramId: RaydiumAdapter.PROGRAM_ID,
              poolAccount: p.rayPool,
              userAccount: new PublicKey('11111111111111111111111111111111'),
              mint: p.mints.in,
              minOut: 0,
              decimals: p.mints.decimalsIn,
              feeBps: Math.round(rayState.fees * 10000),
              dexType: 0,
              ammAuthority
            }
          ];
          
          // Estimate profit after fees
          const estProfit = (edge - totalFees) * params.amount;
          
          // Calculate confidence based on liquidity depth
          const liquidityDepth = Math.min(
            Number(rayState.baseReserves),
            Number(dlmmState.aReserves)
          );
          const confidence = Math.min(1, liquidityDepth / (params.amount * 10));
          
          out.push({
            route: {
              steps,
              expectedProfit: estProfit,
              maxSlippageBps: Math.round(params.maxSlippage * 100)
            },
            amount: params.amount,
            estProfit,
            confidence
          });
        }
      } catch (err) {
        console.error(`Error processing pair ${p.rayPool.toBase58()}:`, err);
        continue;
      }
    }
    
    // Sort by profit descending
    return out.sort((a, b) => b.estProfit - a.estProfit);
  }
}
