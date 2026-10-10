import { describe, expect, it } from 'vitest';
import { PHOTO_THEMES, photoThemesFor } from '../src/photoThemes';

describe('photo of the day', () => {
  it('offers eight ideas a day, one of each kind, and new ones tomorrow', () => {
    const today = photoThemesFor(new Date(2026, 9, 10, 9));
    expect(today).toHaveLength(8);
    expect(new Set(today.map(t => t.kind)).size).toBe(8);
    // The same all day, a different set the next day.
    expect(photoThemesFor(new Date(2026, 9, 10, 23))).toEqual(today);
    expect(photoThemesFor(new Date(2026, 9, 11, 9))).not.toEqual(today);
  });

  it('every brief is a real photograph with no close-up hands or faces, and no one real or young', () => {
    expect(PHOTO_THEMES.length).toBeGreaterThanOrEqual(40);
    for (const t of PHOTO_THEMES) {
      expect(t.prompt).toMatch(/^A real photograph /);
      expect(t.prompt).toMatch(/\d+mm/);
      expect(t.prompt).not.toMatch(/\b(hand|hands|finger|face|portrait|child|children|kid|teen|celebrity)\b/i);
    }
  });
});
