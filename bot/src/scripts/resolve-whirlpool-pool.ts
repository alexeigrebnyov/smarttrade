// Resolve Whirlpool (Orca) pool address by token mints and tickSpacing, then write config
// Usage: ts-node src/scripts/resolve-whirlpool-pool.ts --a <MINT_A> --b <MINT_B> --tick 64 --out config/pairs.mainnet.json
import { PublicKey, Connection } from '@solana/web3.js';
import { programAddress as WHIRLPOOL_PROGRAM } from '@orca-so/whirlpool-sdk/dist/public/programs'; // helper
import { ORCA_WHIRLPOOL_PROGRAM_ID } from '@orca-so/whirlpool-sdk';
import { buildWhirlpoolClient } from '@orca-so/whirlpool-sdk'; // v0.10.x
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'fs';

async function main() {
  const argv = await yargs(hideBin(process.argv)).options({
    a: { type: 'string', demandOption: true, describe: 'Mint A' },
    b: { type: 'string', demandOption: true, describe: 'Mint B' },
    tick: { type: 'number', default: 64, describe: 'tickSpacing' },
    rpc: { type: 'string', default: 'https://api.mainnet-beta.solana.com' },
    out: { type: 'string', demandOption: true, describe: 'Output JSON file to update/append' },
    name: { type: 'string', default: 'PAIR', describe: 'Pair name label' }
  }).argv;

  const connection = new Connection(argv.rpc, 'confirmed');
  const client = buildWhirlpoolClient(connection);

  const mintA = new PublicKey(argv.a);
  const mintB = new PublicKey(argv.b);
  const poolPda = await client.getPoolPda(ORCA_WHIRLPOOL_PROGRAM_ID, mintA, mintB, argv.tick);
  const poolKey = poolPda.publicKey.toBase58();

  let arr: any[] = [];
  if (fs.existsSync(argv.out)) {
    arr = JSON.parse(fs.readFileSync(argv.out, 'utf-8'));
  }
  arr.push({
    name: argv.name,
    rayPool: "REPLACE_WITH_RAYDIUM_POOL_ID",
    dlmmPool: poolKey,
    mints: { in: argv.a, out: argv.b, decimalsIn: 6 }
  });
  fs.writeFileSync(argv.out, JSON.stringify(arr, null, 2));
  console.log('Resolved Whirlpool pool:', poolKey);
}

main().catch(console.error);
