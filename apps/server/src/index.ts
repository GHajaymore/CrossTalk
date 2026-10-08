import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildApp } from './app';
import { loadConfig } from './config';

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
console.log(`CrossTalk server · mock mode · http://${cfg.host}:${cfg.port}`);
