import { Keypair } from '@solana/web3.js';
export function keypairFromEnv(secretJson: string): Keypair {
  const secret = Uint8Array.from(JSON.parse(secretJson));
  return Keypair.fromSecretKey(secret);
}
