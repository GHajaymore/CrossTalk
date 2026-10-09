import { ageFor, extractStance, hostTraits, LANGUAGES, languagesFor, lookCode, parseLookCode, portraitPrompt, resolveSpeakers, sentencesOf, wholeSentencesOf, wordsIn, youthRole } from '@crosstalk/shared';
import { describe, expect, it } from 'vitest';
import { buildIrisPrompt } from '../src/artist/prompt';
import { buildApp } from '../src/app';
import { mockConfig } from '../src/config';
import { fitToLength } from '../src/controller/controller';
import { buildPrompt, rolesPrompt } from '../src/prompts/buildPrompt';
import { draft, INSTANT } from './helpers';

const app = () => buildApp(mockConfig({ dbPath: ':memory:', dailyLimit: 500 }), { timing: INSTANT });

describe('an episode in another language', () => {
  it('offers twelve languages, English first, then the languages of the hosts\' homes', () => {
    expect(Object.keys(LANGUAGES)).toHaveLength(12);
    expect(languagesFor([])).toEqual(['en']);
    expect(languagesFor(['IN', 'MX'])).toEqual(['en', 'hi', 'es']);
    expect(languagesFor(['AR', 'ES', 'GB'])).toEqual(['en', 'es']);
  });

  it('tells hosts and Iris to speak it, keeps the stance tag readable, and keeps roles in English for the faces', () => {
    const t = app();
    try {
      const id = t.controller.create({ ...draft(), language: 'hi' }).id;
      const c = t.repo.getConversation(id)!;
      expect(c.language).toBe('hi');
      const p = buildPrompt({ conversation: c, seq: 1, speaker: c.speakers.A, objective: 'Hello', history: [] });
      expect(p.system).toContain('write your lines only in Hindi (हिन्दी)');
      expect(p.user).toContain('written exactly like that in English with digits 0-9');
      const zh = buildPrompt({ conversation: { ...c, language: 'zh' }, seq: 3, speaker: c.speakers.A, objective: 'Story', history: [] });
      expect(zh.system).toMatch(/at most 70 words \(about 140 characters\)/);
      const en = t.repo.getConversation(t.controller.create(draft()).id)!;
      expect(en.language).toBe('en');
      expect(buildPrompt({ conversation: en, seq: 1, speaker: en.speakers.A, objective: 'Hello', history: [] }).system).not.toContain('Language:');
      expect(rolesPrompt('Is remote work here to stay?', 'general').system).not.toContain('Language:');
      expect(buildIrisPrompt({ ...t.repo.view(id)! }, []).system).toContain('write perspective, caption and artTitle (keep imagePrompt in English for the painter) only in Hindi');
      // The app still reads the tag, whatever language the line is in.
      expect(extractStance('मुझे लगता है सत्तर प्रतिशत हाँ। [stance: 70]')).toEqual({ text: 'मुझे लगता है सत्तर प्रतिशत हाँ।', stance: 70 });
    } finally { void t.app.close(); }
  });

  it('round two and branches keep it; mock hosts greet in it; only real languages are accepted', async () => {
    const t = app();
    try {
      expect((await t.app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft(), language: 'xx' } })).statusCode).toBe(400);
      const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft(), language: 'es', length: 'short' } })).json().id;
      await t.controller.start(id); await t.controller.settled(id);
      const v = t.repo.view(id)!;
      expect(v.turns[0].text).toMatch(/^¡Hola y bienvenidos a CrossTalk! /);
      expect(v.turns[1].text).not.toContain('¡Hola');
      expect((await t.app.inject({ method: 'POST', url: `/api/conversations/${id}/round` })).json().language).toBe('es');
      const b = (await t.app.inject({ method: 'POST', url: `/api/conversations/${id}/branch`, payload: { fromSeq: 3, direction: '¿Y los turnos de noche?' } })).json();
      expect(b.language).toBe('es');
    } finally { await t.app.close(); }
  });

  it('counts words and finds sentences in scripts without spaces or with their own full stops', () => {
    expect(sentencesOf('大家好。今天我们聊聊工作！你觉得呢？')).toEqual(['大家好。', '今天我们聊聊工作！', '你觉得呢？']);
    expect(sentencesOf('नमस्ते दोस्तों। यह अच्छा है।')).toEqual(['नमस्ते दोस्तों।', 'यह अच्छा है।']);
    expect(sentencesOf('It costs 3.5 dollars! Really? ok')).toEqual(['It costs 3.5 dollars!', 'Really?', 'ok']);
    expect(wholeSentencesOf('大家好。今天我们')).toBe('大家好。');
    expect(wordsIn('大家好今天我们聊聊工作')).toBe(6);
    expect(wordsIn('Hello there friend')).toBe(3);
    // A long Chinese line is trimmed at a sentence end, never mid-sentence.
    const long = '这是第一句话，我们讨论工作时间的问题。'.repeat(12);
    const fit = fitToLength(long, 90);
    expect(wordsIn(fit)).toBeLessThanOrEqual(90);
    expect(fit.endsWith('。')).toBe(true);
  });
});

