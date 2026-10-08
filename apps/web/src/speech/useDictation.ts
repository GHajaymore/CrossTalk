import { useEffect, useRef, useState } from 'react';

// The browser's own speech-to-text (Web Speech API): free, no key. Chrome and Edge send the audio to
// their maker's speech service to transcribe it; Safari may do it on the device. Nothing reaches CrossTalk
// until you press "Go on air" with the words you see.
type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type RecognitionCtor = new () => Recognition;

const ctor = (): RecognitionCtor | null => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access is blocked. Allow it for this site in your browser settings, or type instead.',
  'service-not-allowed': 'Microphone access is blocked. Allow it for this site in your browser settings, or type instead.',
  'no-speech': "Didn't catch anything. Tap the mic and try again.",
  'audio-capture': 'No microphone was found.',
  network: "The browser's speech service couldn't be reached. You can still type.",
};

/** Talk instead of type: fills in your words as you speak, and stops when you pause or tap again. */
export function useDictation(onText: (text: string) => void) {
  const available = typeof window !== 'undefined' && !!ctor();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText);
  cb.current = onText;
  useEffect(() => () => rec.current?.abort(), []);

  const start = (prefix = '') => {
    const C = ctor();
    if (!C) return;
    setError(null);
    const r = new C();
    r.lang = navigator.language || 'en-US';
    r.interimResults = true;
    r.continuous = false;
    let finalText = '';
    r.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript; else interim += res[0].transcript;
      }
      cb.current(`${prefix}${prefix && !prefix.endsWith(' ') ? ' ' : ''}${finalText}${interim}`.replace(/\s+/g, ' ').trimStart());
    };
    r.onerror = e => { setError(ERRORS[e.error] ?? 'The microphone stopped. You can try again or type.'); };
    r.onend = () => { setListening(false); rec.current = null; };
    rec.current = r;
    setListening(true);
    try { r.start(); } catch { setListening(false); }
  };
  const stop = () => rec.current?.stop();
  return { available, listening, error, start, stop };
}
