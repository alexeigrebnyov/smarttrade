import express from 'express';
import client from 'prom-client';
import { sendTelegram, sendDiscord } from './alerts';
import { logPnl } from './pnl';

export class Monitoring {
  private app = express();
  private register = new client.Registry();
  private profit = new client.Gauge({ name: 'bot_profit_usd', help: 'Cumulative PnL' });
  private errors = new client.Counter({ name: 'bot_errors_total', help: 'Errors count' });
  constructor() {
    this.register.registerMetric(this.profit);
    this.register.registerMetric(this.errors);
    client.collectDefaultMetrics({ register: this.register });
    this.app.get('/metrics', async (_req, res) => {
      res.set('Content-Type', this.register.contentType);
      res.end(await this.register.metrics());
    });
    this.app.listen(9300, () => console.log('Metrics on :9300/metrics'));
  }
  reportTrade(txId: string, pnlUsd: number) { this.profit.set(pnlUsd); logPnl({ ts: new Date().toISOString(), tx: txId, pnlUsd }); const dash = process.env.DASHBOARD_URL || ''; sendTelegram(`✅ Trade: ${txId} PnL=${pnlUsd} ${dash&&'\n'+dash}`); sendDiscord(`✅ Trade: ${txId} PnL=${pnlUsd} ${dash&&'\n'+dash}`); }
  reportError(e: unknown) { console.error(e); this.errors.inc(); const msg = (e instanceof Error) ? e.message : String(e); sendTelegram(`⚠️ Error: ${msg}`); sendDiscord(`⚠️ Error: ${msg}`); }
}
