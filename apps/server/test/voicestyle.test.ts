import { resolveSpeakers, VOICE_STYLES, voiceStyleOf } from '@crosstalk/shared';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { mockConfig } from '../src/config';
import { buildPrompt } from '../src/prompts/buildPrompt';
import { draft, INSTANT } from './helpers';

describe('how a host sounds', () => {
  it('Auto follows their personality; a style you pick is kept with the episode', async () => {
    const d = draft();
    const s = resolveSpeakers(d.topic, 'general', d.speakers, { A: 'a', B: 'b' });
    expect([s.A.persona, voiceStyleOf(s.A)]).toEqual(['pragmatist', 'warm']);
    expect([s.B.persona, voiceStyleOf(s.B)]).toEqual(['philosopher', 'calm']);
    expect(voiceStyleOf({ persona: 'comedian', voice: 'auto' })).toBe('energetic');
    const t = buildApp(mockConfig({ dbPath: ':memory:' }), { timing: INSTANT });
    try {
      const r = await t.app.inject({ method: 'POST', url: '/api/conversations', payload: { ...d, speakers: { ...d.speakers, A: { ...d.speakers.A, voice: 'warm' } } } });
      expect(r.json().speakers.A.voice).toBe('warm');
      expect(r.json().speakers.B.voice).toBe('auto');
      expect((await t.app.inject({ method: 'POST', url: '/api/conversations', payload: { ...d, speakers: { ...d.speakers, A: { ...d.speakers.A, voice: 'robot' } } } })).statusCode).toBe(400);
      const c = t.repo.getConversation(r.json().id)!;
      expect(buildPrompt({ conversation: c, seq: 1, speaker: c.speakers.A, objective: 'Hello', history: [] }).system).toContain(`Your voice on air is ${VOICE_STYLES.warm.speak}`);
      expect(buildPrompt({ conversation: c, seq: 2, speaker: c.speakers.B, objective: 'First take', history: [] }).system).toContain(`Your voice on air is ${VOICE_STYLES.calm.speak}`);
      // Episodes saved before voices existed still work.
      expect(voiceStyleOf({ persona: 'storyteller' })).toBe('warm');
    } finally { await t.app.close(); }
  });
});
