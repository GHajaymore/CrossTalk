import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { build } from 'vite';

const web = fileURLToPath(new URL('../../web', import.meta.url));
const walk = (dir: string): string[] => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

describe('web app', () => {
  it('never reads a key or contains one in its source', () => {
    for (const file of walk(join(web, 'src'))) expect(readFileSync(file, 'utf8'), file).not.toMatch(/sk-or-|import\.meta\.env|process\.env/);
  });

  it('does not contain the API key after a build, even with the key in the environment', async () => {
    const KEY = 'sk-or-v1-BUNDLESECRET-fedcba9876543210';
    const out = mkdtempSync(join(tmpdir(), 'crosstalk-web-'));
    const before = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = KEY;
    process.env.VITE_OPENROUTER_API_KEY = KEY;
    try {
      await build({ root: web, configFile: join(web, 'vite.config.ts'), logLevel: 'silent', build: { outDir: out, emptyOutDir: true } });
    } finally {
      if (before === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = before;
      delete process.env.VITE_OPENROUTER_API_KEY;
    }
    const files = walk(out);
    expect(files.some(f => f.endsWith('.js'))).toBe(true);
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toContain(KEY);
  }, 60_000);
});
