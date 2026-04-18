import { Connection } from '@solana/web3.js';
import { loadEnv } from './utils/env';
import { keypairFromEnv } from './utils/wallet';
import { TradingBot } from './core';

async function main() {
  const cfg = loadEnv('dev'); // change to 'prod' for mainnet
  const connection = new Connection(cfg.RPC_URL, 'confirmed');
  const wallet = keypairFromEnv(cfg.WALLET_SECRET);
  const bot = new TradingBot(connection, wallet, cfg.PROGRAM_ID);

  setInterval(async () => {
    try {
      const opps = await bot.scanMarkets();
      for (const opp of opps) {
        try {
          const sig = await bot.executeArbitrage(opp.route, opp.amount);
          console.log('Trade:', sig);
        } catch (e) { bot.monitor.reportError(e); }
      }
    } catch (e) { bot.monitor.reportError(e); }
  }, 60_000);
}

main().catch(console.error);
