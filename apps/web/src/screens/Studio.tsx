import { useEffect, useState } from 'react';
import {
  AUDIENCES, CUE_LIMIT, episodeLabel, hostSubtitle, jobFor, MAX_TURNS, MODES, speakerFor, TEMPERATURES,
  type AppConfig, type ConversationView,
} from '@crosstalk/shared';
import { api } from '../api/client';
import { useConversation } from '../api/useConversation';
import { CueCard } from '../studio/CueCard';
import { SidePanel } from '../studio/SidePanel';
import { StudioSet } from '../studio/StudioSet';
import { TurnCard } from '../studio/TurnCard';
import { TurnRail } from '../studio/TurnRail';
import { BudgetBanner, realBlocked, SetupBanner } from '../lib/Banners';
import { BrowserSpeech } from '../speech/BrowserSpeech';
import { usePlayback, useVoices } from '../speech/usePlayback';
import { useRecording } from '../speech/useRecording';
import { VoicePicker } from '../speech/VoicePicker';
import { lastSentence, spokenSeconds, tail } from '../lib/text';
import { Footer } from './Footer';

type Props = { id: string; config: AppConfig | null; refreshConfig: () => void; toast: (m: string) => void };

export function Studio({ id, config, refreshConfig, toast }: Props) {
  const { view, live, pulse, error, setView } = useConversation(id, refreshConfig);
  const [panelOpen, setPanelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const { voices, prefs, update } = useVoices();
  const browserPlay = usePlayback(view?.turns ?? [], prefs);
  const recording = useRecording(view?.turns ?? [], view?.audio);
  // A rendered recording (natural voices) wins over the device's built-in voices.
  const play = recording ?? browserPlay;
  // Live format: each finished turn is read aloud as soon as it lands.
  const lastSaved = view?.turns[view.turns.length - 1]?.seq ?? 0;
  useEffect(() => {
    if (view?.format === 'live' && view.run?.state === 'generating' && lastSaved && play.state === 'idle') play.playFrom(lastSaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSaved]);

  if (error && !view) return <div className="empty-stage"><p>{error}</p><a className="btn" href="#/create">Start a new one</a></div>;
  if (!view) return <div className="empty-stage"><p>Opening the studio…</p></div>;

  const sp = view.speakers;
  const st = view.run?.state ?? 'idle';
  const lastSeq = view.turns.reduce((m, t) => Math.max(m, t.seq), 0);
  const failedSeq = st === 'failed' ? lastSeq + 1 : null;
  const otherBusy = !!config?.activeConversationId && config.activeConversationId !== id;
  const cantRun = busy || otherBusy || realBlocked(config) || (!!config && config.requestsToday >= config.dailyLimit);
  const reason = view.run?.stopReason;

  const act = (fn: (id: string) => Promise<ConversationView>) => async () => {
    setBusy(true);
    setStartError(null);
    try { setView(await fn(id)); } catch (e) {
      const msg = (e as Error).message;
      // Long reasons (blocked models, limits) stay on screen; short ones are a toast.
      if (fn === api.start) setStartError(msg); else toast(msg);
    } finally { setBusy(false); refreshConfig(); }
  };

  const statusWord = {
    idle: 'Ready',
    generating: live ? `${sp[live.speakerId].name} is on air · turn ${live.seq} of ${MAX_TURNS}` : 'Starting',
    paused: reason === 'interrupted' ? `Interrupted after turn ${lastSeq} · the server restarted` : reason && reason !== 'by you' ? `Paused after turn ${lastSeq} · ${reason}` : `Paused after turn ${lastSeq}`,
    completed: 'Complete',
    cancelled: `Stopped after turn ${lastSeq}`,
    failed: `Turn ${lastSeq + 1} failed`,
  }[st];

  const lastTurn = view.turns[view.turns.length - 1];
  const listening = play.state !== 'idle' && play.speakerId;
  const caption = live && !listening
    ? { who: live.speakerId, text: tail(live.text) || '…' }
    : listening ? { who: play.speakerId, text: play.caption }
    : st === 'failed' ? { who: null, text: 'The connection dropped on this turn. Everything before it is saved.' }
    : lastTurn && st !== 'idle' && st !== 'generating' ? { who: lastTurn.speakerId, text: lastSentence(lastTurn.text) }
    : null;

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { toast('Copy is blocked in this browser'); }
  };

  return (
    <div className="studio">
      <section className="stage" aria-label="Discussion">
        <StudioSet
          show={`CrossTalk · ${view.format === 'live' ? '● Live' : episodeLabel(view.episode)}`}
          topic={view.topic}
          tags={`${MODES[view.mode].label} · ${AUDIENCES[view.audience].label} · ${TEMPERATURES[view.temperature].label}`}
          temperature={view.temperature}
          hosts={{ A: { name: sp.A.name, role: hostSubtitle(sp.A) }, B: { name: sp.B.name, role: hostSubtitle(sp.B) } }}
          guest={null}
          speaking={listening ? play.speakerId : live?.speakerId ?? null}
          voiceLevel={listening ? play.pulse : pulse}
          caption={caption}
          runState={st}
          clock={{ seconds: spokenSeconds(view.turns.map(t => t.text)), running: st === 'generating' }}
          iris={st === 'generating' ? { text: 'Iris · listening', active: true } : { text: 'Iris · in the booth', active: false }}
        />

        <TurnRail turns={view.turns} liveSeq={live?.seq ?? null} failedSeq={failedSeq} speakers={sp} />
        <div className="status-line" aria-live="polite">
          <span><b>{statusWord}</b>{view.run?.pauseRequested ? ' · pausing after this turn' : ''}</span>
          <span>{view.interventions.length} of {CUE_LIMIT} cues used</span>
        </div>

        <SetupBanner config={config} />
        <BudgetBanner config={config} />
        {startError && <div className="banner" role="alert"><span><b>Couldn't start.</b> {startError}</span><button className="btn sm ghost" onClick={() => setStartError(null)}>Dismiss</button></div>}
        <div className="table">
          {!view.turns.length && !live && st === 'idle' && (
            <div className="empty-stage"><p>Both seats are ready. Press Start to hear {sp.A.name} open.</p></div>
          )}
          {view.turns.map(t => (
            <TurnCard key={t.seq} seq={t.seq} speakerId={t.speakerId} name={sp[t.speakerId].name} objective={t.objective}
              modelId={t.modelId} text={t.text} state="completed" onCopy={() => copy(t.text)}
              speaking={play.state !== 'idle' && play.seq === t.seq} onPlayFrom={play.available ? () => play.playFrom(t.seq) : undefined} />
          ))}
          {live && !view.turns.some(t => t.seq === live.seq) && (
            <TurnCard seq={live.seq} speakerId={live.speakerId} name={sp[live.speakerId].name} objective={live.objective}
              modelId={live.modelId} text={live.text} state="streaming" />
          )}
          {failedSeq && (
            <TurnCard seq={failedSeq} speakerId={speakerFor(failedSeq)} name={sp[speakerFor(failedSeq)].name} objective={jobFor(failedSeq)}
              modelId={sp[speakerFor(failedSeq)].modelId} text={reason ?? 'This turn failed.'} state="failed" />
          )}
          {view.interventions.map(c => <CueCard key={c.id} cue={c} />)}
        </div>

        <div className="dock">
          <div className="dock-group">
            <span className="tag">Generation</span>
            <div className="dock-row">
              {st === 'idle' && <button className="btn primary" disabled={cantRun} onClick={act(api.start)}>Start</button>}
              {st === 'paused' && <button className="btn primary" disabled={cantRun} onClick={act(api.start)}>Resume</button>}
              {st === 'failed' && <button className="btn primary" disabled={cantRun} onClick={act(api.start)}>Retry turn {lastSeq + 1}</button>}
              {st === 'generating' && <button className="btn" disabled={busy || !!view.run?.pauseRequested} onClick={act(api.pause)}>Pause after this turn</button>}
              {(st === 'generating' || st === 'paused' || st === 'failed') && <button className="btn danger" disabled={busy} onClick={act(api.stop)}>Stop</button>}
              <button className="btn ghost" disabled title="Export arrives in Milestone 6">Export</button>
              <button className="btn ghost panel-toggle" onClick={() => setPanelOpen(o => !o)}>Cues &amp; voices</button>
            </div>
            {otherBusy && st !== 'generating' && <span className="state">Another discussion is generating. Pause or stop it first.</span>}
          </div>
          <div className="dock-group listen">
            <span className="tag">Listen</span>
            <div className="dock-row">
              {!play.available && <span className="state">Speech isn't available in this browser. Every turn stays readable.</span>}
              {play.available && play.state === 'idle' && <button className="btn" disabled={!view.turns.length} onClick={() => play.playFrom(1)}>▶ Play from start</button>}
              {play.state === 'speaking' && <button className="btn" onClick={play.pause}>Pause</button>}
              {play.state === 'paused' && <button className="btn" onClick={play.resume}>Resume</button>}
              {play.state !== 'idle' && <button className="btn ghost" onClick={play.stop}>Stop audio</button>}
              {play.available && <span className="state">{play.state === 'idle' ? (recording ? `Recorded audio · ${Math.round((view.audio?.durationSec ?? 0) / 60)} min · natural voices` : 'Not playing') : <>{play.state === 'paused' ? 'Paused' : 'Speaking'}: <b>{play.speakerId && sp[play.speakerId].name}</b>, turn {play.seq}</>}</span>}
            </div>
          </div>
        </div>
        <Footer config={config} />
      </section>
      <SidePanel open={panelOpen} onClose={() => setPanelOpen(false)}
        voices={<VoicePicker speakers={sp} voices={voices} prefs={prefs} update={update}
          preview={k => new BrowserSpeech(() => prefs).speak([{ key: 'p', speakerId: k, text: `Hi, I'm ${sp[k].name}. This is how I'll sound on the show.` }], {})} />} />
    </div>
  );
}
