import { Writable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { draft } from './helpers';
import { delta, fakeFetch, FREE_A, FREE_B, PAID, sse, usageChunk } from './fakeOpenRouter';

const KEY = 'sk-or-v1-TESTSECRET-0123456789abcdef';
const realCfg = (over: Record<string, string> = {}) => ({
  ...loadConfig({ PROVIDER_MODE: 'openrouter', OPENROUTER_API_KEY: KEY, SPEAKER_A_MODEL: FREE_A, SPEAKER_B_MODEL: FREE_B, ...over }),
  dbPath: ':memory:',
});
let close: (() => Promise<unknown>) | null = null;
afterEach(async () => { await close?.(); close = null; });

function boot(over: Record<string, string> = {}, net = fakeFetch()) {
  const lines: string[] = [];
  const stream = new Writable({ write(chunk, _e, cb) { lines.push(String(chunk)); cb(); } });
  const built = buildApp(realCfg(over), { fetch: net.f, logger: { level: 'trace', stream }, sleep: async () => {} });
  close = () => built.app.close();
  return { ...built, net, lines };
}

describe('real mode settings', () => {
  it('reports what is missing instead of crashing', () => {
    const cfg = loadConfig({ PROVIDER_MODE: 'openrouter', SPEAKER_A_MODEL: FREE_A, SPEAKER_B_MODEL: FREE_A });
    expect(cfg.problems).toEqual(['OPENROUTER_API_KEY is not set.', 'Speaker A and Speaker B must use different models.']);
  });

  it('requires the artist model to differ from both speakers', () => {
    const cfg = loadConfig({ PROVIDER_MODE: 'openrouter', OPENROUTER_API_KEY: 'k', SPEAKER_A_MODEL: FREE_A, SPEAKER_B_MODEL: FREE_B, ARTIST_MODEL: FREE_B });
    expect(cfg.problems).toEqual(['ARTIST_MODEL must differ from both speaker models.']);
  });

  it('blocks a run before any model request when settings are incomplete', async () => {
    const { app, net } = boot({ OPENROUTER_API_KEY: '' });
    const id = (await app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id;
    const res = await app.inject({ method: 'POST', url: `/api/conversations/${id}/start` });
    expect(res.statusCode).toBe(412);
    expect(res.json().error).toMatch(/OPENROUTER_API_KEY is not set/);
    expect(net.chatCalls()).toHaveLength(0);
  });
});

describe('real mode runs', () => {
  it('runs a full discussion with two free models', async () => {
    const net = fakeFetch({ replies: (call, n) => sse([delta(`Turn ${n} from ${call.body!.model}.`), usageChunk(200, 6, 0), '[DONE]']) });
    const { app, controller } = boot({}, net);
    const created = (await app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json();
    expect(created.speakers.A.modelId).toBe(FREE_A);
    expect(created.speakers.B.modelId).toBe(FREE_B);

    expect((await app.inject({ method: 'POST', url: `/api/conversations/${created.id}/start` })).statusCode).toBe(200);
    await controller.settled(created.id);
    const v = (await app.inject({ url: `/api/conversations/${created.id}` })).json();
    expect(v.run.state).toBe('completed');
    expect(v.turns.map((t: { text: string }) => t.text)).toEqual(Array.from({ length: 16 }, (_, i) => `Turn ${i + 1} from ${i % 2 ? FREE_B : FREE_A}.`));
    expect(net.chatCalls().map(c => c.body!.model)).toEqual(Array.from({ length: 16 }, (_, i) => (i % 2 ? FREE_B : FREE_A)));

    const cfg = (await app.inject({ url: '/api/config' })).json();
    // 16 turns + 1 request that wrote the host roles.
    expect(cfg).toMatchObject({ providerMode: 'openrouter', requestsToday: 17, apiKeySet: true, problems: [] });
    expect(cfg.usageToday).toEqual({ attempts: 16, tokensIn: 3200, tokensOut: 96, costUsd: 0 });
    expect(cfg.guard.verdicts.map((x: { ok: boolean }) => x.ok)).toEqual([true, true]);
  });

  it('blocks a paid model by name, before any chat request', async () => {
    const { app, net } = boot({ SPEAKER_B_MODEL: PAID });
    const id = (await app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id;
    const res = await app.inject({ method: 'POST', url: `/api/conversations/${id}/start` });
    expect(res.statusCode).toBe(412);
    expect(res.json().error).toContain(`${PAID}: Not free`);
    expect(net.chatCalls()).toHaveLength(0);
  });

  it('blocks every run when the model list cannot be read', async () => {
    const { app, net } = boot({}, fakeFetch({ listFails: true }));
    const id = (await app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id;
    const res = await app.inject({ method: 'POST', url: `/api/conversations/${id}/start` });
    expect(res.statusCode).toBe(412);
    expect(res.json().error).toMatch(/Couldn't read OpenRouter's model list/);
    expect(net.chatCalls()).toHaveLength(0);
  });

  it('refuses the mock controls in real mode', async () => {
    const { app } = boot();
    expect((await app.inject({ method: 'PUT', url: '/api/mock', payload: { failOnce: true, fast: true } })).statusCode).toBe(409);
  });
});

describe('host roles that fit the topic', () => {
  it('asks the speaker A model once for two roles and stores them on the hosts', async () => {
    const { app, net } = boot();
    const c = (await app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json();
    expect(c.speakers.A.role).toBe('Owner of a small accounting firm');
    expect(c.speakers.B.role).toBe('Researcher who studies working hours');
    const [call] = net.roleCalls();
    expect(net.roleCalls()).toHaveLength(1);
    expect(call.body).toMatchObject({ model: FREE_A });
    expect(JSON.stringify(call.body)).toContain('<topic>Is a four-day workweek practical?</topic>');
    expect((await app.inject({ url: '/api/config' })).json().requestsToday).toBe(1);
  });

  it('falls back to the built-in roles when the reply is unusable, and never fails to create', async () => {
    const { app } = boot({}, fakeFetch({ roles: () => Response.json({ choices: [{ message: { content: 'Sorry, I cannot do that.' } }] }) }));
    const res = await app.inject({ method: 'POST', url: '/api/conversations', payload: draft() });
    expect(res.statusCode).toBe(201);
    expect(res.json().speakers.A.role).toBe('Owner of a 20-person design studio');
  });

  it('keeps a role typed by the listener and asks for none when both are typed', async () => {
    const { app, net } = boot();
    const d = draft();
    d.speakers.A = { ...d.speakers.A, role: 'Night-shift nurse', autoRole: false };
    d.speakers.B = { ...d.speakers.B, role: 'Hospital manager', autoRole: false };
    const c = (await app.inject({ method: 'POST', url: '/api/conversations', payload: d })).json();
    expect([c.speakers.A.role, c.speakers.B.role]).toEqual(['Night-shift nurse', 'Hospital manager']);
    expect(net.roleCalls()).toHaveLength(0);
  });

  it('writes no roles with a model when the free-model check fails', async () => {
    const { app, net } = boot({ SPEAKER_B_MODEL: PAID });
    const c = (await app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json();
    expect(net.roleCalls()).toHaveLength(0);
    expect(c.speakers.B.role).toBe('Researcher who studies how people work');
  });
});

describe('the API key stays on the server', () => {
  it('never appears in logs or in any response, even when requests fail', async () => {
    let n = 0;
    const net = fakeFetch({ replies: () => (++n === 3 ? new Response(JSON.stringify({ error: { message: 'boom' } }), { status: 500 }) : sse([delta('Words.'), '[DONE]'])) });
    const { app, controller, lines } = boot({}, net);
    const bodies: string[] = [];
    const id = (await app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id;
    bodies.push((await app.inject({ method: 'POST', url: `/api/conversations/${id}/start` })).body);
    await controller.settled(id);
    for (const url of ['/api/config', `/api/conversations/${id}`, `/api/conversations/${id}/usage`, '/api/conversations']) {
      bodies.push((await app.inject({ url })).body);
    }
    bodies.push((await app.inject({ method: 'POST', url: '/api/guard/check' })).body);

    expect(lines.length).toBeGreaterThan(5);
    for (const text of [...lines, ...bodies]) expect(text).not.toContain(KEY);
    expect(net.chatCalls().length).toBeGreaterThan(0);
  });
});
