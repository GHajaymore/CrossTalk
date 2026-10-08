import { LENGTHS, LONG_JOBS, mindChange, normalSeqFor, turnTotal } from '@crosstalk/shared';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { mockConfig } from '../src/config';
import { buildPrompt } from '../src/prompts/buildPrompt';
import { scriptFor } from '../src/providers/mockScripts';
import { draft, INSTANT } from './helpers';

const app = () => buildApp(mockConfig({ dbPath: ':memory:', dailyLimit: 500 }), { timing: INSTANT });
async function run(t: ReturnType<typeof app>, length?: string) {
  const r = await t.app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft(), ...(length ? { length } : {}) } });
  const id = r.json().id as string;
  await t.controller.start(id); await t.controller.settled(id);
  return t.repo.view(id)!;
}

describe('episode length', () => {
  it('Short is 8 turns with the same shape: stances, a story, the catch, a rethink, the takeaway', async () => {
    const t = app();
    try {
      const v = await run(t, 'short');
      expect(v).toMatchObject({ length: 'short', run: { state: 'completed' } });
      expect(v.turns.map(x => x.objective)).toEqual(['Hello', 'First take', 'Story', 'Catch', 'Rethink', 'Still unsure', 'Takeaway', 'Sign-off']);
      expect(v.turns.map(x => x.speakerId).join('')).toBe('ABABABAB');
      const m = mindChange(v.turns);
      expect([m.A.start, m.A.end, m.B.start, m.B.end].every(x => x != null)).toBe(true);
      // Mock mode plays Normal's matching lines, so each host keeps their side of the script.
      const script = scriptFor(v.topic);
      expect(v.turns[3].text).toContain(script[9].slice(0, 30));
    } finally { await t.app.close(); }
  });

  it('Long is 24 turns: all of Normal plus eight deeper beats, stances intact', async () => {
    const t = app();
    try {
      const v = await run(t, 'long');
      expect(v.turns.map(x => x.objective)).toEqual([...LONG_JOBS]);
      expect(v.turns.map(x => x.speakerId).join('')).toBe('AB'.repeat(12));
      const m = mindChange(v.turns);
      expect([m.A.start, m.A.end, m.B.start, m.B.end].every(x => x != null)).toBe(true);
      expect(v.turns[14].text).toMatch(/^Here's another scene/);
      expect(normalSeqFor(21, 'long')).toBe(13);
      expect(normalSeqFor(13, 'long')).toBeNull();
    } finally { await t.app.close(); }
  });

  it('Normal (16) when left out, and only the three lengths are accepted', async () => {
    const t = app();
    try {
      const v = await run(t);
      expect(v.length).toBe('normal');
      expect(v.turns).toHaveLength(16);
      expect((await t.app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft(), length: 'epic' } })).statusCode).toBe(400);
      expect(Object.values(LENGTHS).map(l => l.turns)).toEqual([8, 16, 24]);
    } finally { await t.app.close(); }
  });

  it('round two keeps the length; a branch of a short episode adds its 4 turns', async () => {
    const t = app();
    try {
      const v = await run(t, 'short');
      expect((await t.app.inject({ method: 'POST', url: `/api/conversations/${v.id}/round` })).json().length).toBe('short');
      const b = (await t.app.inject({ method: 'POST', url: `/api/conversations/${v.id}/branch`, payload: { fromSeq: 3, direction: 'What about night shifts?' } })).json();
      expect(turnTotal(b)).toBe(7);
    } finally { await t.app.close(); }
  });

  it('tells real hosts how long the episode is', async () => {
    const t = app();
    try {
      const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft(), length: 'short' } })).json().id;
      const c = t.repo.getConversation(id)!;
      const p = buildPrompt({ conversation: c, seq: 3, speaker: c.speakers.A, objective: 'Story', history: [] });
      expect(p.system).toContain('This is a short episode: 8 lines');
      expect(p.user).toContain('This is line 3 of 8.');
      const long = buildPrompt({ conversation: { ...c, length: 'long' }, seq: 15, speaker: c.speakers.A, objective: 'Second story', history: [] });
      expect(long.system).toContain('This is a long episode: 24 lines');
      expect(long.user).toContain('Tell a second short imagined scene');
    } finally { await t.app.close(); }
  });
});
