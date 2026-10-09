// Browser speech synthesis (free, on-device). Voices differ between devices.
import { LANGUAGES, sentencesOf, VOICE_STYLES, type Language, type SpeakerId, type VoiceStyle } from '@crosstalk/shared';
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

/** Voices for a language, the most natural-sounding first, your own accent first within each tier; novelty voices left out. */
export function voicesIn(lang: Language = 'en'): SpeechSynthesisVoice[] {
  const all = (synth()?.getVoices() ?? []).filter(v => !NOVELTY.test(v.name));
  const mine = all.filter(v => new RegExp(`^${lang}([-_]|$)`, 'i').test(v.lang));
  const here = (typeof navigator !== 'undefined' ? navigator.language : 'en-US').toLowerCase();
  const rank = (v: SpeechSynthesisVoice) => QUALITY_RANK[voiceQuality(v)] * 2 + (v.lang.toLowerCase().replace('_', '-') === here ? 0 : 1);
  // English falls back to any voice; another language with no voice here has none.
  return (mine.length || lang !== 'en' ? mine : all).slice().sort((a, b) => rank(a) - rank(b));
}
export const englishVoices = () => voicesIn('en');

/** Where to get a voice for a language this device doesn't have yet. Free on every system. */
export function missingVoiceTip(lang: Language): string {
  const name = LANGUAGES[lang].label;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/iPhone|iPad|iPod/.test(ua)) return `This device has no ${name} voice yet. Settings → Accessibility → Spoken Content → Voices → ${name}, and download one. Free.`;
  if (/Android/.test(ua)) return `This device has no ${name} voice yet. Settings → search "Text-to-speech" → Google → install ${name} voice data. Free.`;
  if (/Mac OS X/.test(ua)) return `This Mac has no ${name} voice yet. System Settings → Accessibility → Spoken Content → System voice → Manage Voices → ${name}. Free.`;
  if (/Windows/.test(ua)) return `This PC has no ${name} voice yet. Open CrossTalk in Microsoft Edge (it has free natural voices in many languages), or Settings → Time & language → Speech → Add voices.`;
  return `This browser has no ${name} voice. Microsoft Edge and Chrome have free ones for most languages.`;
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

/** What CrossTalk knows about how each host should sound: an accent from their home (e.g. "en-IN"), woman or man, and a voice style. */
export type HostVoice = { accent?: string | null; look?: 'w' | 'm' | null; style?: VoiceStyle };
export type Hosts = Partial<Record<SpeakerId, HostVoice>>;
const langOf = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-');

// Device voices don't say whether they sound like a woman or a man, but their names usually do.
const WOMAN_VOICE = /\b(female|woman|samantha|karen|moira|tessa|serena|victoria|zira|aria|jenny|sonia|libby|natasha|neerja|swara|heera|kalpana|allison|ava|susan|kate|fiona|veena|amelie|am[ée]lie|anna|paulina|monica|m[óo]nica|alice|ellen|joana|luciana|milena|sara|kyoko|o-ren|yuna|mei-jia|sin-ji|ting-ting|elsa|denise|katja|hedda|helena|laura|lucia|elvira|dalia|paloma|isabella|francisca|salome|catalina|camila|thalita|xiaoxiao|xiaoyi|nanami|sunhi|zariyah|hoda|salma|amira|clara|emma|michelle|nancy|sara|ana|martha|marie|julie|ines|in[êe]s)\b/i;
const MAN_VOICE = /\b(male|man|daniel|alex|fred|aaron|arthur|oliver|thomas|rishi|ravi|guy|ryan|christopher|eric|davis|tony|brian|jorge|diego|juan|carlos|alvaro|[áa]lvaro|raul|pablo|antonio|henri|paul|stefan|conrad|killian|luca|cosimo|keita|ichiro|otoya|injoon|yunxi|yunyang|kangkang|hamed|naayf|prabhat|madhur|hemant|ardi|william|james|liam|george|andrew|roger|steffan|gordon|reed|rocko|eddy|grandpa|ralph|junior|albert|jacques|thierry|giorgio|reinhard|jan|mark|david)\b/i;
/** 'w' or 'm' when a voice's name says so, else null. */
export function voiceLook(v: SpeechSynthesisVoice): 'w' | 'm' | null {
  // Accents are taken off first ("Álvaro" → "Alvaro"), so word edges work in every language.
  const n = v.name.normalize('NFD').replace(/\p{M}/gu, '').replace(/microsoft|google|online|natural|apple|enhanced|premium/gi, ' ');
  // "Female" and "Male" both contain "male"; check the woman's list first.
  return WOMAN_VOICE.test(n) ? 'w' : MAN_VOICE.test(n) ? 'm' : null;
}

