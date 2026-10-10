import { describe, expect, it } from 'vitest';
import { debateBeats, pointOf } from '../src/studio/DebateMap';

const turn = (seq: number, objective: string, text: string) => ({ seq, speakerId: (seq % 2 ? 'A' : 'B') as 'A' | 'B', objective, text });

describe('the debate in a minute', () => {
  it('finds the beats an organiser looks for, in order, from each turn\'s job', () => {
    const beats = debateBeats([
      turn(1, 'Hello', 'Hi.'), turn(8, 'Push back', 'But who covers Fridays?'), turn(10, 'Catch', 'Here is the catch: hourly staff lose out.'),
      turn(11, 'Rethink', 'Fair point, that changes things.'), turn(13, 'Common ground', 'We agree it needs a plan.'),
      turn(14, 'Still unsure', 'I still wonder about the customers.'), turn(15, 'Takeaway', 'Try it on one team for three months.'),
    ]);
    expect(beats.map(b => b.label)).toEqual(['Strongest challenge', 'What changed a mind', 'Where they agree', 'Still open', 'Takeaway']);
    // The catch wins over a plain push back.
    expect(beats[0]).toMatchObject({ seq: 10, speakerId: 'B' });
  });

  it('names the crux: what would change a mind', () => {
    const beats = debateBeats([
      turn(4, 'Push back', 'But who covers Fridays?'), turn(8, 'Test', 'Show me it works for shift workers and I am in.'),
      turn(11, 'Rethink', 'Fair.'), turn(15, 'Takeaway', 'Try it.'),
    ]);
    expect(beats.map(b => b.label)).toEqual(['Strongest challenge', 'The crux', 'What changed a mind', 'Takeaway']);
    expect(beats[1]).toMatchObject({ seq: 8, speakerId: 'B' });
  });

  it('stays out of the way when an episode has no such shape', () => {
    expect(debateBeats([turn(1, 'Hello', 'Hi.'), turn(2, 'First take', 'Sure.')])).toHaveLength(0);
  });

  it('keeps each point short: a sentence or two, never a wall', () => {
    expect(pointOf('One. Two. Three.')).toBe('One. Two.');
    const long = `${'word '.repeat(50).trim()}.`;
    expect(pointOf(long).split(' ').length).toBeLessThanOrEqual(31);
    expect(pointOf(long).endsWith('…')).toBe(true);
  });
});
