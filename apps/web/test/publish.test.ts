import { describe, expect, it } from 'vitest';
import type { ConversationView } from '@crosstalk/shared';
import { AI_NOTE, hashtags, postText } from '../src/lib/publish';

const turn = (seq: number, speakerId: 'A' | 'B', objective: string, text: string, stance: number | null = null) => ({ seq, speakerId, objective, text, stance });
const view = (createdAt: string) => ({
  id: 'c1', episode: 3, topic: 'Should the busiest mountains limit climbers each season?', createdAt,
  speakers: { A: { name: 'Nora', role: 'Mountain guide who leads hiking trips' }, B: { name: 'Sage', role: 'Ecologist who studies wild places' } },
  turns: [
    turn(1, 'A', 'Hello', "I'm maybe 65% on yes.", 65), turn(2, 'B', 'First take', 'More like 25% for me.', 25),
    turn(8, 'B', 'Test', "Show me permits that don't just favour the rich, and I'm in. That's my test."),
    turn(15, 'A', 'Takeaway', 'Start with one peak.', 52), turn(16, 'B', 'Sign-off', 'Thanks for listening.', 34),
  ],
  artist: { state: 'done', artTitle: 'The Quiet Summit', caption: 'Start with one peak.' },
}) as unknown as ConversationView;

describe('Publish kit', () => {
  it('writes a Shorts title within 100 characters, then the crux, where they landed, the AI note and hashtags', () => {
    const t = postText(view('2026-10-11T09:00:00Z'), 'shorts');
    const [title] = t.split('\n');
    expect(title.length).toBeLessThanOrEqual(100);
    expect(title).toContain('Should the busiest mountains');
    expect(t).toContain('The crux, from Sage: “Show me permits');
    expect(t).toContain('Nora moved from 65% to 52% on yes.');
    expect(t).toContain('“The Quiet Summit”');
    expect(t).toContain(AI_NOTE);
    expect(t).toMatch(/#CrossTalk #BothSides .*#AIpodcast$/);
  });

  it('never claims a crux for an episode recorded before the crux turn', () => {
    expect(postText(view('2026-10-09T09:00:00Z'), 'social')).not.toContain('The crux');
  });

  it('every platform says it is AI-made', () => {
    for (const p of ['shorts', 'social', 'podcast'] as const) expect(postText(view('2026-10-11T09:00:00Z'), p)).toContain(AI_NOTE);
  });

  it('a host who held their view "stayed", and weak words never become hashtags', () => {
    const v = view('2026-10-11T09:00:00Z');
    (v.turns as { stance: number | null }[])[3].stance = 65;
    expect(postText(v, 'podcast')).toContain('Nora stayed at 65% on yes.');
    expect(hashtags('Should the busiest mountains limit climbers each season?')).not.toContain('#Busiest');
  });

  it('hashtags come from the topic\'s key words, once each', () => {
    expect(hashtags('Should cities ban cars from their city centres?')).toEqual(['#CrossTalk', '#BothSides', '#Centres', '#Cities', '#Cars', '#AIpodcast']);
  });
});
