import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.resolve(process.cwd(), 'data');
const LOG_FILE = path.join(LOG_DIR, 'pnl.log.jsonl');

export function logPnl(entry: { ts: string; tx?: string; pnlUsd?: number; route?: string; note?: string }) {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', 'utf-8');
}

export function readPnlLines(limit = 1000): any[] {
  if (!fs.existsSync(LOG_FILE)) return [];
  const lines = fs.readFileSync(LOG_FILE, 'utf-8').trim().split('\n').slice(-limit);
  return lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
