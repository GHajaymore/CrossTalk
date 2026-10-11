import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { mockConfig } from '../src/config';

let close: (() => Promise<unknown>) | null = null;
afterEach(async () => { await close?.(); close = null; });

describe('serving the face map', () => {
  it('sends WebAssembly as WebAssembly, gzipped when the browser takes it, and lets the browser keep it a week', async () => {
    const web = mkdtempSync(join(tmpdir(), 'ct-web-'));
    writeFileSync(join(web, 'index.html'), '<!doctype html><title>CrossTalk</title>');
    mkdirSync(join(web, 'mediapipe'));
    const wasm = Buffer.from('\0asm-fake-runtime-'.repeat(200));
    writeFileSync(join(web, 'mediapipe', 'vision_wasm_internal.wasm'), wasm);
    writeFileSync(join(web, 'mediapipe', 'vision_wasm_internal.wasm.gz'), gzipSync(wasm));
    const { app } = buildApp(mockConfig({ dbPath: ':memory:', webDir: web }));
    close = () => app.close();

    const zipped = await app.inject({ url: '/mediapipe/vision_wasm_internal.wasm', headers: { 'accept-encoding': 'gzip, br' } });
    expect(zipped.headers['content-type']).toBe('application/wasm');
    expect(zipped.headers['content-encoding']).toBe('gzip');
    expect(zipped.headers['cache-control']).toBe('public, max-age=604800');
    expect(zipped.rawPayload.length).toBeLessThan(wasm.length);

    const plain = await app.inject({ url: '/mediapipe/vision_wasm_internal.wasm' });
    expect(plain.headers['content-encoding']).toBeUndefined();
    expect(plain.rawPayload.equals(wasm)).toBe(true);
    // The page itself is still always checked again.
    expect((await app.inject({ url: '/' })).headers['cache-control']).toBe('no-cache');
  });

  it('sends the app\'s own scripts and page gzipped too, kept for good (they are hashed); the page is always checked', async () => {
    const web = mkdtempSync(join(tmpdir(), 'ct-web-'));
    const page = '<!doctype html><title>CrossTalk</title>' + '<!-- page -->'.repeat(100);
    writeFileSync(join(web, 'index.html'), page);
    writeFileSync(join(web, 'index.html.gz'), gzipSync(page));
    mkdirSync(join(web, 'assets'));
    const js = 'console.log("crosstalk");'.repeat(400);
    writeFileSync(join(web, 'assets', 'index-abc123.js'), js);
    writeFileSync(join(web, 'assets', 'index-abc123.js.gz'), gzipSync(js));
    const { app } = buildApp(mockConfig({ dbPath: ':memory:', webDir: web }));
    close = () => app.close();

    const script = await app.inject({ url: '/assets/index-abc123.js', headers: { 'accept-encoding': 'gzip' } });
    expect(script.headers['content-type']).toBe('text/javascript');
    expect(script.headers['content-encoding']).toBe('gzip');
    expect(script.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(script.rawPayload.length).toBeLessThan(js.length / 5);
    // Any app route (#/… or a deep link) gets the page, gzipped and never kept stale.
    const home = await app.inject({ url: '/', headers: { 'accept-encoding': 'gzip' } });
    expect(home.headers['content-encoding']).toBe('gzip');
    expect(home.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(home.headers['cache-control']).toBe('no-cache');
  });
});
