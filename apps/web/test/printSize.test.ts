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
