import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { loadConfig, mockConfig } from '../src/config';
import { openDb } from '../src/db/repo';

let close: (() => Promise<unknown>) | null = null;
afterEach(async () => { await close?.(); close = null; });

const storageOf = async (over: Parameters<typeof mockConfig>[0]) => {
  const { app } = buildApp(mockConfig({ dbPath: ':memory:', webDir: '/nonexistent', ...over }));
  close = () => app.close();
  return (await app.inject({ url: '/api/config' })).json().storage;
};

describe('keeping episodes for good', () => {
  it('only counts as backed up when the start script says Litestream is running', () => {
    expect(loadConfig({}).backup).toBe(false);
    expect(loadConfig({ BACKUP_BUCKET: 'b' }).backup).toBe(false);
    expect(loadConfig({ CROSSTALK_BACKUP: 'on' }).backup).toBe(true);
  });

  it("tells the app where episodes and Iris's sketches are kept", async () => {
    expect(await storageOf({ hosted: false })).toBe('local');
    expect(await storageOf({ hosted: true, backup: false })).toBe('forgets');
    expect(await storageOf({ hosted: true, backup: true })).toBe('backed-up');
  });

  it('waits for the backup instead of failing when it briefly holds the database', () => {
    expect(openDb(':memory:').pragma('busy_timeout', { simple: true })).toBe(5000);
  });
});
