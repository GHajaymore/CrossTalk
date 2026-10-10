import { describe, expect, it } from 'vitest';
import { hashText, moodFor, paletteFor, rng } from '../src/lib/irisEngine';

const lum = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe("Iris's own painting engine", () => {
  it('paints in the colours her brief names, with a deep dark and a light to carry them', () => {
    const p = paletteFor('A bakery at dawn, peach and teal light, gouache with soft grain', 1);
    expect(lum(p.dark)).toBeLessThan(60);
    expect(lum(p.light)).toBeGreaterThan(150);
    expect(p.mids.length).toBeGreaterThan(0);
    // Peach and teal both make it in (peach, the lighter, as her light).
    expect([...p.mids, p.light].some(c => c[0] > 200 && c[1] > 150 && c[2] < 170)).toBe(true);
    expect([...p.mids, p.accent].some(c => c[2] > c[0] && c[1] > c[0])).toBe(true);
  });

  it('uses one of her own palettes when the brief names no colours, the same one every time', () => {
    const a = paletteFor('A quiet street after the meeting', hashText('ep1'));
    const b = paletteFor('A quiet street after the meeting', hashText('ep1'));
    expect(a).toEqual(b);
    expect(lum(a.dark)).toBeLessThan(lum(a.light));
  });

  it('reads the light from a few words', () => {
    expect(moodFor('moonlit harbour, stars over the water')).toMatchObject({ night: true, water: true });
    expect(moodFor('golden dusk in a misty square')).toMatchObject({ warm: true, mist: 0.55 });
    expect(moodFor('a stormy sky over the market').storm).toBe(true);
  });

  it('is repeatable: the same seed gives the same strokes', () => {
    const a = rng(42), b = rng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(hashText('x')).not.toBe(hashText('y'));
  });
});
