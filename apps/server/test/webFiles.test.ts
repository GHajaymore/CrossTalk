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
});
