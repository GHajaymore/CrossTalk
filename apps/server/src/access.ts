import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ServerConfig } from './config';

const COOKIE = 'ct_access';
const MAX_AGE_S = 30 * 24 * 3600;
/** Wrong codes allowed per address, and in total, per window. A real code is long enough that this stops guessing. */
const PER_IP = 5;
const TOTAL = 30;
const WINDOW_MS = 10 * 60_000;

const digest = (s: string) => createHash('sha256').update(s).digest();
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

type Lock = { cookie: string; code: string | null; salt: string };

/**
 * Which route a request will run: the matched route pattern, or for an unmatched request its decoded
 * path, so an encoded path can never reach a route its prefix check didn't see.
 */
const routeOf = (req: FastifyRequest) => {
  const matched = req.routeOptions?.url;
  if (matched && matched !== '/*') return matched;
  try { return decodeURIComponent(req.url.split('?')[0]); } catch { return '/api/'; }
};

/** A code you type once per device; the cookie holds a keyed hash, never the code itself. */
function makeLock({ cookie, code, salt }: Lock) {
  const token = code ? createHmac('sha256', code).update(salt).digest('hex') : '';
  let window = { start: Date.now(), total: 0, byIp: new Map<string, number>() };
  const has = (header: string | undefined) => {
    if (!code) return false;
    const v = (header ?? '').split(/;\s*/).find(c => c.startsWith(`${cookie}=`))?.slice(cookie.length + 1) ?? '';
    return !!v && same(v, token);
  };
  /** Checks a typed code; wrong codes are limited per address and in total. */
  const signIn = (given: unknown, ip: string, https: boolean): { status: number; error?: string; setCookie?: string } => {
    if (Date.now() - window.start > WINDOW_MS) window = { start: Date.now(), total: 0, byIp: new Map() };
    if (window.total >= TOTAL || (window.byIp.get(ip) ?? 0) >= PER_IP) return { status: 429, error: 'Too many wrong codes. Wait 10 minutes and try again.' };
    const g = typeof given === 'string' ? given.trim() : '';
    if (!code || !g || !same(g, code)) {
      window.total++;
      window.byIp.set(ip, (window.byIp.get(ip) ?? 0) + 1);
      return { status: 401, error: "That code isn't right." };
    }
    return { status: 200, setCookie: `${cookie}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE_S}${https ? '; Secure' : ''}` };
  };
  const signOut = () => `${cookie}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
  return { has, signIn, signOut };
}

/**
 * The lock for a hosted CrossTalk with real models: with ACCESS_CODE set, every /api route needs the
 * access cookie. Mock mode has no code, so it stays open.
 */
export function registerAccess(app: FastifyInstance, cfg: ServerConfig) {
  const code = cfg.accessCode;
  const lock = makeLock({ cookie: COOKIE, code, salt: 'crosstalk-access-v1' });
  const ok = (header: string | undefined) => !code || lock.has(header);

  app.get('/api/access', async req => ({ required: !!code, ok: ok(req.headers.cookie) }));
  app.post<{ Body: { code?: unknown } }>('/api/access', async (req, reply) => {
    if (!code) return { required: false, ok: true };
    const r = lock.signIn(req.body?.code, req.ip, req.protocol === 'https');
    if (r.status !== 200) return reply.status(r.status).send({ error: r.error });
    reply.header('Set-Cookie', r.setCookie!);
    return { required: true, ok: true };
  });
  app.delete('/api/access', async (_req, reply) => {
    reply.header('Set-Cookie', lock.signOut());
    return { required: !!code, ok: false };
  });

  app.addHook('onRequest', async (req, reply) => {
    // The route Fastify actually matched (after decoding), never the raw URL: "/%61pi/..." can't slip past.
    const path = routeOf(req);
    if (!path.startsWith('/api/') || path === '/api/access') return;
    if (!ok(req.headers.cookie)) return reply.status(401).send({ error: 'Enter the access code first.', locked: true });
  });
}

/**
 * The Control room's own lock. On your own computer it's open. Online (any mode) every /api/admin
 * route needs the admin cookie from ADMIN_CODE (or ACCESS_CODE); with no code set, it stays shut.
 */
export function registerAdmin(app: FastifyInstance, cfg: ServerConfig) {
  const lock = makeLock({ cookie: 'ct_admin', code: cfg.adminCode, salt: 'crosstalk-admin-v1' });
  const ok = (header: string | undefined) => !cfg.hosted || lock.has(header);
  const state = (header: string | undefined) => ({ required: cfg.hosted, ok: ok(header), configured: !cfg.hosted || !!cfg.adminCode });

  app.get('/api/admin/access', async req => state(req.headers.cookie));
  app.post<{ Body: { code?: unknown } }>('/api/admin/access', async (req, reply) => {
    if (!cfg.hosted) return state(req.headers.cookie);
    if (!cfg.adminCode) return reply.status(403).send({ error: "The Control room has no admin code yet. Add ADMIN_CODE in Render's Environment." });
    const r = lock.signIn(req.body?.code, req.ip, req.protocol === 'https');
    if (r.status !== 200) return reply.status(r.status).send({ error: r.error });
    reply.header('Set-Cookie', r.setCookie!);
    return { required: true, ok: true, configured: true };
  });

  app.addHook('onRequest', async (req, reply) => {
    const path = routeOf(req);
    if (!path.startsWith('/api/admin/') || path === '/api/admin/access') return;
    if (!ok(req.headers.cookie)) return reply.status(403).send({ error: 'Sign in to the Control room first.', adminLocked: true });
  });
  return { state };
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.wasm': 'application/wasm', '.md': 'text/markdown; charset=utf-8',
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
    // Hashed build files never change; the face map (big, changes only with a new version) is kept a
    // week; the page itself is always checked again.
    const big = target.includes(`${sep}mediapipe${sep}`) || target.includes(`${sep}models${sep}`);
    reply.header('Cache-Control', target.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : big ? 'public, max-age=604800' : 'no-cache');
    reply.type(TYPES[extname(target)] ?? 'application/octet-stream');
    // A ready-made gzip copy, when there is one and the browser takes it (the face map's 11 MB runtime goes down to about a third).
    if (existsSync(`${target}.gz`) && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) {
      reply.header('Content-Encoding', 'gzip').header('Vary', 'Accept-Encoding');
      return reply.send(createReadStream(`${target}.gz`));
    }
    return reply.send(createReadStream(target));
  });
  return true;
}
