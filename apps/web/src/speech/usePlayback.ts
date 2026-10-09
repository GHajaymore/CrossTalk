import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sentencesOf, type Language, type SpeakerId, type Turn } from '@crosstalk/shared';
import { BrowserSpeech, loadPrefs, voicesIn, savePrefs, type Hosts, type VoicePrefs } from './BrowserSpeech';
import type { PlaybackState } from './types';

/** The sentence being spoken, so captions stay short and follow the voice. */
function sentenceAt(text: string, charIndex: number) {
  const parts = sentencesOf(text);
  let pos = 0;
  for (const p of parts) {
    const end = text.indexOf(p, pos) + p.length;
    if (charIndex < end + 1) return p;
    pos = end;
  }
  return parts[parts.length - 1] ?? text;
}

export type Playback = {
  available: boolean;
  state: PlaybackState;
  /** The turn being spoken. */
  seq: number | null;
  speakerId: SpeakerId | null;
  caption: string;
  /** Changes on every spoken word; drives the voice meter. */
  pulse: number;
  playFrom: (seq: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  /** Goes up by one each time the episode plays through to its end (not when it's stopped). */
  finished: number;
  /** Device voices only: one line in a host's voice, outside the episode (a host inviting a listener in). */
  say?: (text: string, speakerId: SpeakerId, onDone?: () => void) => void;
  /** Only a rendered recording has a real timeline you can scrub and speed up. */
  clock?: { position: number; duration: number; rate: number; seek: (sec: number) => void; setRate: (r: number) => void };
};

/** The device's voices, refreshed when the browser finishes loading them. */
export function useVoices(lang: Language = 'en') {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => voicesIn(lang));
  const [prefs, setPrefs] = useState<VoicePrefs>(loadPrefs);
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const on = () => setVoices(voicesIn(lang));
    on();
    speechSynthesis.addEventListener('voiceschanged', on);
    return () => speechSynthesis.removeEventListener('voiceschanged', on);
  }, [lang]);
  const update = useCallback((p: Partial<VoicePrefs>) => setPrefs(prev => { const next = { ...prev, ...p }; savePrefs(next); return next; }), []);
  return { voices, prefs, update };
}

/** Plays a conversation's saved turns aloud. Separate from generation: either can run without the other. */
export function usePlayback(turns: Turn[], prefs: VoicePrefs, hosts: Hosts = {}, lang: Language = 'en'): Playback {
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const hostsRef = useRef(hosts);
  hostsRef.current = hosts;
  const langRef = useRef(lang);
  langRef.current = lang;
  const speech = useMemo(() => new BrowserSpeech(() => prefsRef.current, () => hostsRef.current, () => langRef.current), []);
  const [state, setState] = useState<PlaybackState>('idle');
  const [seq, setSeq] = useState<number | null>(null);
  const [speakerId, setSpeakerId] = useState<SpeakerId | null>(null);
  const [caption, setCaption] = useState('');
  const [pulse, setPulse] = useState(0);
  const [finished, setFinished] = useState(0);

  // Leaving the Studio stops the audio, so queues never pile up.
  useEffect(() => () => speech.stop(), [speech]);

  const reset = () => { setState('idle'); setSeq(null); setSpeakerId(null); setCaption(''); };

  const playFrom = useCallback((from: number) => {
    const items = turns.filter(t => t.seq >= from).map(t => ({ key: String(t.seq), speakerId: t.speakerId, text: t.text, funny: t.funny }));
    if (!items.length) return;
    setState('speaking');
    // Only a play-through that actually spoke counts as finished: a device whose voices all fail
    // reaches the end at once, and Up next must not race through the shelf.
    let spoke = false;
    speech.speak(items, {
      onChunk: (item, text) => { spoke = true; setSeq(Number(item.key)); setSpeakerId(item.speakerId); setCaption(sentenceAt(text, 0)); setPulse(0.5 + Math.random() * 0.3); },
      onWord: (_item, text, at) => { setPulse(0.25 + Math.random() * 0.35); setCaption(sentenceAt(text, at)); },
      onDone: () => { reset(); if (spoke) setFinished(n => n + 1); },
    });
  }, [turns, speech]);

  return {
    available: speech.available,
    state, seq, speakerId, caption, pulse, playFrom, finished,
    say: (text, who, onDone) => {
      if (!speech.available) { onDone?.(); return; }
      speech.speak([{ key: 'say', speakerId: who, text }], { onChunk: () => setPulse(0.6), onWord: () => setPulse(0.3 + Math.random() * 0.4), onDone: () => onDone?.() });
    },
    pause: () => { speech.pause(); setState('paused'); },
    resume: () => { speech.resume(); setState('speaking'); },
    stop: () => { speech.stop(); reset(); },
  };
}
