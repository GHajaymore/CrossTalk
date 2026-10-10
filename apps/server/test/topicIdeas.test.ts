import { describe, expect, it } from 'vitest';
import { autoRoles, PRESETS, SCOUT_CATS, TOPIC_IDEAS, TOPIC_MAX, youthRole } from '@crosstalk/shared';
import { isNoGo } from '../src/scout/filter';

const all = Object.values(TOPIC_IDEAS).flatMap(t => [...t.questions]);

describe('topic ideas on Create', () => {
  it('has outdoor and sports themes, and every sample episode sits in a theme', () => {
    expect(TOPIC_IDEAS.nature.questions.length).toBeGreaterThanOrEqual(6);
    expect(TOPIC_IDEAS.sports.questions.length).toBeGreaterThanOrEqual(6);
    for (const p of PRESETS) expect(all).toContain(p);
  });

  it('holds every idea to the same standard: a question, short, not repeated, never a no-go topic', () => {
    expect(new Set(all).size).toBe(all.length);
    for (const q of all) {
      expect(q.endsWith('?'), q).toBe(true);
      expect(q.length, q).toBeLessThanOrEqual(Math.min(TOPIC_MAX, 90));
      expect(isNoGo(q), q).toBe(false);
    }
  });

  it('gives outdoor topics hosts who know the outdoors', () => {
    expect(autoRoles('Should popular hiking trails need a permit?')).toEqual(['Mountain guide who leads hiking trips', 'Ecologist who studies wild places']);
    expect(autoRoles('Should esports count as sports?')[0]).toBe('Coach at a community sports club');
    expect(youthRole('Should national parks cap daily visitors?')).toMatch(/hiking club/);
  });

  it('lets the Scout file news under Nature & outdoors', () => {
    expect(SCOUT_CATS.nature).toBe('Nature & outdoors');
  });
});
