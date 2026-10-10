import { useState } from 'react';
import { CUE_LIMIT, CUE_TEXT_MAX, jobLabel, stepTemperature, TEMPERATURES, turnTotal, type ConversationView, type CueInput, type LiveTurn } from '@crosstalk/shared';
import { api } from '../api/client';
import { CUE_LABEL } from './CueCard';
import { useDictation } from '../speech/useDictation';

type Props = { view: ConversationView; live: LiveTurn | null; setView: (v: ConversationView) => void; toast: (m: string) => void; limit: number; allowHeated: boolean };

/** Whether a cue can be sent now (the same rules the server checks), and where it would land. */
export function cueState(view: ConversationView, live: LiveTurn | null, limit = CUE_LIMIT) {
  const last = view.turns.reduce((m, t) => Math.max(m, t.seq), 0);
  const st = view.run?.state ?? 'idle';
  // Producer notes never use the listener's cues.
  const own = view.interventions.filter(c => !c.fromOriginal && c.kind !== 'note');
  const used = own.length;
  const waiting = own.find(c => c.status === 'queued');
  const landsBefore = last + (live ? 2 : 1);
  const blocked = st === 'completed' || st === 'cancelled' ? 'This episode has finished. Branch from any turn to take it somewhere new.'
    : !last ? 'Cues land between turns. Start the episode first.'
    : landsBefore > turnTotal(view) ? 'The episode is about to end, so there are no turns left for a cue.'
    : !limit ? 'Listener cues are switched off in the Control room.'
    : used >= limit ? `You've used all ${limit} cues for this episode.`
    : waiting ? `Your ${CUE_LABEL[waiting.kind].toLowerCase()} cue lands before turn ${waiting.appliesBeforeSeq}. Take it back from the transcript to send a different one.`
    : null;
  return { blocked, landsBefore, used, last, limit };
}

/** Challenge · Go deeper · Take the mic · Temperature. Each lands at the next turn boundary and uses one of 3 cues. */
export function CuePanel({ view, live, setView, toast, limit: cueLimit, allowHeated }: Props) {
  const [challenge, setChallenge] = useState('');
  const [guest, setGuest] = useState('');
  const mic = useDictation(t => setGuest(t.slice(0, CUE_TEXT_MAX)));
  const turns = view.turns;
  const [target, setTarget] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  const { blocked, landsBefore, used, last, limit } = cueState(view, live, cueLimit);

  const send = async (cue: CueInput, done?: () => void) => {
    setBusy(true);
    try { setView(await api.addCue(view.id, cue)); done?.(); toast(`Cue queued · lands before turn ${landsBefore}`); }
    catch (e) { toast((e as Error).message); }
    finally { setBusy(false); }
  };
  const off = !!blocked || busy;
  const down = stepTemperature(view.temperature, 'down', view.audience);
  const stepUp = stepTemperature(view.temperature, 'up', view.audience);
  const up = stepUp === 'heated' && !allowHeated ? null : stepUp;
  const deeperOn = target || last;

  return <>
    <div className={`cue-status${blocked ? ' blocked' : ''}`} role="status">
      <span className="counter">{Math.max(0, limit - used)} of {limit} cues left</span>
      <span>{blocked ?? `Your next cue lands before turn ${landsBefore}.`}</span>
    </div>
    <div className="voice-row"><h3>Challenge a claim</h3>
      <p className="hint">A short objection. The next host has to answer it.</p>
      <textarea value={challenge} maxLength={CUE_TEXT_MAX} disabled={off} onChange={e => setChallenge(e.target.value)} placeholder="e.g. Doesn't this only work for office jobs?" />
      <div className="dock-row"><button className="btn sm" disabled={off || !challenge.trim()} onClick={() => send({ kind: 'challenge', text: challenge }, () => setChallenge(''))}>Queue challenge</button></div>
    </div>
    <div className="voice-row"><h3>Go deeper</h3>
      <p className="hint">Pick a turn. The next host digs into it instead of moving on.</p>
      <div className="dock-row">
        <select value={deeperOn} disabled={off} onChange={e => setTarget(Number(e.target.value))} aria-label="Turn to go deeper on">
          {turns.map(t => <option key={t.seq} value={t.seq}>Turn {t.seq} · {view.speakers[t.speakerId].name} · {jobLabel(t.objective)}</option>)}
        </select>
        <button className="btn sm" disabled={off || !deeperOn} onClick={() => send({ kind: 'deeper', targetSeq: Number(deeperOn) })}>Queue go deeper</button>
      </div>
    </div>
    <div className="voice-row"><h3>Take the mic</h3>
      <p className="hint">Say your piece on air as a guest. You take the gold seat in the middle and the next host replies to you.</p>
      <textarea value={guest} maxLength={CUE_TEXT_MAX} disabled={off} readOnly={mic.listening} onChange={e => setGuest(e.target.value)} placeholder={mic.available ? 'Tap the mic and talk, or type: e.g. I run a bakery, and Friday is our busiest day.' : 'e.g. I run a bakery, and Friday is our busiest day.'} aria-label="Your words on air" />
      <div className="dock-row">
        {mic.available && (
          <button className={`btn sm mic-btn${mic.listening ? ' on' : ''}`} disabled={off && !mic.listening} aria-pressed={mic.listening}
            onClick={() => (mic.listening ? mic.stop() : mic.start(guest))}>{mic.listening ? '■ Stop' : '🎙 Talk'}</button>
        )}
        <button className="btn sm" disabled={off || mic.listening || !guest.trim()} onClick={() => send({ kind: 'guest', text: guest }, () => setGuest(''))}>Go on air</button>
        {mic.listening && <span className="hint" role="status">Listening… check your words, then Go on air.</span>}
      </div>
      {mic.error && <p className="hint" role="alert">{mic.error}</p>}
      {mic.available && <p className="hint">Talking uses your browser's free speech-to-text; Chrome and Edge send the audio to their speech service. Nothing goes on air until you press Go on air.</p>}
    </div>
    <div className="voice-row"><h3>Temperature <span className="counter">now {TEMPERATURES[view.temperature].label}</span></h3>
      <p className="hint">Cool it down or turn it up from the next turn.</p>
      <div className="dock-row">
        <button className="btn sm" disabled={off || !down} onClick={() => send({ kind: 'temp', direction: 'down' })}>Cool it down{down ? ` → ${TEMPERATURES[down].label}` : ''}</button>
        <button className="btn sm" disabled={off || !up} onClick={() => send({ kind: 'temp', direction: 'up' })}>Turn it up{up ? ` → ${TEMPERATURES[up].label}` : view.audience === 'kids' && view.temperature === 'lively' ? ' · Kids stop at Lively' : ''}</button>
      </div>
    </div>
  </>;
}
