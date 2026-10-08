import { describe, expect, it } from 'vitest';
import { ConversationController } from '../src/controller/controller';
import { openDb, Repo } from '../src/db/repo';
import { ProviderError, type Provider } from '../src/providers/types';
import { draft } from './helpers';

/** A provider that plays a script of outcomes, one per attempt. */
function scripted(outcomes: (ProviderError | string)[]) {
  let i = 0;
  const provider: Provider = {
    name: 'scripted',
    async generateTurn(_req, { onToken }) {
      const o = outcomes[Math.min(i++, outcomes.length - 1)];
      if (o instanceof ProviderError) throw o;
      onToken(o);
      return { text: o, usage: { tokensIn: 10, tokensOut: 2, costUsd: 0 } };
    },
  };
  return { provider, attempts: () => i };
}

function setup(outcomes: (ProviderError | string)[], over: { dailyLimit?: number; maxTurns?: number; preflight?: () => Promise<string | null> } = {}) {
  const repo = new Repo(openDb(':memory:'));
  const s = scripted(outcomes);
  const waits: number[] = [];
  const controller = new ConversationController(repo, s.provider, {
    maxTurns: over.maxTurns ?? 1, dailyLimit: over.dailyLimit ?? 40, models: { A: 'm/a', B: 'm/b' },
    preflight: over.preflight, sleep: async ms => { waits.push(ms); },
  });
  const c = controller.create(draft());
  return { repo, controller, c, waits, attempts: s.attempts };
}

const e503 = () => new ProviderError('OpenRouter had a server error 503.', true, null, 503);

describe('retry policy and request counting', () => {
  it('retries a 5xx once, and counts both attempts toward the daily limit', async () => {
    const { repo, controller, c, attempts } = setup([e503(), 'Recovered turn.']);
    await controller.start(c.id);
    await controller.settled(c.id);
    expect(repo.view(c.id)!.run?.state).toBe('completed');
    expect(repo.listTurns(c.id).map(t => t.text)).toEqual(['Recovered turn.']);
    expect(attempts()).toBe(2);
    expect(controller.requestsToday()).toBe(2);
    expect(repo.listUsage(c.id).map(u => [u.attempt, u.status])).toEqual([[1, 'error'], [2, 'ok']]);
    // The failed attempt has no price, but it doesn't make the day's cost unknown.
    expect(repo.usageOn(controller.today()).costUsd).toBe(0);
  });

  it('never retries more than once', async () => {
    const { repo, controller, c, attempts } = setup([e503(), e503(), 'never reached']);
    await controller.start(c.id);
    await controller.settled(c.id);
    expect(repo.view(c.id)!.run).toMatchObject({ state: 'failed', stopReason: expect.stringMatching(/503/) });
    expect(attempts()).toBe(2);
    expect(controller.requestsToday()).toBe(2);
    expect(repo.listTurns(c.id)).toHaveLength(0);
  });

  it('does not retry a request that was refused', async () => {
    const { repo, controller, c, attempts } = setup([new ProviderError('OpenRouter rejected the API key.', false, null, 401)]);
    await controller.start(c.id);
    await controller.settled(c.id);
    expect(repo.view(c.id)!.run?.state).toBe('failed');
    expect(attempts()).toBe(1);
  });

  it('waits out a short Retry-After, then retries', async () => {
    const { repo, controller, c, waits } = setup([new ProviderError('Rate limited.', true, 7000, 429), 'Fine now.']);
    await controller.start(c.id);
    await controller.settled(c.id);
    expect(waits).toEqual([7000]);
    expect(repo.view(c.id)!.run?.state).toBe('completed');
  });

  it('waits 5 seconds before retrying a 429 that gives no Retry-After', async () => {
    const { repo, controller, c, waits } = setup([new ProviderError('Rate limited.', true, null, 429), 'Fine now.']);
    await controller.start(c.id);
    await controller.settled(c.id);
    expect(waits).toEqual([5000]);
    expect(repo.view(c.id)!.run?.state).toBe('completed');
  });

  it('pauses instead of waiting more than 20 seconds', async () => {
    const { repo, controller, c, attempts, waits } = setup([new ProviderError('Rate limited.', true, 45_000, 429)]);
    await controller.start(c.id);
    await controller.settled(c.id);
    expect(repo.view(c.id)!.run).toMatchObject({ state: 'paused', stopReason: 'Rate limited, try again in 45 s' });
    expect(attempts()).toBe(1);
    expect(waits).toEqual([]);
  });

  it('does not retry when the retry would pass the daily limit', async () => {
    const { repo, controller, c, attempts } = setup([e503(), 'never reached'], { dailyLimit: 1 });
    await controller.start(c.id);
    await controller.settled(c.id);
    expect(attempts()).toBe(1);
    expect(repo.view(c.id)!.run).toMatchObject({ state: 'paused', stopReason: 'Daily request limit reached' });
  });

  it('blocks a run before any request when the preflight check fails', async () => {
    const { repo, controller, c, attempts } = setup(['x'], { preflight: async () => 'Blocked by the free-model check: m/a: Not free.' });
    await expect(controller.start(c.id)).rejects.toMatchObject({ status: 412, message: expect.stringMatching(/m\/a: Not free/) });
    expect(repo.view(c.id)!.run).toBeNull();
    expect(attempts()).toBe(0);
    expect(controller.requestsToday()).toBe(0);
  });
});
