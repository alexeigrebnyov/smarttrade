import * as anchor from '@coral-xyz/anchor';
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import idl from '../idl/arb_bot.json';
import BN from 'bn.js';
import { SwapRoute, Opportunity } from './utils/types';
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
    this.monitor.reportTrade(sig, 0);
    return sig;
  }

  private async prepareTransaction(route: SwapRoute, amount: number): Promise<Transaction> {
    const tx = new Transaction();
    for (const step of route.steps) {
      const ix = await this.program.methods
        .executeSwap(new BN(amount), new BN(this.computeMinOut(amount, step.feeBps, TradingBot.SLIPPAGE_BPS)), step.decimals)
        .accounts({
          userTokenAccount: step.userAccount,
          poolTokenAccount: step.poolAccount,
          tokenMint: step.mint,
          dexProgram: step.dexProgramId,
          signer: this.wallet.publicKey
        })
        .instruction();
      tx.add(ix);
    }

    // Final assert: ensure that profit on the last step account meets min threshold
    const last = route.steps[route.steps.length - 1];
    // read balance BEFORE tx for that token account
    const before = await this.program.provider.connection.getTokenAccountBalance(last.userAccount as PK);
    const beforeAmt = before && before.value ? Number(before.value.amount) : 0;
    const minProfit = 1; // set minimal positive delta (tune per strategy)

    const assertIx = await (this.program.methods as any)
      .assertProfit(new BN(beforeAmt), new BN(minProfit), last.decimals)
      .accounts({
        targetProgram: last.dexProgramId,
        userProfitToken: last.userAccount,
        signer: this.wallet.publicKey
      })
      .instruction();
    tx.add(assertIx);

    return tx;
  }
}
