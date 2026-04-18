import fs from 'fs';
export class Backtester {
  runFromCsv(csvPath: string): { sharpe: number; maxDrawdown: number; pnl: number } {
    const rows = fs.readFileSync(csvPath, 'utf-8').trim().split('\n').slice(1);
    let pnl = 0, maxD = 0;
    for (const r of rows) {
      const [t, raySolUsdc, orcaSolUsdc] = r.split(',').slice(0,3).map(Number);
      const edge = Math.abs(raySolUsdc - orcaSolUsdc);
      pnl += edge * 100;
      maxD = Math.min(maxD, pnl);
    }
    const sharpe = pnl / (Math.abs(maxD) + 1);
    return { sharpe, maxDrawdown: Math.abs(maxD), pnl };
  }
}