/**
 * Two different voices for the two hosts. A voice you picked always wins. Otherwise each host gets the
 * best voice that matches whether they're a woman or a man, from their home when the device has one.
 */
export function voicesFor(prefs: VoicePrefs, hosts: Hosts = {}, lang: Language = 'en'): Record<SpeakerId, SpeechSynthesisVoice | null> {
  const list = voicesIn(lang);
  const byName = (n: string) => list.find(v => v.name === n) ?? null;
  const pick = (id: SpeakerId, not?: SpeechSynthesisVoice | null) => {
    const { accent, look } = hosts[id] ?? {};
    const want = accent?.toLowerCase();
    const free = (v: SpeechSynthesisVoice) => v !== not && voiceQuality(v) !== 'basic';
    const same = (v: SpeechSynthesisVoice) => !look || voiceLook(v) === look;
    const noClash = (v: SpeechSynthesisVoice) => !look || voiceLook(v) !== (look === 'w' ? 'm' : 'w');
    return (want ? list.find(v => free(v) && langOf(v) === want && same(v)) : undefined)
      ?? (look ? list.find(v => free(v) && same(v)) : undefined)
      ?? (want ? list.find(v => free(v) && langOf(v) === want && noClash(v)) : undefined)
      ?? list.find(v => v !== not && noClash(v))
      ?? null;
  };
  const A = byName(prefs.A) ?? pick('A') ?? list[0] ?? null;
  const B = byName(prefs.B) ?? pick('B', A) ?? list.find(v => v !== A && v.lang === A?.lang) ?? list.find(v => v !== A) ?? A;
  return { A, B };
}

/**
 * Splits text into a few long chunks of whole sentences. Fewer, longer utterances mean fewer
 * gaps; staying under ~220 characters avoids browsers that cut long utterances short.
 */
export function chunks(text: string, max = 220): string[] {
  const sentences = sentencesOf(text.replace(/\*/g, ''));
  const out: string[] = [];
  for (const s of sentences) {
    const last = out[out.length - 1];
    if (last && last.length + s.length + 1 <= max) out[out.length - 1] = `${last} ${s}`;
    else out.push(s);
  }
  return out;
}

/** Fired when a listening host murmurs ("mm-hm"), so their portrait can nod. */
export const MURMUR_EVENT = 'crosstalk:murmur';

/** What a listening host says under their breath, per language (none where we haven't written any). */
export const BACKCHANNELS: Partial<Record<Language, string[]>> = {
  en: ['Mm-hm.', 'Right.', 'Yeah.', 'Mm.', 'Sure.', 'Okay.'],
  es: ['Ajá.', 'Claro.', 'Sí.', 'Mm.'],
  hi: ['हाँ।', 'हम्म।', 'सही।', 'अच्छा।'],
  pt: ['Uhum.', 'Claro.', 'Sim.'],
  fr: ['Mm.', 'Oui.', "D'accord."],
  de: ['Mhm.', 'Ja.', 'Genau.'],
  it: ['Mm.', 'Sì.', 'Certo.'],
};

export type SpokenPart =
  | { kind: 'line'; item: SpeechItem; speakerId: SpeakerId; text: string; last: boolean; pauseMs: number; rate: number }
  | { kind: 'murmur'; speakerId: SpeakerId; text: string; pauseMs: number; rate: number };

/**
 * How a run of turns is spoken, like people rather than a reader: a short beat when the other host
 * takes over, a breath after a question, a slightly different pace for each sentence group, and now
 * and then the listening host's "mm-hm" between the speaker's sentences.
 */
