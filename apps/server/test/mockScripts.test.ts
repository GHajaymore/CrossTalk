import { describe, expect, it } from 'vitest';
import { PRESETS } from '@crosstalk/shared';
import { mockTurnText, PRESET_SCRIPTS, scriptFor } from '../src/providers/mockScripts';

const words = (s: string) => s.split(/\s+/).length;

describe('mock scripts', () => {
  it('has its own 16-turn script for every preset', () => {
    const scripts = PRESETS.map(p => scriptFor(p));
    for (const s of scripts) expect(s).toHaveLength(16);
    expect(new Set(scripts.map(s => s[0])).size).toBe(PRESETS.length);
    expect(Object.keys(PRESET_SCRIPTS)).toHaveLength(5);
  });

  it('keeps preset turns short and conversational (10–70 words)', () => {
    for (const p of PRESETS) for (const t of scriptFor(p)) {
      expect(words(t), t.slice(0, 40)).toBeGreaterThanOrEqual(10);
      expect(words(t), t.slice(0, 40)).toBeLessThanOrEqual(70);
    }
  });

  it('falls back to a generic script that names a custom topic', () => {
    expect(scriptFor('Should homework be banned?')[0]).toContain('"Should homework be banned?"');
  });

  it('colours the push-back moments by temperature, but never the opening turn', () => {
    expect(mockTurnText(PRESETS[0], 4, 'B', 'heated')).toMatch(/^Oh, come on\. /);
    expect(mockTurnText(PRESETS[0], 4, 'B', 'calm')).toMatch(/^Fair, and I'll go gently here\. /);
    expect(mockTurnText(PRESETS[0], 2, 'B', 'heated')).toBe(scriptFor(PRESETS[0])[1]);
    expect(mockTurnText(PRESETS[0], 1, 'A', 'heated')).toBe(scriptFor(PRESETS[0])[0]);
  });
});
