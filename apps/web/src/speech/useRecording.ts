import { useEffect, useMemo, useRef, useState } from 'react';
import type { EpisodeAudio, SpeakerId, Turn } from '@crosstalk/shared';
import type { Playback } from './usePlayback';
import type { PlaybackState } from './types';

/** The sentence at a fraction of the way through a turn, so captions keep pace with the audio. */
function sentenceAtFraction(text: string, f: number) {
  const parts = text.replace(/\*/g, '').split(/(?<=[.?!]["'”’)]*)\s+/);
  const total = parts.reduce((n, p) => n + p.length, 0);
  let acc = 0;
  for (const p of parts) { acc += p.length; if (acc / total >= f) return p; }
  return parts[parts.length - 1] ?? '';
}

/**
 * Plays a rendered episode recording (real voices) and follows it: which turn is on air, who is
 * speaking, a caption that keeps pace, and a voice level read from the actual sound.
 */
export function useRecording(turns: Turn[], audio: EpisodeAudio | null | undefined): Playback | null {
  const el = useMemo(() => (audio ? new Audio(audio.url) : null), [audio?.url]);
  const [state, setState] = useState<PlaybackState>('idle');
  const [seq, setSeq] = useState<number | null>(null);
  const [speakerId, setSpeakerId] = useState<SpeakerId | null>(null);
  const [caption, setCaption] = useState('');
  const [pulse, setPulse] = useState(0);
  const analyser = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!el || !audio) return;
    el.preload = 'auto';
    let raf = 0;
    const data = new Uint8Array(256);
    const tick = () => {
      const t = el.currentTime;
      const at = audio.timings.find(x => t >= x.start && t < x.end + 0.2);
      if (at) {
        setSeq(at.seq); setSpeakerId(at.speakerId);
        const turn = turns.find(x => x.seq === at.seq);
        if (turn) setCaption(sentenceAtFraction(turn.text, (t - at.start) / Math.max(0.1, at.end - at.start)));
      }
      if (analyser.current) {
        analyser.current.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        setPulse(Math.min(1, peak / 60));
      }
      raf = requestAnimationFrame(tick);
    };
    const onPlay = () => {
      // Read the real voice level once audio is allowed to start (needs a user gesture).
      if (!analyser.current) {
        try {
          const ctx = new AudioContext();
          const src = ctx.createMediaElementSource(el);
          const a = ctx.createAnalyser(); a.fftSize = 256;
          src.connect(a); a.connect(ctx.destination);
          analyser.current = a;
        } catch { /* level meter falls back to idle movement */ }
      }
      setState('speaking'); raf = requestAnimationFrame(tick);
    };
    const onPause = () => { cancelAnimationFrame(raf); if (!el.ended) setState('paused'); };
    const onEnd = () => { cancelAnimationFrame(raf); setState('idle'); setSeq(null); setSpeakerId(null); setCaption(''); };
    el.addEventListener('play', onPlay); el.addEventListener('pause', onPause); el.addEventListener('ended', onEnd);
    return () => { el.pause(); cancelAnimationFrame(raf); el.removeEventListener('play', onPlay); el.removeEventListener('pause', onPause); el.removeEventListener('ended', onEnd); };
  }, [el, audio, turns]);

  if (!el || !audio) return null;
  return {
    available: true, state, seq, speakerId, caption, pulse,
    playFrom: (from: number) => { const t = audio.timings.find(x => x.seq >= from); el.currentTime = t ? t.start : 0; void el.play(); },
    pause: () => el.pause(),
    resume: () => { void el.play(); },
    stop: () => { el.pause(); el.currentTime = 0; setState('idle'); setSeq(null); setSpeakerId(null); setCaption(''); },
  };
}