export function planSpeech(items: SpeechItem[], o: { backchannels: string[] | null; rand?: () => number }): SpokenPart[] {
  const r = o.rand ?? Math.random;
  const out: SpokenPart[] = [];
  let prev: SpeakerId | null = null;
  for (const item of items) {
    const parts = chunks(item.text);
    let murmured = false;
    parts.forEach((text, i) => {
      const pauseMs = i === 0 ? (prev && prev !== item.speakerId ? 260 + Math.round(r() * 260) : 0)
        : /[?？؟]["'”’)]*$/.test(parts[i - 1]) ? 380 : 120;
      out.push({ kind: 'line', item, speakerId: item.speakerId, text, last: i === parts.length - 1, pauseMs, rate: 0.97 + r() * 0.06 });
      // At most one murmur per turn, only between the speaker's own sentences.
      if (o.backchannels?.length && !murmured && i < parts.length - 1 && r() < 0.45) {
        murmured = true;
        const other: SpeakerId = item.speakerId === 'A' ? 'B' : 'A';
        out.push({ kind: 'murmur', speakerId: other, text: o.backchannels[Math.floor(r() * o.backchannels.length)], pauseMs: 90, rate: 1.05 });
      }
    });
    prev = item.speakerId;
  }
  return out;
}

export class BrowserSpeech implements SpeechProvider {
  private token = 0;
  constructor(private prefs: () => VoicePrefs, private hosts: () => Hosts = () => ({}), private lang: () => Language = () => 'en') {}

  get available() { return !!synth(); }

  speak(items: SpeechItem[], h: SpeechHandlers) {
    const s = synth();
    if (!s) return;
    this.stop();
    const my = ++this.token;
    const lang = this.lang();
    const hosts = this.hosts();
    const voices = voicesFor(this.prefs(), hosts, lang);
    // Murmurs need two different voices, or they'd sound like the speaker talking to themselves.
    const queue = planSpeech(items, { backchannels: voices.A && voices.B && voices.A !== voices.B ? BACKCHANNELS[lang] ?? null : null });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const next = () => {
      if (my !== this.token) return;
      const q = queue.shift();
      if (!q) { h.onDone?.(); return; }
      const say = () => {
        if (my !== this.token) return;
        const u = new SpeechSynthesisUtterance(q.text);
        const v = voices[q.speakerId];
        if (v) u.voice = v;
        // With no voice picked, the language still lets the browser choose a fitting one.
        u.lang = v?.lang ?? lang;
        // Each host's voice style sets their pace and pitch, on top of your speed setting; each
        // sentence group varies a touch, as people do.
        const st = hosts[q.speakerId]?.style;
        const styled = st ? VOICE_STYLES[st] : { rate: 1, pitch: 1 };
        u.rate = Math.min(2, this.prefs().rate * styled.rate * q.rate);
        // A small pitch difference keeps two hosts apart when a device has only one good voice.
        u.pitch = styled.pitch * (voices.A === voices.B ? (q.speakerId === 'A' ? 0.9 : 1.12) : 1);
        if (q.kind === 'murmur') {
          // The listener's "mm-hm": quieter, and their head nods. Captions stay with the speaker.
          u.volume = 0.7;
          u.onstart = () => window.dispatchEvent(new CustomEvent(MURMUR_EVENT, { detail: { seat: q.speakerId } }));
          u.onend = u.onerror = () => { if (my === this.token) next(); };
        } else {
          u.onstart = () => h.onChunk?.(q.item, q.text);
          u.onboundary = e => h.onWord?.(q.item, q.text, e.charIndex ?? 0);
          u.onend = u.onerror = () => { if (my !== this.token) return; if (q.last) h.onItemEnd?.(q.item); next(); };
        }
        s.speak(u);
      };
      // Natural gaps: a beat between hosts, a breath after a question.
      if (q.pauseMs > 0) { clearTimeout(timer); timer = setTimeout(say, q.pauseMs); } else say();
    };
    next();
  }

  pause() { synth()?.pause(); }
  resume() { synth()?.resume(); }
  stop() { this.token++; synth()?.cancel(); }
}

/**
 * Iris's own voice: a natural-sounding woman's voice in the episode's language when the device has
 * one, chosen to differ from the hosts' voices where it can.
 */
export function irisVoice(lang: Language = 'en', avoid: (SpeechSynthesisVoice | null)[] = []): SpeechSynthesisVoice | null {
  const list = voicesIn(lang).filter(v => !avoid.includes(v));
  const all = voicesIn(lang);
  return list.find(v => voiceLook(v) === 'w' && voiceQuality(v) !== 'basic') ?? list.find(v => voiceQuality(v) !== 'basic') ?? list[0] ?? all[0] ?? null;
}

/** Reads text aloud in Iris's voice: a touch slower and brighter than the hosts. Returns a stop function. */
export function speakAsIris(text: string, lang: Language, onDone: () => void, avoid: (SpeechSynthesisVoice | null)[] = []): () => void {
  const s = synth();
  if (!s) { onDone(); return () => {}; }
  s.cancel();
  const v = irisVoice(lang, avoid);
  const parts = chunks(text);
  let stopped = false;
  const next = () => {
    if (stopped) return;
    const t = parts.shift();
    if (!t) { onDone(); return; }
    const u = new SpeechSynthesisUtterance(t);
    if (v) u.voice = v;
    u.lang = v?.lang ?? lang;
    u.rate = 0.94; u.pitch = 1.06;
    u.onend = () => next();
    // Cancelled (the episode started playing, or Stop): she stops, rather than reading on over it.
    u.onerror = e => { if (e.error === 'canceled' || e.error === 'interrupted') { if (!stopped) { stopped = true; onDone(); } } else next(); };
    s.speak(u);
  };
  next();
  return () => { stopped = true; s.cancel(); };
}
