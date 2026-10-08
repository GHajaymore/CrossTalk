import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { ServerConfig } from './config';

const COOKIE = 'ct_access';
const MAX_AGE_S = 30 * 24 * 3600;
/** Wrong codes allowed per address, and in total, per window. A real code is long enough that this stops guessing. */
const PER_IP = 5;
const TOTAL = 30;
const WINDOW_MS = 10 * 60_000;

const digest = (s: string) => createHash('sha256').update(s).digest();
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

/**
 * The lock for a hosted CrossTalk: with ACCESS_CODE set, every /api route needs the access cookie,
 * which you get by entering the code once. The cookie holds a keyed hash, never the code itself.
 */
export function registerAccess(app: FastifyInstance, cfg: ServerConfig) {
  const code = cfg.accessCode;
  const token = code ? createHmac('sha256', code).update('crosstalk-access-v1').digest('hex') : '';
  const hasCookie = (header: string | undefined) => {
    if (!code) return true;
    const v = (header ?? '').split(/;\s*/).find(c => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? '';
    return !!v && same(v, token);
  };

  let window = { start: Date.now(), total: 0, byIp: new Map<string, number>() };
  const fresh = () => { if (Date.now() - window.start > WINDOW_MS) window = { start: Date.now(), total: 0, byIp: new Map() }; };

  app.get('/api/access', async req => ({ required: !!code, ok: hasCookie(req.headers.cookie) }));

  app.post<{ Body: { code?: unknown } }>('/api/access', async (req, reply) => {
    if (!code) return { required: false, ok: true };
    fresh();
    if (window.total >= TOTAL || (window.byIp.get(req.ip) ?? 0) >= PER_IP) {
      return reply.status(429).send({ error: 'Too many wrong codes. Wait 10 minutes and try again.' });
    }
    const given = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    if (!given || !same(given, code)) {
      window.total++;
      window.byIp.set(req.ip, (window.byIp.get(req.ip) ?? 0) + 1);
      return reply.status(401).send({ error: "That code isn't right." });
    }
    const secure = req.protocol === 'https' ? '; Secure' : '';
    reply.header('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE_S}${secure}`);
    return { required: true, ok: true };
  });

  app.delete('/api/access', async (_req, reply) => {
    reply.header('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
    return { required: !!code, ok: false };
  });

  app.addHook('onRequest', async (req, reply) => {
    const path = req.url.split('?')[0];
    if (!path.startsWith('/api/') || path === '/api/access') return;
    if (!hasCookie(req.headers.cookie)) return reply.status(401).send({ error: 'Enter the access code first.', locked: true });
  });
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

/** Serves the built web app (apps/web/dist) so a host only has to run this one server. */
export function registerWeb(app: FastifyInstance, cfg: ServerConfig) {
  if (!cfg.webDir) return false;
  const root = normalize(cfg.webDir);
  if (!existsSync(join(root, 'index.html'))) return false;
  app.get('/*', (req, reply) => {
    const path = decodeURIComponent(req.url.split('?')[0]);
    if (path.startsWith('/api/')) return reply.status(404).send({ error: 'Not found.' });
    const file = normalize(join(root, path === '/' ? 'index.html' : path));
    const inside = file.startsWith(root + sep);
    const found = inside && existsSync(file) && statSync(file).isFile();
    // A missing file is a 404; any other path is the app itself (it routes with #/…).
    if (!found && extname(path)) return reply.status(404).send({ error: 'Not found.' });
    const target = found ? file : join(root, 'index.html');
    // Hashed build files never change; the page itself is always checked again.
    reply.header('Cache-Control', target.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
    return reply.type(TYPES[extname(target)] ?? 'application/octet-stream').send(createReadStream(target));
  });
  return true;
}
