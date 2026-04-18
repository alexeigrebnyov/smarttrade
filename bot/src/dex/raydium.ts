import { Connection, PublicKey } from '@solana/web3.js';
export interface LiquidityPoolInfo { baseReserves: bigint; quoteReserves: bigint; fees: number; }
export class RaydiumAdapter {
  static PROGRAM_ID = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
  constructor(private connection: Connection) {}
  async getPoolState(poolAddress: PublicKey): Promise<LiquidityPoolInfo> {
    const info = await this.connection.getAccountInfo(poolAddress);
    if (!info) throw new Error('Pool account not found');
    return this.parsePoolData(info.data);
  }
  private parsePoolData(data: Buffer): LiquidityPoolInfo {
    return { baseReserves: data.readBigUInt64LE(64), quoteReserves: data.readBigUInt64LE(72), fees: 0.003 };
  }
}
