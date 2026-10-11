import { describe, expect, it } from 'vitest';
import { CRUX_SINCE, hasCrux, jobLabel, unlabel } from '../src/constants';

describe('episodes keep the labels they were recorded with', () => {
  it('turn 8 reads "Crux" only for episodes recorded once it asked for the crux', () => {
    expect(jobLabel('Test', '2026-10-09T20:00:00Z')).toBe('Test');
    expect(jobLabel('Test', CRUX_SINCE)).toBe('Crux');
    expect(jobLabel('Test', '2026-10-11T08:00:00Z')).toBe('Crux');
    // A brand-new episode has no date yet: it is recorded with the crux.
    expect(hasCrux(undefined)).toBe(true);
    expect(jobLabel('Catch', '2026-10-01T00:00:00Z')).toBe('Catch');
  });

  it('a quote drops a spoken label in front, old or new', () => {
    expect(unlabel('Takeaway: keep the tech small and optional.')).toBe('Keep the tech small and optional.');
    expect(unlabel('My takeaway is simple: start small.')).toBe('My takeaway is simple: start small.');
  });
});
