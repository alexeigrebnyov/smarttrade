import { Connection, PublicKey } from '@solana/web3.js';
export interface DlmmPoolInfo { aReserves: bigint; bReserves: bigint; feeBps: number; tickSpacing: number; }
export class DlmmAdapter {
  static PROGRAM_ID = new PublicKey('DLMMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
  constructor(private connection: Connection) {}
  async getPoolState(pool: PublicKey): Promise<DlmmPoolInfo> {
    const info = await this.connection.getAccountInfo(pool);
    if (!info) throw new Error('DLMM pool not found');
    const a = info.data.readBigUInt64LE(0);
    const b = info.data.readBigUInt64LE(8);
    const feeBps = info.data.readUInt16LE(16);
    const tickSpacing = info.data.readUInt16LE(18);
    return { aReserves: a, bReserves: b, feeBps, tickSpacing };
  }
}
