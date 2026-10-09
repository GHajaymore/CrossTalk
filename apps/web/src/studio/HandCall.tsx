import { useEffect, useRef, useState } from 'react';
import { CUE_TEXT_MAX, HAND_WAIT_S, LANGUAGES, speakerFor, type ConversationView, type SpeakerId } from '@crosstalk/shared';
import { api } from '../api/client';
import { useDictation } from '../speech/useDictation';

// What a host says when they notice a raised hand, and when nobody speaks up. Written lines (no model
// request), spoken in the host's own device voice. A different one each time.
const INVITES = [
  "Looks like we've got someone with their hand up. Go ahead, you're on air.",
  "Hold that thought, we have a listener. Go ahead!",
  "Oh, a hand's up. You're on, go ahead.",
  "Let's hear from our listener for a second. Go ahead, you're live.",
];
const LATER = ["No worries, maybe later. Where were we?", "Looks like they're still thinking. Let's carry on.", "Okay, we'll come back to you. So, where were we?"];
const pick = (xs: string[]) => xs[Math.floor(Math.random() * xs.length)];

type Props = {
  view: ConversationView;
  setView: (v: ConversationView) => void;
  toast: (m: string) => void;
  say?: (text: string, who: SpeakerId, onDone?: () => void) => void;
  /** What the set shows while the host is talking to you; `speaking` while their voice is heard. */
  onCaption: (c: { who: SpeakerId; text: string; speaking: boolean } | null) => void;
};

/**
 * Your hand is up and the run has paused: the next host invites you in, then waits HAND_WAIT_S seconds.
 * Speak (or type) and Go on air: the host replies to you and the show carries on. Silence (or Never
 * mind) and the host carries on without you. The wait holds while you're talking or typing.
 */
export function HandCall({ view, setView, toast, say, onCaption }: Props) {
  const host = speakerFor(view.turns.length + 1);
  const name = view.speakers[host].name;
  const [text, setText] = useState('');
  const [left, setLeft] = useState(HAND_WAIT_S);
  const [busy, setBusy] = useState(false);
  // In another language the host invites you in that language, in the voice that reads the episode.
  const lang = LANGUAGES[view.language ?? 'en'];
  const invite = useRef(lang.invite || pick(INVITES));
  const mic = useDictation(setText);
  const done = useRef(false);

  // The host notices you, out loud.
  useEffect(() => {
    // The invitation stays on screen while they wait for you; the host is lit only while speaking.
    onCaption({ who: host, text: invite.current, speaking: !!say });
    say?.(invite.current, host, () => onCaption({ who: host, text: invite.current, speaking: false }));
    return () => onCaption(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resume = async (cue?: string) => {
    if (done.current) return;
    done.current = true; setBusy(true);
    try {
      if (cue) await api.addCue(view.id, { kind: 'guest', text: cue });
      setView(await api.start(view.id));
    } catch (e) { done.current = false; toast((e as Error).message); }
    setBusy(false);
  };

  // The wait: holds while you talk or type, then the host carries on.
  const holding = mic.listening || !!text.trim();
  useEffect(() => {
    if (holding || busy) return;
    if (left <= 0) {
      const line = lang.later || pick(LATER);
      onCaption({ who: host, text: line, speaking: !!say });
      say?.(line, host, () => onCaption(null));
      void resume();
      return;
    }
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, holding, busy]);

  return (
    <section className="hand-call" aria-label="You're invited on air">
      <p className="hand-invite"><span className={`flag ${host}`} aria-hidden="true">{host}</span><span><b>{name}:</b> “{invite.current}”</span></p>
      <textarea value={text} maxLength={CUE_TEXT_MAX} readOnly={mic.listening} onChange={e => setText(e.target.value)} aria-label="Your words on air"
        placeholder={mic.available ? 'Tap Talk, or type what you want to say' : 'Type what you want to say'} autoFocus={!mic.available} />
      <div className="dock-row">
        {mic.available && <button className={`btn sm mic-btn${mic.listening ? ' on' : ''}`} aria-pressed={mic.listening}
          onClick={() => (mic.listening ? mic.stop() : mic.start(text))}>{mic.listening ? '■ Stop' : '🎙 Talk'}</button>}
        <button className="btn sm primary" disabled={busy || mic.listening || !text.trim()} onClick={() => void resume(text.trim())}>Go on air</button>
        <button className="btn sm ghost" disabled={busy} onClick={() => void resume()}>Never mind</button>
        <span className="hint" aria-live="off">{holding ? 'Take your time.' : `${name} carries on in ${left} s`}</span>
      </div>
      {mic.error && <p className="hint" role="alert">{mic.error}</p>}
    </section>
  );
}
