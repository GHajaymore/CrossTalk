import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { BackupWatch, newestCopy, plainError } from '../src/backup';
import { loadConfig, mockConfig } from '../src/config';

// Real output of `litestream generations` (v0.3.13), with two generations.
const OUT = `name  generation        lag   start                 end
s3    a1b2c3d4e5f60718  1.9s  2026-10-08T21:33:20Z  2026-10-09T09:10:00Z
s3    fbcc5b2a51e725ab  1.9s  2026-10-09T21:33:20Z  2026-10-09T21:40:23Z
`;

let close: (() => Promise<unknown>) | null = null;
afterEach(async () => { await close?.(); close = null; });

describe('is the backup really working?', () => {
  it('reads when the bucket last received a copy, and knows an empty bucket', () => {
    expect(newestCopy(OUT)).toBe('2026-10-09T21:40:23Z');
    expect(newestCopy('name  generation        lag   start                 end\n')).toBeNull();
  });

  it("explains a failure in Litestream's words, never with the key in it", () => {
    const err = 'time=… level=ERROR msg="cannot list generations"\nInvalidAccessKeyId: key 0045abcd not valid; secret K005SECRETVALUE';
    const t = plainError(err, ['0045abcd', 'K005SECRETVALUE']);
    expect(t).toContain('InvalidAccessKeyId');
    expect(t).not.toContain('0045abcd');
    expect(t).not.toContain('K005SECRETVALUE');
  });

  it('keeps just the reason from a Litestream log line, e.g. a used-up daily cap', () => {
    const line = 'time=2026-10-10T11:48:54.780-04:00 level=ERROR msg="failed to run" error="cannot fetch generations: AccessDenied: Transaction cap exceeded, see the Caps & Alerts page to increase your cap\\n\\tstatus code: 403, request id: 04fb"';
    expect(plainError(line, [])).toBe('cannot fetch generations: AccessDenied: Transaction cap exceeded, see the Caps & Alerts page to increase your cap');
  });

  it('a start that could not read the bucket says so, with the reason, and never checks it', async () => {
    let asked = 0;
    const w = new BackupWatch({ on: false, restore: 'failed', restoreError: 'level=ERROR error="AccessDenied: Transaction cap exceeded"', list: async () => { asked++; return OUT; }, secrets: [] });
    expect(w.status).toMatchObject({ state: 'off', restore: 'failed', detail: 'AccessDenied: Transaction cap exceeded' });
    await w.check();
    expect(asked).toBe(0);
  });

  it('starts as "checking", then says ok with the time, or failing with why', async () => {
    let next: () => Promise<string> = async () => OUT;
    const w = new BackupWatch({ on: true, restore: 'restored', list: () => next(), secrets: [], now: () => new Date('2026-10-09T21:41:00Z') });
    expect(w.status.state).toBe('checking');
    expect(await w.check()).toMatchObject({ state: 'ok', lastAt: '2026-10-09T21:40:23Z', restore: 'restored', checkedAt: '2026-10-09T21:41:00.000Z' });
    next = () => Promise.reject(Object.assign(new Error('exit 1'), { stderr: 'AccessDenied: not entitled' }));
    expect(await w.check()).toMatchObject({ state: 'failing', detail: 'AccessDenied: not entitled' });
    next = async () => 'name  generation  lag  start  end\n';
    expect(await w.check()).toMatchObject({ state: 'failing', detail: 'The bucket has no copies yet.' });
  });

  it('is off without a backup, and never asks', async () => {
    let asked = 0;
    const w = new BackupWatch({ on: false, restore: null, list: async () => { asked++; return OUT; }, secrets: [] });
    expect((await w.check()).state).toBe('off');
    expect(asked).toBe(0);
  });

  it('knows how this start began, from the start script', () => {
    expect(loadConfig({ CROSSTALK_BACKUP: 'on', CROSSTALK_RESTORE: 'empty' }).backupRestore).toBe('empty');
    expect(loadConfig({ CROSSTALK_RESTORE: 'nonsense' }).backupRestore).toBeNull();
  });

  it('shows the real state in the app, and asks the bucket at most once a minute', async () => {
    let asked = 0;
    const built = buildApp(mockConfig({ dbPath: ':memory:', backup: true, hosted: true, host: '0.0.0.0' }), { backupList: async () => { asked++; return OUT; } });
    close = () => built.app.close();
    expect((await built.app.inject({ url: '/api/config' })).json()).toMatchObject({ storage: 'backed-up', backup: { state: 'checking' } });
    const first = (await built.app.inject({ method: 'POST', url: '/api/backup/check' })).json();
    expect(first.backup).toMatchObject({ state: 'ok', lastAt: '2026-10-09T21:40:23Z' });
    await built.app.inject({ method: 'POST', url: '/api/backup/check' });
    expect(asked).toBe(1);
  });
});
