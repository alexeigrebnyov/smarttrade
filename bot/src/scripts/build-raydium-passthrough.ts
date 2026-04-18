// Build Raydium swap ix via raydium-sdk and wrap into cpi_passthrough
// This is a skeleton: fill in the exact pool keys and raydium-sdk swap builder per your pool version.
// npm i @raydium-io/raydium-sdk
import { Connection, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { AnchorProvider, Wallet, Program } from '@coral-xyz/anchor';
import idl from '../idl/arb_bot.json';

export async function buildRaydiumSwapPassthrough(
  connection: Connection,
  wallet: Keypair,
  programId: string,
  raydiumSwapIx: TransactionInstruction
) {
  const provider = new AnchorProvider(connection, new Wallet(wallet), { commitment: 'confirmed' });
  const program = new Program(idl as any, new PublicKey(programId), provider);
  const accounts = { targetProgram: raydiumSwapIx.programId, signer: wallet.publicKey };
  const remainingAccounts = raydiumSwapIx.keys.map(k => ({
    pubkey: k.pubkey,
    isWritable: !!k.isWritable,
    isSigner: !!k.isSigner,
  }));
  const method = (program.methods as any).cpiPassthrough(Buffer.from(raydiumSwapIx.data));
  const builder = method.accounts(accounts).remainingAccounts(remainingAccounts);
  return builder.instruction();
}
