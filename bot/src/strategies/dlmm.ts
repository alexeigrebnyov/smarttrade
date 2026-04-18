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
    pairs: { rayPool: PublicKey; dlmmPool: PublicKey; mints: { in: PublicKey; out: PublicKey; decimalsIn: number } }[];
    amount: number; maxSlippage: number;
  }): Promise<Opportunity[]> {
    const out: Opportunity[] = [];
    for (const p of params.pairs) {
      const ray = await this.ray.getPoolState(p.rayPool);
      const dlm = await this.dlmm.getPoolState(p.dlmmPool);
      const rayPrice = Number(ray.quoteReserves) / Number(ray.baseReserves);
      const dlmPrice = Number(dlm.bReserves) / Number(dlm.aReserves);
      const edge = Math.abs(rayPrice - dlmPrice);
      const minEdge = p.maxSlippage + (ray.fees + dlm.feeBps / 10000);
      if (edge > minEdge) {
        const route: SwapRoute = { steps: [
          { dexProgramId: RaydiumAdapter.PROGRAM_ID, poolAccount: p.rayPool, userAccount: new PublicKey('11111111111111111111111111111111'), mint: p.mints.in, minOut: 0, decimals: p.mints.decimalsIn,
              feeBps: Math.round(ray.fees*10000) },
          { dexProgramId: DlmmAdapter.PROGRAM_ID, poolAccount: p.dlmmPool, userAccount: new PublicKey('11111111111111111111111111111111'), mint: p.mints.in, minOut: 0, decimals: p.mints.decimalsIn,
              feeBps: Math.round(ray.fees*10000) }
        ]};
        out.push({ route, amount: params.amount, estProfit: edge * params.amount });
      }
    }
    return out;
  }
}
