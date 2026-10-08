import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SpeakerId, Turn } from '@crosstalk/shared';
import { BrowserSpeech, englishVoices, loadPrefs, savePrefs, type VoicePrefs } from './BrowserSpeech';
import type { PlaybackState } from './types';

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
};

/** The device's voices, refreshed when the browser finishes loading them. */
export function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => englishVoices());
  const [prefs, setPrefs] = useState<VoicePrefs>(loadPrefs);
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const on = () => setVoices(englishVoices());
    on();
    speechSynthesis.addEventListener('voiceschanged', on);
    return () => speechSynthesis.removeEventListener('voiceschanged', on);
  }, []);
  const update = useCallback((p: Partial<VoicePrefs>) => setPrefs(prev => { const next = { ...prev, ...p }; savePrefs(next); return next; }), []);
  return { voices, prefs, update };
}

/** Plays a conversation's saved turns aloud. Separate from generation: either can run without the other. */
export function usePlayback(turns: Turn[], prefs: VoicePrefs): Playback {
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const speech = useMemo(() => new BrowserSpeech(() => prefsRef.current), []);
  const [state, setState] = useState<PlaybackState>('idle');
  const [seq, setSeq] = useState<number | null>(null);
  const [speakerId, setSpeakerId] = useState<SpeakerId | null>(null);
  const [caption, setCaption] = useState('');
  const [pulse, setPulse] = useState(0);

  // Leaving the Studio stops the audio, so queues never pile up.
  useEffect(() => () => speech.stop(), [speech]);

  const reset = () => { setState('idle'); setSeq(null); setSpeakerId(null); setCaption(''); };

  const playFrom = useCallback((from: number) => {
    const items = turns.filter(t => t.seq >= from).map(t => ({ key: String(t.seq), speakerId: t.speakerId, text: t.text }));
    if (!items.length) return;
    setState('speaking');
    speech.speak(items, {
      onChunk: (item, text) => { setSeq(Number(item.key)); setSpeakerId(item.speakerId); setCaption(text); setPulse(0.5 + Math.random() * 0.3); },
      onWord: () => setPulse(0.25 + Math.random() * 0.35),
      onDone: reset,
    });
  }, [turns, speech]);

  return {
    available: speech.available,
    state, seq, speakerId, caption, pulse, playFrom,
    pause: () => { speech.pause(); setState('paused'); },
    resume: () => { speech.resume(); setState('speaking'); },
    stop: () => { speech.stop(); reset(); },
  };
}
