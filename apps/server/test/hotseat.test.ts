import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { mockConfig } from '../src/config';
import { buildPrompt } from '../src/prompts/buildPrompt';
import { draft, INSTANT } from './helpers';

describe('Hot seat', () => {
  it('gives the left seat the unpopular side and the right seat the job of winning them over; you decide who moved you', async () => {
    const { app, controller } = buildApp(mockConfig({ dbPath: ':memory:' }), { timing: INSTANT });
    try {
      const v = (await app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft(), mode: 'hotseat' } })).json();
      const a = buildPrompt({ conversation: v, seq: 1, speaker: v.speakers.A, objective: 'Hello', history: [] });
      const b = buildPrompt({ conversation: v, seq: 2, speaker: v.speakers.B, objective: 'First take', history: [] });
      expect(a.system).toMatch(/You're in the hot seat: defend the less popular answer/);
      expect(b.system).toMatch(/Your co-host is in the hot seat/);
      expect(a.system).toMatch(/Never misstate facts to win/);

      const early = await app.inject({ method: 'POST', url: `/api/conversations/${v.id}/verdict`, payload: { verdict: 'held' } });
      expect(early.statusCode).toBe(409);
      await controller.start(v.id); await controller.settled(v.id);
      const view = (await app.inject({ url: `/api/conversations/${v.id}` })).json();
      expect(view.turns[0].text).toMatch(/^I'm in the hot seat today/);
      expect((await app.inject({ method: 'POST', url: `/api/conversations/${v.id}/verdict`, payload: { verdict: 'maybe' } })).statusCode).toBe(400);
      const voted = await app.inject({ method: 'POST', url: `/api/conversations/${v.id}/verdict`, payload: { verdict: 'won' } });
      expect(voted.json().verdict).toBe('won');
      expect((await app.inject({ url: `/api/conversations/${v.id}/export.md` })).body).toContain('**Who moved you?** The challenger won me over');

      const debate = (await app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft(), mode: 'debate' } })).json();
      await controller.start(debate.id); await controller.settled(debate.id);
      expect((await app.inject({ method: 'POST', url: `/api/conversations/${debate.id}/verdict`, payload: { verdict: 'won' } })).statusCode).toBe(409);
    } finally { await app.close(); }
  });
});
