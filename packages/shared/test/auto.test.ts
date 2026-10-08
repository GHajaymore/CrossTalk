import { describe, expect, it } from 'vitest';
import { AUDIENCES, autoNames, autoPersonas, PRESETS, resolveSpeakers, type Audience } from '../src';

const audiences = Object.keys(AUDIENCES) as Audience[];

describe('auto host names', () => {
  it('gives the same topic the same pair every time', () => {
    expect(autoNames(PRESETS[2], 'general')).toEqual(autoNames(PRESETS[2], 'general'));
  });

  it('never gives both hosts the same first letter', () => {
    const topics = [...PRESETS, 'Should homework be banned?', 'Is space tourism worth it?', 'x', 'Are cats better than dogs?'];
    for (const t of topics) for (const a of audiences) {
      const [x, y] = autoNames(t, a).map(n => n.replace(/^(Dr\.|Prof\.)\s+/, ''));
      expect(x[0], `${t} / ${a}`).not.toBe(y[0]);
    }
  });

  it('uses titles for Expert and playful names for Kids', () => {
    const [a, b] = autoNames(PRESETS[0], 'expert');
    expect(a).toMatch(/^Dr\. /);
    expect(b).toMatch(/^Prof\. /);
    expect(['Pip', 'Juno', 'Ziggy', 'Bea', 'Milo', 'Poppy', 'Otto', 'Luna', 'Taffy', 'Moss']).toContain(autoNames(PRESETS[0], 'kids')[0]);
  });
});

describe('auto personalities', () => {
  it('pairs each preset as the plan says', () => {
    expect(autoPersonas(PRESETS[0], 'general')).toEqual(['optimist', 'skeptic']);
    expect(autoPersonas(PRESETS[1], 'general')).toEqual(['pragmatist', 'philosopher']);
    expect(autoPersonas(PRESETS[3], 'general')).toEqual(['storyteller', 'comedian']);
    expect(autoPersonas(PRESETS[4], 'general')).toEqual(['optimist', 'skeptic']);
  });

  it('adjusts for the audience and never pairs two of the same', () => {
    expect(autoPersonas(PRESETS[1], 'kids')).toEqual(['professor', 'storyteller']);
    expect(autoPersonas(PRESETS[1], 'teens')).toEqual(['pragmatist', 'comedian']);
    for (const t of PRESETS) for (const a of audiences) {
      const [x, y] = autoPersonas(t, a);
      expect(x).not.toBe(y);
    }
  });

  it('keeps a hand-set name and personality', () => {
    const s = resolveSpeakers(PRESETS[0], 'general', {
      A: { name: 'Marlo', autoName: false, persona: 'custom', autoPersona: false, lens: 'A retired chef who hates waste' },
      B: { name: '', autoName: true, persona: 'skeptic', autoPersona: true, lens: '' },
    }, { A: 'm/a', B: 'm/b' });
    expect(s.A).toMatchObject({ name: 'Marlo', persona: 'custom', lens: 'A retired chef who hates waste', modelId: 'm/a' });
    expect(s.B.persona).toBe('skeptic');
    expect(s.B.name).toBe(autoNames(PRESETS[0], 'general')[1]);
  });
});
