import { afterEach, describe, expect, it, vi } from 'vitest';
import { BACKCHANNELS, BrowserSpeech, englishVoices, planSpeech, voiceLook, voiceQuality, voicesFor, voicesIn } from '../src/speech/BrowserSpeech';

const voice = (name: string, lang = 'en-US') => ({ name, lang, default: false, localService: true, voiceURI: name }) as SpeechSynthesisVoice;
const withVoices = (list: SpeechSynthesisVoice[]) => { (globalThis as { window?: unknown }).window = { speechSynthesis: { getVoices: () => list } }; };
afterEach(() => { delete (globalThis as { window?: unknown }).window; });

describe('picking the most natural device voices', () => {
  it('rates voices by how natural they sound', () => {
    expect(voiceQuality(voice('Microsoft Aria Online (Natural) - English (United States)'))).toBe('natural');
    expect(voiceQuality(voice('Samantha (Enhanced)'))).toBe('natural');
    expect(voiceQuality(voice('Google US English'))).toBe('good');
    expect(voiceQuality(voice('Microsoft David Desktop - English (United States)'))).toBe('basic');
    expect(voiceQuality(voice('Eddy (English (US))'))).toBe('basic');
  });

  it("puts natural voices first, leaves Apple's joke voices out, and gives the hosts two different voices", () => {
    withVoices([voice('Bubbles'), voice('Microsoft David Desktop'), voice('Zarvox'), voice('Google US English'), voice('Microsoft Jenny Online (Natural)'), voice('Microsoft Guy Online (Natural)'), voice('Amélie', 'fr-CA')]);
    const names = englishVoices().map(v => v.name);
    expect(names.slice(0, 2)).toEqual(['Microsoft Jenny Online (Natural)', 'Microsoft Guy Online (Natural)']);
    expect(names).not.toContain('Bubbles');
    expect(names).not.toContain('Zarvox');
    expect(names).not.toContain('Amélie');
    const v = voicesFor({ A: '', B: '', rate: 1 });
    expect(v.A?.name).toBe('Microsoft Jenny Online (Natural)');
    expect(v.B?.name).toBe('Microsoft Guy Online (Natural)');
  });
});

