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

    const config = (await app.inject({ url: '/api/config' })).json();
    expect(config).toMatchObject({ providerMode: 'mock', requestsToday: 16, nextEpisode: 2 });
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
