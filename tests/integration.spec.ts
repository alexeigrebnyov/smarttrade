import * as anchor from '@coral-xyz/anchor';
import { TradingBot } from '../bot/src/core';
import { Connection, Keypair } from '@solana/web3.js';
import { expect } from 'chai';

describe('Arbitrage Bot', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const connection = new Connection(provider.connection.rpcEndpoint, 'confirmed');
  const wallet = (provider.wallet as any).payer as Keypair;
  const bot = new TradingBot(connection, wallet, process.env.PROGRAM_ID!);

  it('scans and prepares routes', async () => {
    const opps = await bot.scanMarkets();
    expect(opps).to.be.an('array');
  });
});