describe('young hosts', () => {
  it('a Teens show has a Gen Z student in the right seat, shown as a young adult of about nineteen', () => {
    const d = draft('Should schools ban phones?');
    const s = resolveSpeakers(d.topic, 'teens', d.speakers, { A: 'a', B: 'b' });
    expect(s.B.role).toBe(youthRole(d.topic));
    expect(s.A.role).not.toBe(s.B.role);
    expect(ageFor(s.B.role, 0)).toBe(1);
    expect(ageFor('Gen Z content creator', 0)).toBe(1);
    expect(ageFor('Student and part-time video creator', 0)).toBe(2);
    const p = portraitPrompt(parseLookCode(lookCode(hostTraits({ name: s.B.name, role: s.B.role, seat: 'B' })))!);
    expect(p).toMatch(/a young adult of about nineteen/);
    // A role you type yourself is kept, and other audiences are unchanged.
    expect(resolveSpeakers(d.topic, 'teens', { ...d.speakers, B: { ...d.speakers.B, autoRole: false, role: 'Head teacher' } }, { A: 'a', B: 'b' }).B.role).toBe('Head teacher');
    expect(resolveSpeakers(d.topic, 'general', d.speakers, { A: 'a', B: 'b' }).B.role).not.toBe(youthRole(d.topic));
  });
});

describe('mock mode in Spanish and Hindi', () => {
  it('plays a whole sample episode in the language, stances, cues and Iris included', async () => {
    const { MOCK_LANGS } = await import('../src/providers/mockScriptsLocal');
    const { MOCK_FULL_LANGUAGES } = await import('@crosstalk/shared');
    expect(Object.keys(MOCK_LANGS).sort()).toEqual([...MOCK_FULL_LANGUAGES].sort());
    for (const lang of MOCK_FULL_LANGUAGES) {
      const L = MOCK_LANGS[lang]!;
      expect(L.script('x')).toHaveLength(16);
      expect(Object.keys(L.long).sort()).toEqual(['Counterpoint', 'Dig in', 'Hard case', 'Middle path', 'Open question', 'Second story', 'Stress test', 'What changed']);
    }
    const t = app();
    try {
      for (const [lang, hello, mark] of [['es', '¡Hola', /[áéíóúñ¿¡]/], ['hi', 'नमस्ते', /[ऀ-ॿ]/]] as const) {
        const d = draft();
        const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: { ...d, language: lang, length: 'long', speakers: { ...d.speakers, B: { ...d.speakers.B, home: lang === 'es' ? 'MX' : 'IN' } } } })).json().id;
        await t.controller.start(id); await t.controller.settled(id);
        const v = t.repo.view(id)!;
        expect(v.turns).toHaveLength(24);
        expect(v.turns[0].text.startsWith(hello)).toBe(true);
        expect(v.turns[1].text).toContain(lang === 'es' ? 'Un saludo desde Mexico.' : 'India से नमस्ते।');
        // Every line is in the language, with no English sentences left over from the sample script.
        for (const turn of v.turns) {
          expect(turn.text, `${lang} turn ${turn.seq}`).toMatch(mark);
          expect(turn.text, `${lang} turn ${turn.seq}`).not.toMatch(/\b(the|and|you|that)\b/i);
        }
        // The Mind-change meter still reads the hosts' stances.
        expect(v.turns[0].stance).not.toBeNull();
        expect(v.turns[23].stance).not.toBeNull();
        await new Promise(r => setTimeout(r, 30));
        const iris = t.repo.view(id)!.artist;
        if (iris?.state === 'done') expect(iris.perspective).toMatch(mark);
      }
    } finally { await t.app.close(); }
  });
});
