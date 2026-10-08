import { describe, expect, it } from 'vitest';
import type { Conversation } from '@crosstalk/shared';
import { OpenRouterProvider, wholeSentences } from '../src/providers/openrouter';
import { AbortedError, ProviderError } from '../src/providers/types';
import { delta, fakeFetch, FREE_A, FREE_B, sse, usageChunk } from './fakeOpenRouter';

const conv: Conversation = {
  id: 'c1', title: 't', topic: 'Is a four-day workweek practical?', mode: 'debate', format: 'recorded', audience: 'general', temperature: 'lively', episode: 1,
  speakers: {
    A: { id: 'A', name: 'Wren', autoName: true, persona: 'optimist', autoPersona: true, lens: 'Imaginative', modelId: FREE_A, role: '', autoRole: true },
    B: { id: 'B', name: 'Hale', autoName: true, persona: 'skeptic', autoPersona: true, lens: 'Analytical', modelId: FREE_B, role: '', autoRole: true },
  },
  parentId: null, branchTurnId: null, branchSeq: null, branchDirection: null, scoutTopicId: null, publish: null, createdAt: '', updatedAt: '',
};
const req = { conversation: conv, seq: 1, speaker: conv.speakers.A, objective: 'Frame', history: [] };
const make = (f: typeof fetch, timeoutMs = 5000) => new OpenRouterProvider({ apiKey: 'sk-or-test', maxOutputTokens: 220, timeoutMs, fetch: f });
const run = (p: OpenRouterProvider, signal = new AbortController().signal) => {
  const tokens: string[] = [];
  return p.generateTurn(req, { signal, onToken: t => tokens.push(t) }).then(r => ({ ...r, tokens }));
};
const errorOf = (p: Promise<unknown>) => p.then(() => { throw new Error('expected a failure'); }, e => e as ProviderError);

describe('OpenRouter provider', () => {
  it('sends exactly one model, never a fallback list, with the key only in the header', async () => {
    const net = fakeFetch();
    await run(make(net.f));
    const [call] = net.chatCalls();
    expect(call.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(call.body).toMatchObject({ model: FREE_A, stream: true, max_tokens: 220 });
    expect(call.body).not.toHaveProperty('models');
    expect(call.body).not.toHaveProperty('route');
    expect(call.body).toMatchObject({ reasoning: { effort: 'low', exclude: true } });
    expect((call.init.headers as Record<string, string>).Authorization).toBe('Bearer sk-or-test');
    expect(JSON.stringify(call.body)).not.toContain('sk-or-test');
  });

  it('streams tokens, ignores comment lines, and reads usage and cost', async () => {
    const net = fakeFetch({ replies: () => sse([': OPENROUTER PROCESSING', delta('Let us '), delta('frame it.'), usageChunk(300, 5, 0), '[DONE]'], { split: true }) });
    const r = await run(make(net.f));
    expect(r.tokens.join('')).toBe('Let us frame it.');
    expect(r.text).toBe('Let us frame it.');
    expect(r.usage).toEqual({ tokensIn: 300, tokensOut: 5, costUsd: 0 });
  });

  it('leaves cost unknown when OpenRouter does not report it', async () => {
    const net = fakeFetch({ replies: () => sse([delta('Hi.'), usageChunk(10, 1), '[DONE]']) });
    expect((await run(make(net.f))).usage?.costUsd).toBeNull();
  });

  it('marks 429 (with Retry-After) and 5xx as retryable, 401 and 402 as not', async () => {
    const status = (s: number, headers: Record<string, string> = {}) => fakeFetch({ replies: () => new Response(JSON.stringify({ error: { message: 'nope' } }), { status: s, headers }) }).f;
    expect(await errorOf(run(make(status(429, { 'retry-after': '7' }))))).toMatchObject({ retryable: true, retryAfterMs: 7000, status: 429 });
    expect(await errorOf(run(make(status(503))))).toMatchObject({ retryable: true, status: 503 });
    expect(await errorOf(run(make(status(401))))).toMatchObject({ retryable: false, message: expect.stringMatching(/API key/) });
    expect(await errorOf(run(make(status(402))))).toMatchObject({ retryable: false, message: expect.stringMatching(/balance/) });
  });

  it('turns an error sent mid-stream into a failure', async () => {
    const net = fakeFetch({ replies: () => sse([delta('Half a '), JSON.stringify({ error: { code: 502, message: 'upstream died' } })]) });
    expect(await errorOf(run(make(net.f)))).toMatchObject({ retryable: true, message: expect.stringMatching(/upstream died/) });
  });

  it('times out as a retryable failure', async () => {
    const hang = ((_u: string | URL | Request, init: RequestInit = {}) => new Promise((_, rej) =>
      init.signal!.addEventListener('abort', () => rej(init.signal!.reason)))) as typeof fetch;
    expect(await errorOf(run(make(hang, 30)))).toMatchObject({ retryable: true, message: expect.stringMatching(/timed out/) });
  });

  it('stops quietly when the run is stopped', async () => {
    const hang = ((_u: string | URL | Request, init: RequestInit = {}) => new Promise((_, rej) =>
      init.signal!.addEventListener('abort', () => rej(init.signal!.reason)))) as typeof fetch;
    const ctl = new AbortController();
    const p = run(make(hang), ctl.signal);
    ctl.abort();
    await expect(p).rejects.toBeInstanceOf(AbortedError);
  });

  it('treats an empty reply as a retryable failure', async () => {
    const net = fakeFetch({ replies: () => sse([usageChunk(10, 0), '[DONE]']) });
    expect(await errorOf(run(make(net.f)))).toMatchObject({ retryable: true });
  });

  it('trims a reply cut off by the length limit to whole sentences', async () => {
    const long = Array.from({ length: 6 }, (_, i) => `Sentence number ${i + 1} carries a complete thought about the topic.`).join(' ');
    const net = fakeFetch({ replies: () => sse([delta(`${long} And then it stopp`), JSON.stringify({ choices: [{ delta: {}, finish_reason: 'length' }] }), '[DONE]']) });
    const r = await run(make(net.f));
    expect(r.text).toBe(long);
  });

  it('retries when a cut-off reply leaves too little to keep', async () => {
    const net = fakeFetch({ replies: () => sse([delta('A short start. Then it got cut'), JSON.stringify({ choices: [{ delta: {}, finish_reason: 'length' }] }), '[DONE]']) });
    expect(await errorOf(run(make(net.f)))).toMatchObject({ retryable: true, message: expect.stringMatching(/cut off/) });
  });

  it('finds the last whole sentence, closing quotes included', () => {
    expect(wholeSentences('One. Two? "Three!" Four is unfin')).toBe('One. Two? "Three!"');
    expect(wholeSentences('no ending at all')).toBe('');
  });
});
