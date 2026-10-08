import { useEffect, useRef, useState } from 'react';
import {
  AUDIENCES, CUE_LIMIT, episodeLabel, hideStanceTag, hostSubtitle, jobIn, MODES, speakerFor, TEMPERATURES, turnTotal,
  type AppConfig, type ConversationView, type Intervention,
} from '@crosstalk/shared';
import { api } from '../api/client';
import { useConversation } from '../api/useConversation';
import { ArtistCard } from '../studio/ArtistCard';
import { BriefBox } from '../scout/BriefBox';
import { BranchDialog } from '../studio/BranchDialog';
import { LivingSketch, sketchProgress } from '../studio/LivingSketch';
import { MindMeter } from '../studio/MindMeter';
import { BranchList } from '../studio/BranchList';
import { CueCard } from '../studio/CueCard';
import { cueState, CuePanel } from '../studio/CuePanel';
import { EpisodeKit } from '../studio/EpisodeKit';
import { ListenView } from '../studio/ListenView';
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

export type StudioTab = 'watch' | 'listen' | 'read';
export const STUDIO_TABS: [StudioTab, string, string][] = [
  ['watch', 'Watch', 'The set, live'],
  ['listen', 'Listen', 'Podcast player'],
  ['read', 'Read', 'Transcript & Iris'],
];

type Props = { id: string; tab: StudioTab; config: AppConfig | null; refreshConfig: () => void; toast: (m: string) => void };

