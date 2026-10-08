import { describe, expect, it } from 'vitest';
import { lookFor } from '../src/studio/Portrait';

describe('living portraits', () => {
  it('a host always looks the same, and different hosts look different', () => {
    const a = lookFor({ name: 'Miles', role: 'Owner of a 20-person design studio', seat: 'A' });
    expect(lookFor({ name: 'Miles', role: 'Owner of a 20-person design studio', seat: 'A' })).toEqual(a);
    const looks = ['Ava', 'Theo', 'Nora', 'Hale', 'Della', 'Miles', 'Wren', 'Sol'].map(name => lookFor({ name, role: 'Teacher', seat: 'B' }));
    expect(new Set(looks.map(l => `${l.skin}${l.style}${l.hair}`)).size).toBeGreaterThan(4);
  });

  it('dresses hosts for their job, in their seat colour otherwise', () => {
    expect(lookFor({ name: 'Ava', role: 'Chef who runs a neighbourhood restaurant', seat: 'A' }).outfit.kind).toBe('chef');
    expect(lookFor({ name: 'Hale', role: 'Food writer who reviews restaurants', seat: 'B' }).outfit.kind).not.toBe('chef');
    expect(lookFor({ name: 'Kim', role: 'Nurse on night shifts', seat: 'B' }).outfit.kind).toBe('scrubs');
    expect(lookFor({ name: 'Jo', role: 'Researcher who studies how people work', seat: 'B' }).glasses).toBe(true);
  });
});
