import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { mockConfig } from '../src/config';
import { INSTANT, draft } from './helpers';

const cfg = mockConfig({ dbPath: ':memory:' });
let close: (() => Promise<unknown>) | null = null;
afterEach(async () => { await close?.(); close = null; });

describe('HTTP API', () => {
  it('creates, runs and returns a conversation with its history', async () => {
    const { app, controller } = buildApp(cfg, { timing: INSTANT });
    close = () => app.close();

    const created = await app.inject({ method: 'POST', url: '/api/conversations', payload: draft() });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;

    expect((await app.inject({ method: 'POST', url: `/api/conversations/${id}/start` })).statusCode).toBe(200);
    await controller.settled(id);

    const got = (await app.inject({ url: `/api/conversations/${id}` })).json();
    expect(got.run.state).toBe('completed');
    expect(got.turns).toHaveLength(16);

    // 16 turns + 1 request for Iris, who listens once the episode is complete.
    await new Promise(r => setTimeout(r, 20));
    const config = (await app.inject({ url: '/api/config' })).json();
    expect(config).toMatchObject({ providerMode: 'mock', requestsToday: 17, nextEpisode: 2 });
  });

  it('rejects an empty topic with a readable message', async () => {
    const { app } = buildApp(cfg);
    close = () => app.close();
    const res = await app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft(), topic: '   ' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Add a topic first.');
  });

  it('answers 409 when stopping a conversation that never started', async () => {
    const { app } = buildApp(cfg);
    close = () => app.close();
    const id = (await app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id;
    const res = await app.inject({ method: 'POST', url: `/api/conversations/${id}/stop` });
    expect(res.statusCode).toBe(409);
  });
});

describe('rendered recordings', () => {
  it('serves an episode recording and its timings when tools/voice has made one', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'ct-audio-'));
    const { app } = buildApp(mockConfig({ dbPath: join(dir, 'db.sqlite') }));
    close = () => app.close();
    const id = (await app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id;
    expect((await app.inject({ url: `/api/conversations/${id}` })).json().audio).toBeNull();

    mkdirSync(join(dir, 'audio'));
    writeFileSync(join(dir, 'audio', `${id}.mp3`), Buffer.from('ID3fake'));
    writeFileSync(join(dir, 'audio', `${id}.json`), JSON.stringify({ durationSec: 12.5, voices: { A: 'am_michael', B: 'af_heart' }, timings: [{ seq: 1, speakerId: 'A', start: 0.4, end: 5 }] }));
    const v = (await app.inject({ url: `/api/conversations/${id}` })).json();
    expect(v.audio).toMatchObject({ url: `/api/conversations/${id}/audio.mp3`, durationSec: 12.5, voices: { A: 'am_michael' } });
    const mp3 = await app.inject({ url: v.audio.url });
    expect(mp3.statusCode).toBe(200);
    expect(mp3.headers['content-type']).toBe('audio/mpeg');
    expect((await app.inject({ url: '/api/conversations/../../etc/audio.mp3' })).statusCode).toBe(404);
  });
});
