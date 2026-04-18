import * as fs from 'fs';
export type EnvMode = 'dev' | 'prod';
export function loadEnv(mode: EnvMode): Record<string,string> {
  const path = mode === 'prod' ? '.env.prod' : '.env';
  const lines = fs.readFileSync(path, 'utf-8').split('\n').filter(Boolean);
  const env: Record<string,string> = {};
  for (const line of lines) {
    if (line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx+1).trim();
    if (k) env[k] = v;
  }
  return env;
}
