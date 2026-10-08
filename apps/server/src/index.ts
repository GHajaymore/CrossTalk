import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { loadConfig } from './config';

// Settings live in the repo's .env file (never committed). Real environment variables win.
const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

let cfg;
try {
  cfg = loadConfig();
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
mkdirSync(dirname(cfg.dbPath), { recursive: true });
const { app } = buildApp(cfg, { logger: true });
// Binds to localhost only by default; the prototype is not meant to be reachable from other machines.
await app.listen({ host: cfg.host, port: cfg.port });
console.log(`CrossTalk server · ${cfg.providerMode} mode · http://${cfg.host}:${cfg.port}`);
for (const p of cfg.problems) console.warn(`Real mode is blocked: ${p}`);