describe('a voice that fits each host', () => {
  const natural = (who: string, lang = 'en-US') => voice(`Microsoft ${who} Online (Natural) - ${lang}`, lang);

  it('reads woman or man from a voice name, and leaves it open when the name says nothing', () => {
    expect(voiceLook(voice('Google UK English Female', 'en-GB'))).toBe('w');
    expect(voiceLook(voice('Google UK English Male', 'en-GB'))).toBe('m');
    expect(voiceLook(natural('Neerja', 'en-IN'))).toBe('w');
    expect(voiceLook(voice('Daniel', 'en-GB'))).toBe('m');
    expect(voiceLook(voice('Google US English'))).toBeNull();
    // Accented names count too.
    expect(voiceLook(voice('Microsoft Álvaro Online (Natural) - Spanish (Spain)', 'es-ES'))).toBe('m');
    expect(voiceLook(voice('Mónica', 'es-ES'))).toBe('w');
  });

  it("gives a woman a woman's voice and a man a man's, from their home when there is one; your pick always wins", () => {
    withVoices([natural('Guy'), natural('Jenny'), natural('Prabhat', 'en-IN'), natural('Neerja', 'en-IN'), voice('Google US English')]);
    // Miles (a man) on the left and Nora (a woman) on the right: never the other way round.
    const v = voicesFor({ A: '', B: '', rate: 1 }, { A: { look: 'm' }, B: { look: 'w' } });
    expect([voiceLook(v.A!), voiceLook(v.B!)]).toEqual(['m', 'w']);
    const swapped = voicesFor({ A: '', B: '', rate: 1 }, { A: { look: 'w' }, B: { look: 'm' } });
    expect([voiceLook(swapped.A!), voiceLook(swapped.B!)]).toEqual(['w', 'm']);
    // A woman from India gets the Indian woman's voice.
    expect(voicesFor({ A: '', B: '', rate: 1 }, { A: { look: 'w', accent: 'en-IN' } }).A?.name).toContain('Neerja');
    // Two women: two different women's voices.
    const two = voicesFor({ A: '', B: '', rate: 1 }, { A: { look: 'w' }, B: { look: 'w' } });
    expect(two.A).not.toBe(two.B);
    expect([voiceLook(two.A!), voiceLook(two.B!)]).toEqual(['w', 'w']);
    expect(voicesFor({ A: 'Microsoft Guy Online (Natural) - en-US', B: '', rate: 1 }, { A: { look: 'w' } }).A?.name).toContain('Guy');
  });

  it('a Spanish episode uses Spanish voices only, and none at all is fine', () => {
    withVoices([natural('Jenny'), natural('Dalia', 'es-MX'), natural('Jorge', 'es-MX'), natural('Elvira', 'es-ES')]);
    expect(voicesIn('es').map(v => v.lang).every(l => l.startsWith('es'))).toBe(true);
    const v = voicesFor({ A: '', B: '', rate: 1 }, { A: { look: 'm', accent: 'es-MX' }, B: { look: 'w', accent: 'es-ES' } }, 'es');
    expect(v.A?.name).toContain('Jorge');
    expect(v.B?.name).toContain('Elvira');
    expect(voicesIn('hi')).toEqual([]);
    expect(voicesFor({ A: '', B: '', rate: 1 }, {}, 'hi')).toEqual({ A: null, B: null });
  });

  it('each voice style sets the pace and pitch, on top of your speed', () => {
    const spoken: { rate: number; pitch: number; voice: SpeechSynthesisVoice | null }[] = [];
    (globalThis as { window?: unknown }).window = { speechSynthesis: { getVoices: () => [natural('Guy'), natural('Jenny')], cancel: () => {}, speak: (u: { rate: number; pitch: number; voice: SpeechSynthesisVoice | null; onend?: () => void }) => { spoken.push(u); u.onend?.(); } } };
    (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = class { rate = 1; pitch = 1; voice = null; lang = ''; constructor(public text: string) {} };
    vi.useFakeTimers();
    new BrowserSpeech(() => ({ A: '', B: '', rate: 1.1 }), () => ({ A: { style: 'energetic' }, B: { style: 'calm' } }))
      .speak([{ key: 'a', speakerId: 'A', text: 'Quick one.' }, { key: 'b', speakerId: 'B', text: 'Slowly now.' }], {});
    vi.runAllTimers(); // the beat before the other host speaks
    vi.useRealTimers();
    // Each sentence group varies its pace by up to 3%, as people do.
    const near = (got: number, want: number) => expect(Math.abs(got / want - 1)).toBeLessThanOrEqual(0.0301);
    near(spoken[0].rate, 1.1 * 1.08);
    expect(spoken[0].pitch).toBeCloseTo(1.06);
    near(spoken[1].rate, 1.1 * 0.9);
    expect(spoken[1].pitch).toBeCloseTo(0.98);
  });
});

describe("Iris's own voice", () => {
  const natural = (who: string, lang = 'en-US') => voice(`Microsoft ${who} Online (Natural) - ${lang}`, lang);
  it("is a natural woman's voice in the episode's language, different from the hosts' where it can be", async () => {
    const { irisVoice } = await import('../src/speech/BrowserSpeech');
    const jenny = natural('Jenny'), aria = natural('Aria'), guy = natural('Guy');
    withVoices([guy, jenny, aria, natural('Dalia', 'es-MX'), natural('Jorge', 'es-MX')]);
    expect(irisVoice('en', [jenny])?.name).toContain('Aria');
    expect(irisVoice('en', [jenny, aria])?.name).toContain('Guy');
    expect(irisVoice('es')?.name).toContain('Dalia');
    expect(irisVoice('hi')).toBeNull();
  });
});

describe('speaking like people, not a reader', () => {
  const long = (q = '.') => Array.from({ length: 6 }, (_, i) => `This is sentence number ${i} and it runs on a little while${i === 2 ? q : '.'}`).join(' ');
  const items = [
    { key: '1', speakerId: 'A' as const, text: long('?') },
    { key: '2', speakerId: 'B' as const, text: 'Short answer.' },
    { key: '3', speakerId: 'B' as const, text: 'And one more.' },
  ];

  it('pauses when the other host takes over, never before the very first line or a same-host follow-on', () => {
    const lines = planSpeech(items, { backchannels: null, rand: () => 0.5 }).filter(p => p.kind === 'line');
    expect(lines[0].pauseMs).toBe(0);
    const firstB = lines.find(p => p.speakerId === 'B')!;
    expect(firstB.pauseMs).toBeGreaterThanOrEqual(260);
    expect(firstB.pauseMs).toBeLessThanOrEqual(520);
    expect(lines[lines.length - 1].pauseMs).toBe(0);
    for (const p of lines) { expect(p.rate).toBeGreaterThanOrEqual(0.97); expect(p.rate).toBeLessThanOrEqual(1.03); }
  });

  it('takes a breath after a question, a shorter one between other sentences', () => {
    const a = planSpeech([items[0]], { backchannels: null, rand: () => 0.5 }).filter(p => p.kind === 'line');
    expect(a.length).toBeGreaterThan(1);
    a.slice(1).forEach((p, i) => expect(p.pauseMs).toBe(/\?$/.test(a[i].text) ? 380 : 120));
  });

  it('lets the listener murmur at most once per turn, between the speaker\'s sentences, in the other voice', () => {
    const parts = planSpeech(items, { backchannels: BACKCHANNELS.en!, rand: () => 0.1 });
    const murmurs = parts.filter(p => p.kind === 'murmur');
    expect(murmurs).toHaveLength(1);
    expect(murmurs[0].speakerId).toBe('B');
    expect(BACKCHANNELS.en).toContain(murmurs[0].text);
    const at = parts.indexOf(murmurs[0]);
    expect(parts[at - 1].speakerId).toBe('A');
    expect(parts[at + 1].speakerId).toBe('A');
    // Every word of every turn is still spoken.
    expect(parts.filter(p => p.kind === 'line').map(p => p.text).join(' ').replace(/\s+/g, ' ')).toBe(items.map(i => i.text).join(' '));
  });

  it('stays quiet with no murmurs for the language, or when chance says no', () => {
    expect(planSpeech(items, { backchannels: null, rand: () => 0.1 }).some(p => p.kind === 'murmur')).toBe(false);
    expect(planSpeech(items, { backchannels: BACKCHANNELS.en!, rand: () => 0.9 }).some(p => p.kind === 'murmur')).toBe(false);
  });
});
