import type { ConversationView } from '@crosstalk/shared';
import { describe, expect, it } from 'vitest';
import { clipName, clipText, planClip, tokensOf } from '../src/lib/clip';

const JOBS = ['Hello', 'First take', 'Story', 'Catch', 'Takeaway', 'Sign-off'];
const turn = (seq: number, text: string, stance: number | null = null) => ({ seq, speakerId: seq % 2 ? 'A' : 'B', objective: JOBS[seq - 1], text, stance }) as ConversationView['turns'][number];
const episode = (over: Partial<ConversationView> = {}) => ({
  id: 'e1', episode: 3, topic: 'Is a four-day week practical?', language: 'en',
  turns: [turn(1, 'Hello there, I am about 60% sure.', 60), turn(2, 'I disagree, 30% for me.', 30), turn(3, 'Picture a small bakery on a Friday.'), turn(4, 'That leaves out the night shift.'), turn(5, 'Fair, I moved: 50% now.', 50), turn(6, 'Me too, 40% now.', 40)],
  artist: { state: 'done', momentSeq: 4, sketchSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360"></svg>', artStyle: 'sketch', conversationId: 'e1', version: 1 },
  ...over,
}) as unknown as ConversationView;

describe('the social clip', () => {
  it('shows the opening, the line Iris drew with the lines either side, the meter, her art and the end card, in order', () => {
    const p = planClip(episode());
    expect(p.lines.map(l => l.seq)).toEqual([3, 4, 5]);
    const parts = [p.intro, ...p.lines, p.meter!, p.art!, p.outro];
    parts.forEach((x, i) => { expect(x.end).toBeGreaterThan(x.start); if (i) expect(x.start).toBe(parts[i - 1].end); });
    expect(p.duration).toBe(p.outro.end);
    expect(p.duration).toBeGreaterThan(20);
    expect(p.duration).toBeLessThanOrEqual(3.5 + 3 * 10 + 4.5 + 6 + 3);
  });

  it('leaves out the meter or the art when an episode has none, and copes with the first line being the moment', () => {
    const p = planClip(episode({ artist: null, turns: [turn(1, 'Hi.'), turn(2, 'Hello.')] }));
    expect(p.meter).toBeNull();
    expect(p.art).toBeNull();
    expect(p.lines.map(l => l.seq)).toEqual([1, 2]);
  });

  it('keeps captions short, cut at a sentence, and lights Chinese up character by character', () => {
    const long = 'One two three four five six seven eight nine ten. '.repeat(6).trim();
    expect(clipText(long).split(' ').length).toBeLessThanOrEqual(40);
    expect(clipText(long).endsWith('ten.')).toBe(true);
    expect(tokensOf('大家好，今天聊工作。')).toHaveLength(10);
    expect(tokensOf('Hello  there friend')).toEqual(['Hello', 'there', 'friend']);
    expect(clipName(episode())).toBe('crosstalk-ep03-clip');
  });
});
