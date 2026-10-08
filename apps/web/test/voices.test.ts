import { afterEach, describe, expect, it } from 'vitest';
import { englishVoices, voiceQuality, voicesFor } from '../src/speech/BrowserSpeech';

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
