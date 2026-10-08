import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { loadConfig, mockConfig } from '../src/config';

let close: (() => Promise<unknown>) | null = null;
afterEach(async () => { await close?.(); close = null; });

const CODE = 'harbour-lantern-42';
const locked = () => {
  const { app } = buildApp(mockConfig({ dbPath: ':memory:', accessCode: CODE, webDir: '/nonexistent' }));
  close = () => app.close();
  return app;
};
const cookieOf = (setCookie: unknown) => String(setCookie).split(';')[0];

describe('hosting needs an access code', () => {
  it('with real models, refuses to start on a public address without one', () => {
    const real = { PROVIDER_MODE: 'openrouter', HOST: '0.0.0.0' };
    expect(() => loadConfig(real)).toThrow(/ACCESS_CODE must be set/);
    expect(() => loadConfig({ ...real, ACCESS_CODE: 'short' })).toThrow(/at least 8/);
    expect(loadConfig({ ...real, ACCESS_CODE: CODE }).accessCode).toBe(CODE);
    expect(loadConfig({}).accessCode).toBeNull();
  });

  it('mock mode stays open, even hosted and even with a code set (no key, no budget to protect)', () => {
    expect(loadConfig({ HOST: '0.0.0.0' }).accessCode).toBeNull();
    expect(loadConfig({ HOST: '0.0.0.0', ACCESS_CODE: CODE }).accessCode).toBeNull();
  });

  it('locks every API route until the code is entered, and the cookie never holds the code', async () => {
    const app = locked();
    expect((await app.inject({ url: '/api/access' })).json()).toEqual({ required: true, ok: false });
    const blocked = await app.inject({ url: '/api/conversations' });
    expect(blocked.statusCode).toBe(401);
    expect(blocked.json().locked).toBe(true);
    expect((await app.inject({ url: '/api/config' })).statusCode).toBe(401);

    const wrong = await app.inject({ method: 'POST', url: '/api/access', payload: { code: 'nope-nope-nope' } });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.headers['set-cookie']).toBeUndefined();

    const right = await app.inject({ method: 'POST', url: '/api/access', payload: { code: CODE } });
    expect(right.statusCode).toBe(200);
    const cookie = cookieOf(right.headers['set-cookie']);
    expect(String(right.headers['set-cookie'])).toMatch(/HttpOnly; SameSite=Strict/);
    expect(cookie).not.toContain(CODE);

    expect((await app.inject({ url: '/api/conversations', headers: { cookie } })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/access', headers: { cookie } })).json()).toEqual({ required: true, ok: true });
    expect((await app.inject({ url: '/api/conversations', headers: { cookie: 'ct_access=forged' } })).statusCode).toBe(401);
  });

  it('stops guessing after 5 wrong codes', async () => {
    const app = locked();
    for (let i = 0; i < 5; i++) expect((await app.inject({ method: 'POST', url: '/api/access', payload: { code: `guess-${i}-xxxx` } })).statusCode).toBe(401);
    const sixth = await app.inject({ method: 'POST', url: '/api/access', payload: { code: CODE } });
    expect(sixth.statusCode).toBe(429);
  });

  it('stays open on your own machine', async () => {
    const { app } = buildApp(mockConfig({ dbPath: ':memory:', webDir: '/nonexistent' }));
    close = () => app.close();
    expect((await app.inject({ url: '/api/conversations' })).statusCode).toBe(200);
  });
});

describe('serving the built web app', () => {
  it('serves the page and its files, and never anything outside the build folder', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ct-web-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), '<div id="root"></div>');
    writeFileSync(join(dir, 'assets', 'app-123.js'), 'console.log(1)');
    const { app } = buildApp(mockConfig({ dbPath: ':memory:', webDir: dir }));
    close = () => app.close();
    const page = await app.inject({ url: '/' });
    expect(page.statusCode).toBe(200);
    expect(page.headers['content-type']).toContain('text/html');
    const js = await app.inject({ url: '/assets/app-123.js' });
    expect(js.body).toBe('console.log(1)');
    expect(js.headers['cache-control']).toContain('immutable');
    const escape = await app.inject({ url: '/..%2F..%2Fetc%2Fpasswd' });
    expect(escape.body).toBe('<div id="root"></div>');
    expect((await app.inject({ url: '/api/nope' })).statusCode).toBe(404);
    expect((await app.inject({ url: '/missing.js' })).statusCode).toBe(404);
    expect((await app.inject({ url: '/anything' })).body).toBe('<div id="root"></div>');
  });
});
