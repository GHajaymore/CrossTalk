import { useState } from 'react';
import {
  AUDIENCES, CUE_LIMIT, episodeLabel, jobFor, MAX_TURNS, MODES, personaLabel, speakerFor, TEMPERATURES,
  type AppConfig, type ConversationView,
} from '@crosstalk/shared';
import { api } from '../api/client';
import { useConversation } from '../api/useConversation';
import { CueCard } from '../studio/CueCard';
import { SidePanel } from '../studio/SidePanel';
import { StudioSet } from '../studio/StudioSet';
import { TurnCard } from '../studio/TurnCard';
import { TurnRail } from '../studio/TurnRail';
import { lastSentence, spokenSeconds, tail } from '../lib/text';
import { Footer } from './Footer';

type Props = { id: string; config: AppConfig | null; refreshConfig: () => void; toast: (m: string) => void };

export function Studio({ id, config, refreshConfig, toast }: Props) {
  const { view, live, pulse, error, setView } = useConversation(id, refreshConfig);
  const [panelOpen, setPanelOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (error && !view) return <div className="empty-stage"><p>{error}</p><a className="btn" href="#/create">Start a new one</a></div>;
  if (!view) return <div className="empty-stage"><p>Opening the studio…</p></div>;

  const sp = view.speakers;
  const st = view.run?.state ?? 'idle';
  const lastSeq = view.turns.reduce((m, t) => Math.max(m, t.seq), 0);
  const failedSeq = st === 'failed' ? lastSeq + 1 : null;
  const otherBusy = !!config?.activeConversationId && config.activeConversationId !== id;
  const reason = view.run?.stopReason;

  const act = (fn: (id: string) => Promise<ConversationView>) => async () => {
    setBusy(true);
    try { setView(await fn(id)); } catch (e) { toast((e as Error).message); } finally { setBusy(false); refreshConfig(); }
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
  const caption = live
    ? { who: live.speakerId, text: tail(live.text) || '…' }
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
          hosts={{ A: { name: sp.A.name, role: personaLabel(sp.A) }, B: { name: sp.B.name, role: personaLabel(sp.B) } }}
          guest={null}
          speaking={live?.speakerId ?? null}
          voiceLevel={pulse}
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

        <div className="table">
          {!view.turns.length && !live && st === 'idle' && (
            <div className="empty-stage"><p>Both seats are ready. Press Start to hear {sp.A.name} open.</p></div>
          )}
          {view.turns.map(t => (
            <TurnCard key={t.seq} seq={t.seq} speakerId={t.speakerId} name={sp[t.speakerId].name} objective={t.objective}
              modelId={t.modelId} text={t.text} state="completed" onCopy={() => copy(t.text)} />
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
              {st === 'idle' && <button className="btn primary" disabled={busy || otherBusy} onClick={act(api.start)}>Start</button>}
              {st === 'paused' && <button className="btn primary" disabled={busy || otherBusy} onClick={act(api.start)}>Resume</button>}
              {st === 'failed' && <button className="btn primary" disabled={busy || otherBusy} onClick={act(api.start)}>Retry turn {lastSeq + 1}</button>}
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
              <button className="btn" disabled title="Voices arrive in Milestone 3">▶ Play from start</button>
              <span className="state">Voices arrive in Milestone 3</span>
            </div>
          </div>
        </div>
        <Footer />
      </section>
      <SidePanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </div>
  );
}
