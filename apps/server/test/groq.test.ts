import { Writable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { GroqModelGuard } from '../src/guard/groqModelGuard';
import { OpenRouterProvider, SERVICES, stripThinking } from '../src/providers/openrouter';
import { ProviderError } from '../src/providers/types';
import type { Conversation } from '@crosstalk/shared';
import { draft } from './helpers';
import { delta, fakeFetch, FREE_A, FREE_B, sse } from './fakeOpenRouter';

const KEY = 'gsk_TESTSECRET_0123456789abcdef';
const groqCfg = (over: Record<string, string> = {}) => ({
  ...loadConfig({ PROVIDER_MODE: 'groq', GROQ_API_KEY: KEY, GROQ_PLAN: 'free', SPEAKER_A_MODEL: FREE_A, SPEAKER_B_MODEL: FREE_B, ...over }),
  dbPath: ':memory:',
});
const conv: Conversation = {
  id: 'c1', title: 't', topic: 'Is a four-day workweek practical?', mode: 'debate', format: 'recorded', audience: 'general', temperature: 'lively', episode: 1,
  speakers: {
    A: { id: 'A', name: 'Wren', autoName: true, persona: 'optimist', autoPersona: true, lens: 'Imaginative', modelId: FREE_A, role: '', autoRole: true },
    B: { id: 'B', name: 'Hale', autoName: true, persona: 'skeptic', autoPersona: true, lens: 'Analytical', modelId: FREE_B, role: '', autoRole: true },
  },
  parentId: null, branchTurnId: null, branchSeq: null, branchDirection: null, scoutTopicId: null, publish: null, verdict: null, youStart: null, youEnd: null, roundOf: null, round: 1, length: 'normal', language: 'en', createdAt: '', updatedAt: '',
};
let close: (() => Promise<unknown>) | null = null;
afterEach(async () => { await close?.(); close = null; });

function boot(over: Record<string, string> = {}, net = fakeFetch()) {
  const lines: string[] = [];
  const stream = new Writable({ write(chunk, _e, cb) { lines.push(String(chunk)); cb(); } });
  const built = buildApp(groqCfg(over), { fetch: net.f, logger: { level: 'trace', stream }, sleep: async () => {} });
  close = () => built.app.close();
  return { ...built, net, lines };
}

describe('Groq as the free AI service', () => {
  it('needs its own key and the owner\'s word that the account is on the Free plan', () => {
    expect(loadConfig({ PROVIDER_MODE: 'groq', SPEAKER_A_MODEL: FREE_A, SPEAKER_B_MODEL: FREE_B }).problems).toEqual([
      'GROQ_API_KEY is not set.',
      'Set GROQ_PLAN=free to confirm your Groq account is on the Free plan (no card added), so no request can ever be charged.',
    ]);
    expect(groqCfg().problems).toEqual([]);
    expect(groqCfg().keyName).toBe('GROQ_API_KEY');
    expect(() => loadConfig({ PROVIDER_MODE: 'gemini' })).toThrow(/mock, openrouter or groq/);
  });

  it('runs a whole episode on Groq: its own address, no OpenRouter-only fields, the key only in the header', async () => {
    const net = fakeFetch({ replies: (call, n) => sse([delta(`Turn ${n} from ${call.body!.model}.`), '[DONE]']) });
    const { app, controller, lines } = boot({}, net);
    const created = (await app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json();
    expect((await app.inject({ method: 'POST', url: `/api/conversations/${created.id}/start` })).statusCode).toBe(200);
    await controller.settled(created.id);
    const v = (await app.inject({ url: `/api/conversations/${created.id}` })).json();
    expect(v.run.state).toBe('completed');
    expect(v.turns).toHaveLength(16);
    const chats = net.chatCalls();
    expect(chats.every(c => c.url === 'https://api.groq.com/openai/v1/chat/completions')).toBe(true);
    expect(chats[0].body).not.toHaveProperty('reasoning');
    expect(chats[0].body).not.toHaveProperty('usage');
    // FREE_A/FREE_B aren't thinking models, so they never get Groq's reasoning field.
    expect(chats[0].body).not.toHaveProperty('reasoning_effort');
    expect((chats[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    expect(lines.join('')).not.toContain(KEY);
    const cfg = (await app.inject({ url: '/api/config' })).json();
    expect(cfg).toMatchObject({ providerMode: 'groq', keyName: 'GROQ_API_KEY', problems: [] });
    expect(cfg.guard.verdicts.map((x: { ok: boolean; reason: string }) => x.reason)).toEqual(['Served by Groq on your Free plan.', 'Served by Groq on your Free plan.']);
    expect(JSON.stringify(cfg)).not.toContain(KEY);
  });

  it('blocks every run until the Free plan is confirmed', async () => {
    const { app, net } = boot({ GROQ_PLAN: '' });
    const id = (await app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id;
    const res = await app.inject({ method: 'POST', url: `/api/conversations/${id}/start` });
    expect(res.statusCode).toBe(412);
    expect(res.json().error).toMatch(/GROQ_PLAN=free/);
    expect(net.chatCalls()).toHaveLength(0);
  });

  it("blocks a model Groq doesn't serve to this key, and fails closed when the list can't be read", async () => {
    const g = new GroqModelGuard(fakeFetch().f, KEY);
    expect((await g.check([FREE_A, 'example/not-on-groq'])).map(v => v.ok)).toEqual([true, false]);
    const down = new GroqModelGuard(fakeFetch({ listFails: true }).f, KEY);
    expect((await down.check([FREE_A]))[0]).toMatchObject({ ok: false, reason: expect.stringMatching(/Couldn't read Groq's model list/) });
  });

  it('keeps a model\'s thinking out of the line, even while it streams', async () => {
    expect(stripThinking('<think>plan the joke</think>\nActually, it works.')).toBe('Actually, it works.');
    expect(stripThinking('<think>still thinking')).toBe('');
    const net = fakeFetch({ replies: () => sse([delta('<thi'), delta('nk>hmm, what'), delta(' to say</think>'), delta(' Short and '), delta('sweet.'), '[DONE]'], { split: true }) });
    const p = new OpenRouterProvider({ apiKey: KEY, maxOutputTokens: 200, timeoutMs: 5000, fetch: net.f, service: SERVICES.groq });
    const tokens: string[] = [];
    const r = await p.generateTurn({ conversation: conv, seq: 1, speaker: conv.speakers.A, objective: 'Frame', history: [] }, { signal: new AbortController().signal, onToken: t => tokens.push(t) });
    expect(r.text).toBe('Short and sweet.');
    expect(tokens.join('')).toBe('Short and sweet.');
  });

  it("names Groq in its own errors, and its daily cap isn't retried", async () => {
    const cap = 'Rate limit reached for model `x` on requests per day (RPD): Limit 1000, Used 1000';
    const net = fakeFetch({ replies: () => new Response(JSON.stringify({ error: { message: cap } }), { status: 429 }) });
    const p = new OpenRouterProvider({ apiKey: KEY, maxOutputTokens: 200, timeoutMs: 5000, fetch: net.f, service: SERVICES.groq });
    const e = await p.generateTurn({ conversation: conv, seq: 1, speaker: conv.speakers.A, objective: 'Frame', history: [] }, { signal: new AbortController().signal, onToken: () => {} }).then(() => null, x => x as ProviderError);
    expect(e).toBeInstanceOf(ProviderError);
    expect(e!.message).toMatch(/^Groq's free-model limit for today is used up/);
    expect(e!.retryable).toBe(false);
  });

  it('asks Groq\'s thinking models to think briefly, and only them', async () => {
    const net = fakeFetch({ replies: () => sse([delta('Fine.'), '[DONE]']) });
    const p = new OpenRouterProvider({ apiKey: KEY, maxOutputTokens: 200, timeoutMs: 5000, fetch: net.f, service: SERVICES.groq });
    const turn = (modelId: string) => p.generateTurn({ conversation: conv, seq: 1, speaker: { ...conv.speakers.A, modelId }, objective: 'Frame', history: [] }, { signal: new AbortController().signal, onToken: () => {} });
    await turn('openai/gpt-oss-120b');
    await turn('llama-3.3-70b-versatile');
    const [oss, llama] = net.chatCalls();
    expect(oss.body).toMatchObject({ reasoning_effort: 'low' });
    expect(llama.body).not.toHaveProperty('reasoning_effort');
    await p.complete('openai/gpt-oss-20b', 's', 'u', 100);
    expect(net.roleCalls().at(-1)!.body).toMatchObject({ reasoning_effort: 'low' });
  });
});
