import { describe, expect, it } from 'vitest';
import { freshnessNote, petWords, usedStock } from '../src/prompts/freshness';

describe('keeping the talk fresh', () => {
  it('finds the stock phrases already said, most-used first, and never inside other words', () => {
    const lines = ["Honestly, that's a fair point.", 'Honestly? At the end of the day it depends.', 'Exactly. The thing is, permits cost money.', 'Dishonestly priced passes'];
    expect(usedStock(lines)).toEqual(['honestly', 'fair point', 'exactly', 'at the end of the day', 'the thing is', 'it depends']);
  });

  it("names a host's pet words, but not the topic's own words or everyday ones", () => {
    const own = ['The edges matter.', 'At the edges, permits bite.', 'Edges again: the edges decide it.', 'Permits and climbers, climbers and permits.'];
    expect(petWords(own, 'Should mountains limit climbers?')).toEqual(['edge', 'permit']);
  });

  it('says nothing when the show is still fresh', () => {
    expect(freshnessNote(['We start with the ridge.'], ['We start with the ridge.'], 'Hiking')).toBe('');
  });

  it('writes one short note the model can act on', () => {
    const note = freshnessNote(["Honestly, great point."], ['Trust trust trust.'], 'Hiking');
    expect(note).toBe('Already said on this show, so don\'t use them again: "honestly", "great point". Find your own way in. Words you\'ve leaned on: "trust". Use fresh ones.');
  });
});
