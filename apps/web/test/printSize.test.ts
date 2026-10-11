import { describe, expect, it } from 'vitest';
import { printSize, printSizeLine } from '../src/lib/printSize';

describe('how big a picture prints well', () => {
  it('a 1024-pixel square from the image service: about 3.4 inches sharp, 5 inches very good', () => {
    expect(printSize(1024, 1024)).toEqual({ px: '1024 × 1024 px', sharp: '3.4 × 3.4 in (8.7 × 8.7 cm)', good: '5.1 × 5.1 in (13 × 13 cm)' });
  });

  it('a wide picture keeps its shape, and vector art has no limit', () => {
    expect(printSizeLine({ w: 1024, h: 614 })).toBe('1024 × 614 px · prints sharp up to 3.4 × 2 in (8.7 × 5.2 cm), very good up to 5.1 × 3.1 in (13 × 7.8 cm)');
    expect(printSizeLine('vector')).toBe('Vector art: prints sharp at any size.');
  });
});

describe('print files at real paper sizes', () => {
  it('300 dpi up to A4 and 11 × 14; the biggest sizes stay within what a phone can draw', async () => {
    const { PAPERS, paperPixels } = await import('../src/lib/print');
    expect(paperPixels('a4')).toEqual({ w: 2481, h: 3507, dpi: 300 });
    expect(paperPixels('8x10')).toEqual({ w: 2400, h: 3000, dpi: 300 });
    for (const k of Object.keys(PAPERS) as (keyof typeof PAPERS)[]) {
      const p = paperPixels(k);
      expect(p.w * p.h).toBeLessThanOrEqual(16_000_000);
      expect(p.dpi).toBeGreaterThanOrEqual(190);
    }
    expect(paperPixels('18x24').dpi).toBe(192);
  });
});
