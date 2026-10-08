// Browser speech synthesis (free, on-device). Voices differ between devices.
import type { SpeakerId } from '@crosstalk/shared';
import type { SpeechHandlers, SpeechItem, SpeechProvider } from './types';

export type VoicePrefs = { A: string; B: string; rate: number };
const PREFS_KEY = 'crosstalk.voices';

export function loadPrefs(): VoicePrefs {
  try { return { A: '', B: '', rate: 1, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }; } catch { return { A: '', B: '', rate: 1 }; }
}
export function savePrefs(p: VoicePrefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* private mode */ }
}

const synth = (): SpeechSynthesis | null => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null);

/** English voices, the most natural-sounding first (names with Natural, Neural, Premium…). */
export function englishVoices(): SpeechSynthesisVoice[] {
  const all = synth()?.getVoices() ?? [];
  const en = all.filter(v => /^en/i.test(v.lang));
  const rank = (v: SpeechSynthesisVoice) => (/natural|neural|premium|enhanced/i.test(v.name) ? 0 : /online|google/i.test(v.name) ? 1 : 2);
  return (en.length ? en : all).slice().sort((a, b) => rank(a) - rank(b));
}

/** Two different voices for the two hosts, honouring saved choices. */
export function voicesFor(prefs: VoicePrefs): Record<SpeakerId, SpeechSynthesisVoice | null> {
  const list = englishVoices();
  const byName = (n: string) => list.find(v => v.name === n) ?? null;
  const A = byName(prefs.A) ?? list[0] ?? null;
  const B = byName(prefs.B) ?? list.find(v => v !== A && v.lang === A?.lang) ?? list.find(v => v !== A) ?? A;
  return { A, B };
}

/**
 * Splits text into a few long chunks of whole sentences. Fewer, longer utterances mean fewer
 * gaps; staying under ~220 characters avoids browsers that cut long utterances short.
 */
export function chunks(text: string, max = 220): string[] {
  const sentences = text.replace(/\*/g, '').match(/[^.?!]+[.?!]+["'”’)]*\s*|[^.?!]+$/g)?.map(s => s.trim()).filter(Boolean) ?? [];
  const out: string[] = [];
  for (const s of sentences) {
    const last = out[out.length - 1];
    if (last && last.length + s.length + 1 <= max) out[out.length - 1] = `${last} ${s}`;
    else out.push(s);
  }
  return out;
}

export class BrowserSpeech implements SpeechProvider {
  private token = 0;
  constructor(private prefs: () => VoicePrefs) {}

  get available() { return !!synth(); }

  speak(items: SpeechItem[], h: SpeechHandlers) {
    const s = synth();
    if (!s) return;
    this.stop();
    const my = ++this.token;
    const voices = voicesFor(this.prefs());
    const queue = items.flatMap(item => chunks(item.text).map((text, i, all) => ({ item, text, last: i === all.length - 1 })));
    const next = () => {
      if (my !== this.token) return;
      const q = queue.shift();
      if (!q) { h.onDone?.(); return; }
      const u = new SpeechSynthesisUtterance(q.text);
      const v = voices[q.item.speakerId];
      if (v) u.voice = v;
      u.rate = this.prefs().rate;
      // A small pitch difference keeps two hosts apart when a device has only one good voice.
      u.pitch = voices.A === voices.B ? (q.item.speakerId === 'A' ? 0.9 : 1.12) : 1;
      u.onstart = () => h.onChunk?.(q.item, q.text);
      u.onboundary = () => h.onWord?.(q.item);
      u.onend = u.onerror = () => { if (my !== this.token) return; if (q.last) h.onItemEnd?.(q.item); next(); };
      s.speak(u);
    };
    next();
  }

  pause() { synth()?.pause(); }
  resume() { synth()?.resume(); }
  stop() { this.token++; synth()?.cancel(); }
}
