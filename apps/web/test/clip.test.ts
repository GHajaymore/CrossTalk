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

describe('the clip\'s music bed', () => {
  it('is the same for the same episode, differs between episodes, and follows the heat', async () => {
    const { musicPlan } = await import('../src/lib/clipMusic');
    expect(musicPlan('ep-1', 'lively', 40)).toEqual(musicPlan('ep-1', 'lively', 40));
    const keys = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(s => JSON.stringify(musicPlan(s, 'lively', 40).chords)));
    expect(keys.size).toBeGreaterThan(3);
    expect(musicPlan('x', 'calm', 40)).toMatchObject({ bpm: 72, arp: false, pulse: false });
    expect(musicPlan('x', 'heated', 40)).toMatchObject({ bpm: 108, arp: true, pulse: true });
    expect(musicPlan('x', 'lively', 40, [20, 30]).chimes).toEqual([20, 30]);
  });
});

describe('the Iris print', () => {
  it('has listing text that names the piece, quotes the moment and always says it is AI-made', async () => {
    const { printListing, printName } = await import('../src/lib/print');
    const v = { ...episode(), artist: { ...episode().artist!, artTitle: 'Room to Walk', caption: 'Yeah, good point.', artStyle: 'miniature' } } as unknown as ConversationView;
    const text = printListing(v);
    expect(text).toContain('“Room to Walk”, by Iris (AI artist)');
    expect(text).toContain('“Yeah, good point.”');
    expect(text).toContain('Style: Miniature.');
    expect(text).toContain('This artwork is AI-generated.');
    expect(printName(v)).toBe('crosstalk-ep03-iris-print.png');
    expect(printListing({ ...v, artist: null } as unknown as ConversationView)).toBe('');
  });
});

describe('clip fixes from review', () => {
  it('short Chinese lines and one-word lines are never spaced out letter by letter', () => {
    const p = planClip(episode({ artist: null, turns: [turn(1, '好的。'), turn(2, 'Yes.'), turn(3, 'Fair point, really.')] }));
    expect(p.lines.map(l => l.spaced)).toEqual([false, false, true]);
  });

  it('asks for music only when the browser can record sound with the video', async () => {
    const { clipFormat } = await import('../src/lib/clip');
    const g = globalThis as { MediaRecorder?: unknown };
    g.MediaRecorder = { isTypeSupported: (m: string) => m === 'video/webm' };
    try {
      expect(clipFormat(true)).toBeNull();
      expect(clipFormat(false)).toEqual({ mime: 'video/webm', ext: 'webm' });
      g.MediaRecorder = { isTypeSupported: (m: string) => m === 'video/webm;codecs=vp9,opus' || m === 'video/webm' };
      expect(clipFormat(true)).toEqual({ mime: 'video/webm;codecs=vp9,opus', ext: 'webm' });
    } finally { delete g.MediaRecorder; }
  });
});
