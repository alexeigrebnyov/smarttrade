import { Connection, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { AnchorProvider, Wallet, Program } from '@coral-xyz/anchor';
// Optional SDK import (install: npm i @orca-so/whirlpool-sdk)
// import { buildWhirlpoolSwapIx } from '@orca-so/whirlpool-sdk';
import idl from '../idl/arb_bot.json';

export async function buildWhirlpoolSwapPassthrough(
  connection: Connection,
  wallet: Keypair,
  programId: string,
  whirlpoolSwapIx: TransactionInstruction
) {
  const provider = new AnchorProvider(connection, new Wallet(wallet), { commitment: 'confirmed' });
  const program = new Program(idl as any, new PublicKey(programId), provider);

  const accounts = { targetProgram: whirlpoolSwapIx.programId, signer: wallet.publicKey };
  const remainingAccounts = whirlpoolSwapIx.keys.map(k => ({
    pubkey: k.pubkey,
    isWritable: !!k.isWritable,
    isSigner: !!k.isSigner,
  }));

  const method = (program.methods as any).cpiPassthrough(Buffer.from(whirlpoolSwapIx.data));
  const builder = method.accounts(accounts).remainingAccounts(remainingAccounts);
  return builder.instruction();
}
