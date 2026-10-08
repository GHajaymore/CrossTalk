import { DAILY_LIMIT_DEFAULT, MAX_TURNS } from '@crosstalk/shared';

const int = (v: string | undefined, d: number) => (v && /^\d+$/.test(v) ? Number(v) : d);

export type ServerConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const mode = (env.PROVIDER_MODE || 'mock').toLowerCase();
  if (mode !== 'mock') {
    // No silent fallback: real models arrive in Milestone 2.
    throw new Error(`PROVIDER_MODE=${mode} isn't available yet. Milestone 1 runs in mock mode only; set PROVIDER_MODE=mock.`);
  }
  return {
    providerMode: 'mock' as const,
    host: env.HOST || '127.0.0.1',
    port: int(env.PORT, 8787),
    dbPath: env.DB_PATH || new URL('../data/crosstalk.sqlite', import.meta.url).pathname,
    dailyLimit: int(env.MAX_REQUESTS_PER_DAY, DAILY_LIMIT_DEFAULT),
    maxTurns: Math.min(int(env.MAX_TURNS_PER_RUN, MAX_TURNS), MAX_TURNS),
    // Mock IDs, shown in the UI like real model IDs will be. Not real models.
    models: { A: 'mock/wren-v1', B: 'mock/hale-v1' },
  };
}
