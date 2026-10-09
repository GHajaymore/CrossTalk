import { HOME_CODES, HOMES, homeName, nameLook, resolveSpeakers, SCOUT_COUNTRIES, TALK_STYLES } from '@crosstalk/shared';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { mockConfig } from '../src/config';
import { buildPrompt } from '../src/prompts/buildPrompt';
import { draft, INSTANT } from './helpers';

const models = { A: 'mock/a', B: 'mock/b' };
const withHomes = (A: string, B: string, extra: Record<string, unknown> = {}) => {
  const d = draft();
  return { ...d, ...extra, speakers: { A: { ...d.speakers.A, home: A }, B: { ...d.speakers.B, home: B } } } as ReturnType<typeof draft>;
};

describe('every home is complete', () => {
  it('has a country, a style, names, and faces drawn from a real range', () => {
    expect(HOME_CODES.sort()).toEqual(Object.keys(SCOUT_COUNTRIES).sort());
    for (const c of HOME_CODES) {
      const h = HOMES[c];
      expect(TALK_STYLES[h.style], c).toBeDefined();
      expect(h.women.length, c).toBeGreaterThanOrEqual(4);
      expect(h.men.length, c).toBeGreaterThanOrEqual(4);
      expect(h.surnames.length, c).toBeGreaterThanOrEqual(4);
      expect(h.skins.every(n => n >= 0 && n <= 5) && h.hair.every(n => n >= 0 && n <= 5), c).toBe(true);
      for (const n of [...h.women, ...h.men]) expect(nameLook(n), n).toBe(h.women.includes(n) ? 'w' : 'm');
    }
  });
});

describe('a host from somewhere', () => {
  it('gets a name from there; two hosts never share a first letter; hosts without a home are as before', () => {
    const d = draft();
    const plain = resolveSpeakers(d.topic, 'general', d.speakers, models);
    const s = resolveSpeakers(d.topic, 'general', withHomes('IN', 'IN').speakers, models);
    expect([...HOMES.IN.women, ...HOMES.IN.men]).toContain(s.A.name);
    expect([...HOMES.IN.women, ...HOMES.IN.men]).toContain(s.B.name);
    expect(s.A.name[0]).not.toBe(s.B.name[0]);
    expect([s.A.home, s.B.home]).toEqual(['IN', 'IN']);
    // Only the seat with a home changes.
    const one = resolveSpeakers(d.topic, 'general', withHomes('', 'MX').speakers, models);
    expect(one.A.name).toBe(plain.A.name);
    expect(one.A.home).toBe('');
    expect([...HOMES.MX.women, ...HOMES.MX.men]).toContain(one.B.name);
    expect(one.B.name[0]).not.toBe(one.A.name[0]);
    // Expert shows keep their titles, with a surname from home; a typed name is never replaced.
    expect(homeName('JP', d.topic, 'A', true)).toMatch(/^Dr\. \S+ (Sato|Nakamura|Watanabe|Kobayashi)$/);
    const typed = withHomes('KE', 'GB');
    typed.speakers.A = { ...typed.speakers.A, autoName: false, name: 'Sam' };
    expect(resolveSpeakers(d.topic, 'general', typed.speakers, models).A.name).toBe('Sam');
  });

  it('talks in their home style, as strongly as the Temperature allows, and never as a caricature', () => {
    const t = buildApp(mockConfig({ dbPath: ':memory:' }), { timing: INSTANT });
    try {
      const id = t.controller.create(withHomes('NG', 'JP')).id;
      const c = t.repo.getConversation(id)!;
      const at = (temperature: 'calm' | 'lively' | 'heated', seat: 'A' | 'B' = 'A') =>
        buildPrompt({ conversation: { ...c, temperature }, seq: 1, speaker: c.speakers[seat], objective: 'Hello', history: [] }).system;
      expect(at('calm')).toContain(`You're from Nigeria, and you talk the way good radio hosts there often do: ${TALK_STYLES.spirited.how}`);
      expect(at('calm')).toContain('Let it show lightly');
      expect(at('heated')).toContain('Lean into it');
      expect(at('lively')).toMatch(/never spell out an accent, no slang for show, and no clichés or stereotypes/);
      expect(at('lively')).toContain('Your co-host is from Japan.');
      expect(at('lively', 'B')).toContain(TALK_STYLES.considered.how);
      // No home, no style lines.
      const plain = t.repo.getConversation(t.controller.create(draft()).id)!;
      expect(buildPrompt({ conversation: plain, seq: 1, speaker: plain.speakers.A, objective: 'Hello', history: [] }).system).not.toMatch(/You're from|co-host is from/);
    } finally { void t.app.close(); }
  });

  it('is saved with the episode, only real homes are accepted, and mock hosts say where they join from', async () => {
    const t = buildApp(mockConfig({ dbPath: ':memory:', dailyLimit: 500 }), { timing: INSTANT });
    try {
      expect((await t.app.inject({ method: 'POST', url: '/api/conversations', payload: withHomes('XX', '') })).statusCode).toBe(400);
      const r = await t.app.inject({ method: 'POST', url: '/api/conversations', payload: withHomes('KE', 'AR', { length: 'short' }) });
      expect(r.statusCode).toBe(201);
      const id = r.json().id as string;
      await t.controller.start(id); await t.controller.settled(id);
      const v = t.repo.view(id)!;
      expect([v.speakers.A.home, v.speakers.B.home]).toEqual(['KE', 'AR']);
      expect(v.turns[0].text).toMatch(/^Coming to you from Kenya today\. /);
      expect(v.turns[1].text).toMatch(/^Coming to you from Argentina today\. /);
      expect(v.turns[2].text).not.toContain('Coming to you');
    } finally { await t.app.close(); }
  });
});
