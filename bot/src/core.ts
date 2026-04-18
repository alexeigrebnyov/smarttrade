import * as anchor from '@coral-xyz/anchor';
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
import idl from '../idl/arb_bot.json';
import BN from 'bn.js';
import { SwapRoute, Opportunity, RouteStep } from './utils/types';
import { DlmmStrategy } from './strategies/dlmm';
import { Router } from './routers/router';
import { Monitoring } from './monitoring/metrics';
import { CircuitBreaker } from './risk/risk';
import { PublicKey as PK } from '@solana/web3.js';

export class TradingBot {
  private program: Program;
  private strategy: DlmmStrategy;
  private router: Router;
  public monitor: Monitoring;
  private breaker: CircuitBreaker;

  private computeMinOut(amount: number, feeBps: number, slippageBps: number): number {
    const totalBps = feeBps + slippageBps;
    const factor = Math.max(0, 1 - totalBps / 10000);
    return Math.floor(amount * factor);
  }


  private static readonly SLIPPAGE_BPS = 30;

  constructor(
    private connection: Connection,
    private wallet: Keypair,
    programId: string
  ) {
    const provider = new AnchorProvider(this.connection, new Wallet(this.wallet), { commitment: 'confirmed' });
    this.program = new Program(idl as anchor.Idl, new PublicKey(programId), provider);
    this.strategy = new DlmmStrategy(this.connection);
    this.router = new Router();
    this.monitor = new Monitoring();
    this.breaker = new CircuitBreaker({ maxDailyLossPct: 5, maxErrors: 10 });
  }

  async scanMarkets(): Promise<Opportunity[]> {
    const pairs = require('../../config/pairs.devnet.json');
    const opps = await this.strategy.findOpportunities({
      pairs: pairs.map((p: any) => ({
        rayPool: new PublicKey(p.rayPool),
        dlmmPool: new PublicKey(p.dlmmPool),
        mints: { in: new PublicKey(p.mints.in), out: new PublicKey(p.mints.out), decimalsIn: p.mints.decimalsIn }
      })),
      amount: 1_000_000,
      maxSlippage: 0.003
    });
    return this.router.selectBest(opps);
  }

  async executeArbitrage(route: SwapRoute, amount: number): Promise<string> {
    this.breaker.ensureCanTrade();
    const tx = await this.prepareTransaction(route, amount);
    const sig = await this.program.provider.sendAndConfirm(tx);
    this.monitor.reportTrade(sig, route.expectedProfit || 0);
    return sig;
  }

  private async prepareTransaction(route: SwapRoute, amount: number): Promise<Transaction> {
    const tx = new Transaction();
    
    for (const step of route.steps) {
      // Build instruction for execute_swap with dex_type parameter
      const ix = await this.program.methods
        .executeSwap(
          new BN(amount), 
          new BN(this.computeMinOut(amount, step.feeBps, TradingBot.SLIPPAGE_BPS)), 
          step.decimals,
          step.dexType || 0 // 0 = Raydium, 1 = Whirlpool
        )
        .accounts({
          userTokenAccount: step.userAccount,
          poolTokenAccount: step.poolAccount,
          tokenMint: step.mint,
          dexProgram: step.dexProgramId,
          ammPool: step.poolAccount, // Pass pool as amm_pool
          ammAuthority: step.ammAuthority || step.poolAccount, // Use provided or fallback
          tokenProgram: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), // SPL Token program
          signer: this.wallet.publicKey
        })
        .instruction();
      tx.add(ix);
    }

    // Final assert: ensure that profit on the last step account meets min threshold
    const last = route.steps[route.steps.length - 1];
    // read balance BEFORE tx for that token account
    const before = await this.program.provider.connection.getTokenAccountBalance(last.userAccount as PK);
    const beforeAmt = before && before.value ? BigInt(before.value.amount) : 0n;
    const minProfit = 1n; // set minimal positive delta (tune per strategy)

    const assertIx = await this.program.methods
      .assertProfit(new BN(beforeAmt.toString()), new BN(minProfit.toString()), last.decimals)
      .accounts({
        targetProgram: last.dexProgramId,
        userProfitToken: last.userAccount,
        signer: this.wallet.publicKey
      })
      .instruction();
    tx.add(assertIx);

    return tx;
  }
  
  /// Helper to get or create ATA for a mint
  async getOrCreateATA(mint: PublicKey): Promise<PublicKey> {
    const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token');
    const { getOrCreateAssociatedTokenAccount } = require('@solana/spl-token');
    
    try {
      const ata = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.wallet,
        mint,
        this.wallet.publicKey
      );
      return ata.address;
    } catch (err) {
      throw new Error(`Failed to get/create ATA for mint ${mint.toBase58()}: ${err}`);
    }
  }
}
