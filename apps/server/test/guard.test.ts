import { describe, expect, it } from 'vitest';
import { FreeModelGuard, judge } from '../src/guard/freeModelGuard';
import { FAKE_FREE_SUFFIX, FREE_A, MODEL_LIST, PAID, fakeFetch } from './fakeOpenRouter';

describe('free-model guard', () => {
  it('passes a model priced at exactly $0', () => {
    expect(judge(FREE_A, MODEL_LIST, null, false).ok).toBe(true);
  });

  it('blocks a paid model', () => {
    const v = judge(PAID, MODEL_LIST, null, false);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/Not free/);
  });

  it('never trusts a ":free" suffix on its own', () => {
    expect(judge(FAKE_FREE_SUFFIX, MODEL_LIST, null, false).ok).toBe(false);
  });

  it('blocks a model that is missing, or has no price', () => {
    expect(judge('example/unknown', MODEL_LIST, null, false)).toMatchObject({ ok: false, reason: expect.stringMatching(/Not on OpenRouter/) });
    expect(judge('example/no-price', MODEL_LIST, null, false).ok).toBe(false);
  });

  it('blocks everything when the model list cannot be read', async () => {
    const guard = new FreeModelGuard(fakeFetch({ listFails: true }).f, false);
    const verdicts = await guard.check([FREE_A]);
    expect(verdicts[0]).toMatchObject({ ok: false, reason: expect.stringMatching(/Couldn't read/) });
    expect(FreeModelGuard.blockMessage(verdicts)).toContain(FREE_A);
  });

  it('lets paid or unknown models through only when ALLOW_PAID_MODELS=true', () => {
    expect(judge(PAID, MODEL_LIST, null, true).ok).toBe(true);
    expect(judge(FREE_A, null, 'network error', true).ok).toBe(true);
  });

  it('caches the model list for a while', async () => {
    const net = fakeFetch();
    const guard = new FreeModelGuard(net.f, false);
    await guard.check([FREE_A]);
    await guard.check([FREE_A]);
    expect(net.calls).toHaveLength(1);
  });
});
