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

// Apple's joke voices: never a host.
const NOVELTY = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox)\b/i;

/** How natural a voice sounds: 'natural' (neural voices), 'good', or 'basic' (older robotic ones). */
export function voiceQuality(v: SpeechSynthesisVoice): 'natural' | 'good' | 'basic' {
  if (/natural|neural|premium|enhanced|siri/i.test(v.name)) return 'natural';
  // Older or robotic voices: Windows Desktop, eSpeak, Apple's Eloquence voices and its oldest Mac ones.
  if (/desktop|espeak|robot|compact|\b(eddy|flo|reed|rocko|sandy|shelley|grandma|grandpa|fred|junior|ralph|kathy)\b/i.test(v.name)) return 'basic';
  if (/online|google|samantha|daniel|karen|moira|tessa|serena|aaron|nicky/i.test(v.name)) return 'good';
  return 'basic';
}
const QUALITY_RANK = { natural: 0, good: 1, basic: 2 } as const;

/** English voices, the most natural-sounding first, your own accent first within each tier; novelty voices left out. */
export function englishVoices(): SpeechSynthesisVoice[] {
  const all = (synth()?.getVoices() ?? []).filter(v => !NOVELTY.test(v.name));
  const en = all.filter(v => /^en/i.test(v.lang));
  const mine = (typeof navigator !== 'undefined' ? navigator.language : 'en-US').toLowerCase();
  const rank = (v: SpeechSynthesisVoice) => QUALITY_RANK[voiceQuality(v)] * 2 + (v.lang.toLowerCase().replace('_', '-') === mine ? 0 : 1);
  return (en.length ? en : all).slice().sort((a, b) => rank(a) - rank(b));
}

/** What the listener can do on this device to get more natural voices, when only basic ones are here. */
export function betterVoicesTip(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/iPhone|iPad|iPod/.test(ua)) return 'On iPhone or iPad: Settings → Accessibility → Spoken Content → Voices → English, then download a voice marked Enhanced or Premium. Free, and it sounds far more natural.';
  if (/Android/.test(ua)) return 'On Android: Settings → search "Text-to-speech" → choose Google, then install the English voice data. Free.';
  if (/Edg\//.test(ua)) return 'Edge has free Natural voices; if none are listed, check that you are online, then reopen this page.';
  if (/Mac OS X/.test(ua)) return 'On a Mac: System Settings → Accessibility → Spoken Content → System voice → Manage Voices, and download an Enhanced or Premium English voice. Free.';
  if (/Windows/.test(ua)) return 'On Windows, open CrossTalk in Microsoft Edge: it has free Natural voices that sound much more like real people.';
  return 'Microsoft Edge has free Natural voices that sound much more like real people.';
}

/** A host's preferred English accent from their home, e.g. "en-IN"; null to use the usual voices. */
export type Accents = Partial<Record<SpeakerId, string | null>>;
const langOf = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-');

/** Two different voices for the two hosts, honouring saved choices, then each host's home accent when the device has a decent one. */
export function voicesFor(prefs: VoicePrefs, accents: Accents = {}): Record<SpeakerId, SpeechSynthesisVoice | null> {
  const list = englishVoices();
  const byName = (n: string) => list.find(v => v.name === n) ?? null;
  const local = (id: SpeakerId, not?: SpeechSynthesisVoice | null) => {
    const want = accents[id]?.toLowerCase();
    return want ? list.find(v => v !== not && langOf(v) === want && voiceQuality(v) !== 'basic') ?? null : null;
  };
  const A = byName(prefs.A) ?? local('A') ?? list[0] ?? null;
  const B = byName(prefs.B) ?? local('B', A) ?? list.find(v => v !== A && v.lang === A?.lang) ?? list.find(v => v !== A) ?? A;
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
  constructor(private prefs: () => VoicePrefs, private accents: () => Accents = () => ({})) {}

  get available() { return !!synth(); }

  speak(items: SpeechItem[], h: SpeechHandlers) {
    const s = synth();
    if (!s) return;
    this.stop();
    const my = ++this.token;
    const voices = voicesFor(this.prefs(), this.accents());
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
      u.onboundary = e => h.onWord?.(q.item, q.text, e.charIndex ?? 0);
      u.onend = u.onerror = () => { if (my !== this.token) return; if (q.last) h.onItemEnd?.(q.item); next(); };
      s.speak(u);
    };
    next();
  }

  pause() { synth()?.pause(); }
  resume() { synth()?.resume(); }
  stop() { this.token++; synth()?.cancel(); }
}
