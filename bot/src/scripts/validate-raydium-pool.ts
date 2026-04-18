// Validate Raydium pool account exists on-chain
// Usage: ts-node src/scripts/validate-raydium-pool.ts --pool <POOL_ID> --rpc https://api.mainnet-beta.solana.com
import { Connection, PublicKey } from '@solana/web3.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

async function main() {
  const argv = await yargs(hideBin(process.argv)).options({
    pool: { type: 'string', demandOption: true },
    rpc: { type: 'string', default: 'https://api.mainnet-beta.solana.com' }
  }).argv;
  const connection = new Connection(argv.rpc, 'confirmed');
  const info = await connection.getAccountInfo(new PublicKey(argv.pool));
  if (!info) {
    console.error('Pool not found');
    process.exit(1);
  }
  console.log('Pool exists. Data length:', info.data.length);
}
main().catch(console.error);
