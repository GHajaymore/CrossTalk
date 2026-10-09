import { REACTIONS_MAX } from '@crosstalk/shared';
import { describe, expect, it } from 'vitest';
import { buildIrisPrompt } from '../src/artist/prompt';
import { buildApp } from '../src/app';
import { mockConfig } from '../src/config';
import { draft, INSTANT } from './helpers';

const app = () => buildApp(mockConfig({ dbPath: ':memory:', dailyLimit: 500 }), { timing: INSTANT });

describe('reacting while you listen', () => {
  it('saves a reaction on a line that exists, counts them per line, and refuses anything else', async () => {
    const t = app();
    try {
      const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft(), length: 'short' } })).json().id;
      const react = (seq: number, kind: string) => t.app.inject({ method: 'POST', url: `/api/conversations/${id}/reactions`, payload: { seq, kind } });
      expect((await react(1, 'clap')).statusCode).toBe(400); // nothing said yet
      await t.controller.start(id); await t.controller.settled(id);
      await react(3, 'funny'); await react(3, 'funny');
      const last = await react(3, 'clap');
      expect(last.json().reactions).toEqual({ 3: { funny: 2, clap: 1 } });
      expect(t.repo.view(id)!.reactions).toEqual({ 3: { funny: 2, clap: 1 } });
      expect((await react(3, 'angry')).statusCode).toBe(400);
      expect((await react(99, 'clap')).statusCode).toBe(400);
      for (let i = t.repo.reactionCount(id); i < REACTIONS_MAX; i++) t.repo.addReaction(id, 2, 'love');
      expect((await react(2, 'love')).statusCode).toBe(429);
      // Deleting the episode takes its reactions with it.
      await t.app.inject({ method: 'DELETE', url: `/api/conversations/${id}` });
      expect(t.repo.reactionCount(id)).toBe(0);
    } finally { await t.app.close(); }
  });

  it('Iris reads them: her prompt shows them on the line, and she draws the line you reacted to most', async () => {
    const t = app();
    try {
      const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft(), length: 'short' } })).json().id;
      await t.controller.start(id); await t.controller.settled(id);
      t.repo.addReaction(id, 2, 'wow'); t.repo.addReaction(id, 2, 'wow'); t.repo.addReaction(id, 6, 'clap');
      expect(buildIrisPrompt(t.repo.view(id)!, []).user).toMatch(/Turn 2 · .*\[listener reacted: 😮 Surprising ×2\]/);
      expect(buildIrisPrompt(t.repo.view(id)!, []).system).toContain('Then a turn the listener reacted to most');
      await t.app.inject({ method: 'POST', url: `/api/conversations/${id}/artist` });
      for (let i = 0; i < 100 && (t.repo.view(id)!.artist?.version ?? 0) < 2; i++) await new Promise(r => setTimeout(r, 5));
      const a = t.repo.view(id)!.artist!;
      expect(a.momentSeq).toBe(2);
      expect(a.perspective).toMatch(/you reacted to/);
    } finally { await t.app.close(); }
  });
});