/** One episode, three ways in. Playback lives here, so switching tabs never stops the audio. */
export function Studio({ id, tab, config, refreshConfig, toast }: Props) {
  const { view, live, pulse, error, setView } = useConversation(id, refreshConfig);
  const [panelOpen, setPanelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [onAir, setOnAir] = useState(false);
  const [branchFrom, setBranchFrom] = useState<number | null>(null);
  const setRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!onAir) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOnAir(false); };
    const fs = () => { if (!document.fullscreenElement) setOnAir(false); };
    addEventListener('keydown', key); document.addEventListener('fullscreenchange', fs);
    return () => {
      removeEventListener('keydown', key); document.removeEventListener('fullscreenchange', fs);
      // However On air ends (Escape, the button, another tab), the browser leaves fullscreen too.
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [onAir]);
  const goOnAir = () => {
    setOnAir(true);
    // Real fullscreen where the browser allows it; the CSS fallback covers phones that don't.
    setRef.current?.requestFullscreen?.().catch(() => {});
  };
  const leaveAir = () => setOnAir(false);

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
    generating: live ? `${sp[live.speakerId].name} is on air · turn ${live.seq} of ${turnTotal(view)}` : 'Starting',
    paused: reason === 'interrupted' ? `Interrupted after turn ${lastSeq} · the server restarted` : reason && reason !== 'by you' ? `Paused after turn ${lastSeq} · ${reason}` : `Paused after turn ${lastSeq}`,
    completed: 'Complete',
    cancelled: `Stopped after turn ${lastSeq}`,
    failed: `Turn ${lastSeq + 1} failed`,
  }[st];

  const lastTurn = view.turns[view.turns.length - 1];
  const listening = play.state !== 'idle' && play.speakerId;
  // A guest who took the mic keeps the gold seat for the rest of the episode; their words show while they wait to be answered.
  const guests = view.interventions.filter(c => c.kind === 'guest');
  const guestWaiting = guests.find(c => c.status === 'queued');
  const caption = live && !listening
    ? { who: live.speakerId, text: tail(hideStanceTag(live.text)) || '…' }
    : guestWaiting && !listening ? { who: 'G' as const, text: guestWaiting.text ?? '' }
    : listening ? { who: play.speakerId, text: play.caption }
    : st === 'failed' ? { who: null, text: 'The connection dropped on this turn. Everything before it is saved.' }
    : lastTurn && st !== 'idle' && st !== 'generating' ? { who: lastTurn.speakerId, text: lastSentence(lastTurn.text) }
    : null;

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { toast('Copy is blocked in this browser'); }
  };

  const set = (
    <StudioSet
      show={`CrossTalk · ${view.format === 'live' ? '● Live' : episodeLabel(view.episode)}`}
      topic={view.topic}
      tags={`${MODES[view.mode].label} · ${AUDIENCES[view.audience].label} · ${TEMPERATURES[view.temperature].label}`}
      temperature={view.temperature}
      hosts={{ A: { name: sp.A.name, role: hostSubtitle(sp.A) }, B: { name: sp.B.name, role: hostSubtitle(sp.B) } }}
      guest={guests.length ? { name: 'Guest', role: 'You, on the mic' } : null}
      speaking={listening ? play.speakerId : live?.speakerId ?? null}
      voiceLevel={listening ? play.pulse : pulse}
      caption={caption}
      runState={st}
      clock={{ seconds: spokenSeconds(view.turns.map(t => t.text)), running: st === 'generating' }}
      iris={view.artist?.state === 'listening' ? { text: 'Iris · sketching…', active: true }
        : view.artist?.state === 'done' ? { text: 'Iris · notes ready', active: false }
        : st === 'generating' ? { text: 'Iris · listening', active: true } : { text: 'Iris · in the booth', active: false }}
    />
  );

  const cueLimit = config?.rules.cueLimit ?? CUE_LIMIT;
  const cues = cueState(view, live, cueLimit);
  const branchBlocked = st === 'generating' ? 'Pause or stop the episode first' : null;
  const deeper = async (seq: number) => {
    try { setView(await api.addCue(id, { kind: 'deeper', targetSeq: seq })); toast(`Go deeper on turn ${seq} · lands before turn ${cues.landsBefore}`); }
    catch (e) { toast((e as Error).message); }
  };
  const cancelCue = (c: Intervention) => async () => {
    try { setView(await api.cancelCue(id, c.id)); toast('Cue taken back'); } catch (e) { toast((e as Error).message); }
  };
  // Each cue card sits on the centre line just before the turn it lands on.
  // A waiting cue can be taken back until its turn starts being written.
  const canCancel = (c: Intervention) => c.status === 'queued' && !c.fromOriginal && !(live && live.seq >= c.appliesBeforeSeq);
  const cuesBefore = (seq: number) => view.interventions.filter(c => c.appliesBeforeSeq === seq)
    .map(c => <CueCard key={c.id} cue={c} onCancel={canCancel(c) ? cancelCue(c) : undefined} />);
  const shown = new Set([...view.turns.map(t => t.seq), ...(live ? [live.seq] : []), ...(failedSeq ? [failedSeq] : [])]);
  const createBranch = async (direction: string) => {
    try {
      const child = await api.branch(id, { fromSeq: branchFrom!, direction });
      setBranchFrom(null);
      toast('Branch ready. Press Start for 4 new turns.');
      location.hash = `#/studio/${child.id}/watch`;
    } catch (e) { toast((e as Error).message); }
  };

  const transcript = (
    <>
      {view.brief && <BriefBox brief={view.brief} note={view.brief.sources.join(', ')} />}
      <MindMeter turns={view.turns} speakers={sp} />
      <div className="table">
        {!view.turns.length && !live && st === 'idle' && (
          <div className="empty-stage"><p>Both seats are ready. Press Start to hear {sp.A.name} open.</p></div>
        )}
        {view.turns.map(t => (
          <div key={t.seq} className="turn-slot">
            {cuesBefore(t.seq)}
            <TurnCard seq={t.seq} speakerId={t.speakerId} name={sp[t.speakerId].name} objective={t.objective}
              modelId={t.modelId} text={t.text} state="completed" onCopy={() => copy(t.text)}
              speaking={play.state !== 'idle' && play.seq === t.seq} onPlayFrom={play.available ? () => play.playFrom(t.seq) : undefined}
              onDeeper={() => deeper(t.seq)} deeperBlocked={cues.blocked}
              onBranch={() => setBranchFrom(t.seq)} branchBlocked={branchBlocked}
              inherited={t.conversationId !== view.id}
              splices={view.branches.filter(b => b.branchSeq === t.seq).map(b => ({ id: b.id, direction: b.direction }))} />
            {view.branchSeq === t.seq && <div className="cut-line" role="separator"><span>✂ Your branch starts here: “{view.branchDirection}”</span></div>}
          </div>
        ))}
        {live && !view.turns.some(t => t.seq === live.seq) && <>
          {cuesBefore(live.seq)}
          <TurnCard seq={live.seq} speakerId={live.speakerId} name={sp[live.speakerId].name} objective={live.objective}
            modelId={live.modelId} text={hideStanceTag(live.text)} state="streaming" />
        </>}
        {failedSeq && <>
          {cuesBefore(failedSeq)}
          <TurnCard seq={failedSeq} speakerId={speakerFor(failedSeq)} name={sp[speakerFor(failedSeq)].name} objective={jobIn(view, failedSeq)}
            modelId={sp[speakerFor(failedSeq)].modelId} text={reason ?? 'This turn failed.'} state="failed" />
        </>}
        {view.interventions.filter(c => !shown.has(c.appliesBeforeSeq)).map(c => <CueCard key={c.id} cue={c} onCancel={canCancel(c) ? cancelCue(c) : undefined} />)}
      </div>
      {view.artist && (
        <ArtistCard notes={view.artist} speakers={sp} conversationId={id} toast={toast}
          onAgain={() => { api.askIris(id).catch(e => toast((e as Error).message)); /* her progress arrives over the live stream */ }}
          onJump={seq => document.getElementById(`turn-${seq}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
      )}
      {st === 'completed' && view.artist?.state === 'done' && <EpisodeKit c={view} toast={toast} />}
    </>
  );

  return (
    <div className="studio">
      <section className="stage" aria-label="Discussion">
        <nav className="studio-tabs" aria-label="Ways to follow this episode">
          {STUDIO_TABS.map(([k, label, sub]) => (
            <a key={k} href={`#/studio/${id}/${k}`} aria-current={tab === k ? 'page' : undefined}>
              <b>{label}</b><span>{sub}</span>
            </a>
          ))}
        </nav>
        {view.parent && (
          <div className="branch-banner">
            <span><span aria-hidden="true">✂ </span>Branch from turn {view.branchSeq} of <b>{view.parent.title}</b>: “{view.branchDirection}”</span>
            <a className="btn sm ghost" href={`#/studio/${view.parent.id}/read`}>← Back to the original</a>
          </div>
        )}

        {tab === 'watch' && <>
          <div ref={setRef} className={`set-wrap${onAir ? ' on-air' : ''}`}>
            {set}
            {/* While the episode plays, Iris draws in the corner, finishing on the turn she chose. */}
            {play.state !== 'idle' && view.artist?.state === 'done' && view.artist.sketchSvg && (
              <div className="iris-pip" aria-hidden="true">
                <LivingSketch ghost className="living" svg={view.artist.sketchSvg} progress={sketchProgress(view, play)} label="" />
                <span className="tag">Iris · drawing</span>
              </div>
            )}
            {onAir && <button className="btn sm leave-air" onClick={leaveAir}>Leave On air</button>}
          </div>
          {view.brief && <details className="brief stage-brief"><summary>Today's brief · {view.brief.sources.join(', ')}</summary><BriefBox brief={view.brief} /></details>}
          <TurnRail turns={view.turns} liveSeq={live?.seq ?? null} failedSeq={failedSeq} speakers={sp}
            branchSeq={view.branchSeq} cueSeqs={view.interventions.filter(c => c.status === 'queued').map(c => c.appliesBeforeSeq)} />
          <MindMeter turns={view.turns} speakers={sp} compact />
        </>}
        <div className="status-line" aria-live="polite">
          <span><b>{statusWord}</b>{view.run?.pauseRequested ? ' · pausing after this turn' : ''}</span>
          <span>{view.interventions.filter(c => !c.fromOriginal && c.kind !== 'note').length} of {cueLimit} cues used</span>
        </div>

        <SetupBanner config={config} />
        <BudgetBanner config={config} />
        {startError && <div className="banner" role="alert"><span><b>Couldn't start.</b> {startError}</span><button className="btn sm ghost" onClick={() => setStartError(null)}>Dismiss</button></div>}

        {tab === 'listen' && <ListenView view={view} play={play} rate={prefs.rate} setRate={r => update({ rate: r })} />}
        {tab === 'read' && transcript}
        {tab === 'watch' && view.turns.length > 0 && (
          <p className="hint tab-hint">The full transcript, Iris's sketch and the episode kit are on <a href={`#/studio/${id}/read`}>Read</a>. On your phone, <a href={`#/studio/${id}/listen`}>Listen</a> plays it like a podcast.</p>
        )}

        <div className={`dock${tab === 'listen' ? ' solo' : ''}`}>
          <div className="dock-group">
            <span className="tag">Generation</span>
            <div className="dock-row">
              {st === 'idle' && <button className="btn primary" disabled={cantRun} onClick={act(api.start)}>Start</button>}
              {st === 'paused' && <button className="btn primary" disabled={cantRun} onClick={act(api.start)}>Resume</button>}
              {st === 'failed' && <button className="btn primary" disabled={cantRun} onClick={act(api.start)}>Retry turn {lastSeq + 1}</button>}
              {st === 'generating' && <button className="btn" disabled={busy || !!view.run?.pauseRequested} onClick={act(api.pause)}>Pause after this turn</button>}
              {(st === 'generating' || st === 'paused' || st === 'failed') && <button className="btn danger" disabled={busy} onClick={act(api.stop)}>Stop</button>}
              {tab === 'read' && view.turns.length > 0 && (
                <details className="export-menu">
                  <summary className="btn ghost">Export</summary>
                  <div className="menu" role="menu">
                    <a role="menuitem" href={`/api/conversations/${id}/export.md`} download>Markdown script<small>Readable transcript with cues and Iris</small></a>
                    <a role="menuitem" href={`/api/conversations/${id}/export.json`} download>JSON<small>Schema v1: models, turns, cues, branches</small></a>
                  </div>
                </details>
              )}
              {tab === 'watch' && <button className="btn ghost" onClick={goOnAir} title="Full screen, just the set">On air ⛶</button>}
              <button className="btn ghost panel-toggle" onClick={() => setPanelOpen(o => !o)}>Cues &amp; voices</button>
            </div>
            {otherBusy && st !== 'generating' && <span className="state">Another discussion is generating. Pause or stop it first.</span>}
          </div>
          {tab !== 'listen' && <div className="dock-group listen">
            <span className="tag">Listen</span>
            <div className="dock-row">
              {!play.available && <span className="state">Speech isn't available in this browser. Every turn stays readable.</span>}
              {play.available && play.state === 'idle' && <button className="btn" disabled={!view.turns.length} onClick={() => play.playFrom(1)}>▶ Play from start</button>}
              {play.state === 'speaking' && <button className="btn" onClick={play.pause}>Pause</button>}
              {play.state === 'paused' && <button className="btn" onClick={play.resume}>Resume</button>}
              {play.state !== 'idle' && <button className="btn ghost" onClick={play.stop}>Stop audio</button>}
              {play.available && <span className="state">{play.state === 'idle' ? (recording ? `Recorded audio · ${Math.round((view.audio?.durationSec ?? 0) / 60)} min · natural voices` : 'Not playing') : <>{play.state === 'paused' ? 'Paused' : 'Speaking'}: <b>{play.speakerId && sp[play.speakerId].name}</b>, turn {play.seq}</>}</span>}
            </div>
          </div>}
        </div>
        <Footer config={config} briefed={!!view.brief} />
      </section>
      {branchFrom && <BranchDialog seq={branchFrom} who={sp[speakerFor(branchFrom)].name} onClose={() => setBranchFrom(null)} onCreate={createBranch} />}
      <SidePanel open={panelOpen} onClose={() => setPanelOpen(false)}
        cue={<CuePanel view={view} live={live} setView={setView} toast={toast} limit={cueLimit} allowHeated={config?.rules.allowHeated ?? true} />}
        branches={<BranchList view={view} />}
        voices={<VoicePicker names={{ A: sp.A.name, B: sp.B.name }} voices={voices} prefs={prefs} update={update}
          preview={k => new BrowserSpeech(() => prefs).speak([{ key: 'p', speakerId: k, text: `Hi, I'm ${sp[k].name}. This is how I'll sound on the show.` }], {})} />} />
    </div>
  );
}
