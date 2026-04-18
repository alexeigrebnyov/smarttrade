export class CircuitBreaker {
  private errors = 0;
  private dailyLossPct = 0;
  constructor(private cfg: { maxDailyLossPct: number; maxErrors: number }) {}
  ensureCanTrade() {
    if (this.dailyLossPct <= -Math.abs(this.cfg.maxDailyLossPct)) {
      throw new Error('CircuitBreaker: daily loss limit reached');
    }
    if (this.errors >= this.cfg.maxErrors) {
      throw new Error('CircuitBreaker: too many errors');
    }
  }
  onError() { this.errors += 1; }
  onPnl(pct: number) { this.dailyLossPct += pct; }
}
