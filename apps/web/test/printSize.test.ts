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

describe('ink on paper', () => {
  it('drops her dark panel and turns her screen colours into inks that hold up on cream paper', async () => {
    const { inkOnPaper } = await import('../src/lib/print');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360"><rect x="0" y="0" width="600" height="360" fill="#0F1013" stroke="none"/><g fill="none"><path d="M0 0" stroke="#ECE8E1"/><circle r="4" stroke="#E9D36A"/><line stroke="#5FB8B0"/></g></svg>';
    const ink = inkOnPaper(svg);
    expect(ink).not.toContain('#0F1013');
    expect(ink).toContain('stroke="#1E1C1A"');
    expect(ink).toContain('stroke="#A3852A"');
    expect(ink).toContain('stroke="#2E7D76"');
    expect(ink).toContain('viewBox="0 0 600 360"');
  });
});

describe('how good a camera photo looks on each paper', () => {
  it('a 1024-pixel photo: very good at 5 × 7, good at 8 × 10 and A4, soft from 11 × 14 up', async () => {
    const { photoQuality } = await import('../src/lib/print');
    expect(photoQuality(1024, '5x7')).toEqual({ dpi: 249, word: 'very good' });
    expect(photoQuality(1024, '8x10').word).toBe('good');
    expect(photoQuality(1024, 'a4').word).toBe('good');
    expect(photoQuality(1024, '11x14').word).toBe('soft');
    expect(photoQuality(2048, '5x7').word).toBe('sharp');
  });
});
