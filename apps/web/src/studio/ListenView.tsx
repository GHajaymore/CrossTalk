import { useEffect } from 'react';
import { ARTIST, episodeLabel, hostSubtitle, JOBS, type ConversationView, type SpeakerId } from '@crosstalk/shared';
import type { Playback } from '../speech/usePlayback';
import { sketchSrc } from './ArtistCard';

const SPEEDS = [0.8, 1, 1.25, 1.5];

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

type Props = { view: ConversationView; play: Playback; rate: number; setRate: (r: number) => void };

/** The phone podcast player: one big button, chapters for every turn, and lock-screen controls. */
export function ListenView({ view, play, rate, setRate }: Props) {
  const sp = view.speakers;
  const turns = view.turns;
  const clock = play.clock;
  const on = play.state !== 'idle';
  const seq = play.seq ?? 0;
  const who: SpeakerId | null = play.speakerId;
  const cover = view.artist?.state === 'done' && view.artist.sketchSvg ? sketchSrc(view.artist.sketchSvg) : null;
  const speed = clock ? clock.rate : rate;

  const toggle = () => {
    if (play.state === 'speaking') play.pause();
    else if (play.state === 'paused') play.resume();
    else play.playFrom(1);
  };
  const step = (d: number) => {
    const target = Math.min(turns.length, Math.max(1, (seq || 1) + d));
    play.playFrom(target);
  };

  useMediaSession(view, play, cover, toggle, step);

  if (!turns.length) return <div className="empty-stage"><p>Nothing to listen to yet. Start the episode from Watch, then come back here.</p></div>;

  const progress = clock ? clock.position / Math.max(1, clock.duration) : seq ? (seq - 1) / turns.length : 0;

  return (
    <section className="listen-view" aria-label="Listen">
      <div className="cover">
        {cover ? <img src={cover} alt={`${ARTIST.name}'s sketch for this episode: ${view.artist?.artTitle}`} />
          : <div className="cover-blank" aria-hidden="true"><span className="brand-mark"><i /><i /></span></div>}
      </div>
      <div className="listen-meta">
        <span className="tag">CrossTalk · {view.format === 'live' ? 'Live' : episodeLabel(view.episode)}</span>
        <h2>{view.topic}</h2>
        <p className="hint">{sp.A.name} &amp; {sp.B.name} · {clock ? `${mmss(clock.duration)} · natural voices` : `${turns.length} turns · this device's voices`}</p>
      </div>

      <div className="now" aria-live="polite">
        {on && who ? <>
          <span className={`flag ${who}`} aria-hidden="true">{who}</span>
          <div><b>{sp[who].name}</b> <span className="hint">· {JOBS[seq - 1] ?? ''} · turn {seq}</span>
            <p className="now-line">{play.caption}</p></div>
        </> : <p className="hint">Press play. The screen can go dark; {clock ? 'the episode keeps playing.' : 'keep this page open while it reads.'}</p>}
      </div>

      <div className="scrub">
        {clock
          ? <input type="range" min={0} max={Math.round(clock.duration)} step={1} value={Math.round(clock.position)}
              onChange={e => clock.seek(Number(e.target.value))} aria-label="Position in the episode" />
          : <div className="turn-steps" role="img" aria-label={`Turn ${seq || 0} of ${turns.length}`}>
              {turns.map(t => <i key={t.seq} className={`${t.speakerId}${t.seq < seq ? ' done' : t.seq === seq ? ' here' : ''}`} />)}
            </div>}
        <div className="scrub-times"><span>{clock ? mmss(clock.position) : `Turn ${seq || 0}`}</span><span>{clock ? mmss(clock.duration) : `of ${turns.length}`}</span></div>
        <div className="scrub-bar" aria-hidden="true"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
      </div>

      <div className="transport">
        <button className="round" onClick={() => step(-1)} disabled={!on || seq <= 1} aria-label="Previous turn">⏮</button>
        {clock && <button className="round" onClick={() => clock.seek(clock.position - 15)} disabled={!on} aria-label="Back 15 seconds">−15</button>}
        <button className="round big" onClick={toggle} aria-label={play.state === 'speaking' ? 'Pause' : 'Play'}>{play.state === 'speaking' ? '❚❚' : '▶'}</button>
        {clock && <button className="round" onClick={() => clock.seek(clock.position + 15)} disabled={!on} aria-label="Forward 15 seconds">+15</button>}
        <button className="round" onClick={() => step(1)} disabled={!on || seq >= turns.length} aria-label="Next turn">⏭</button>
      </div>

      <div className="dock-row speeds" role="group" aria-label="Speed">
        <span className="tag">Speed</span>
        {SPEEDS.map(s => <button key={s} className="chip sm" aria-pressed={speed === s} onClick={() => (clock ? clock.setRate(s) : setRate(s))}>{s}×</button>)}
        {on && <button className="btn sm ghost" onClick={play.stop}>Stop</button>}
      </div>

      <ol className="chapters" aria-label="Chapters">
        {turns.map(t => (
          <li key={t.seq}>
            <button onClick={() => play.playFrom(t.seq)} aria-current={on && t.seq === seq ? 'true' : undefined}>
              <span className={`flag ${t.speakerId}`} aria-hidden="true">{t.speakerId}</span>
              <span className="ch-text"><b>{JOBS[t.seq - 1] ?? `Turn ${t.seq}`}</b><span className="hint">{sp[t.speakerId].name} · {hostSubtitle(sp[t.speakerId])}</span></span>
              <span className="tag">{clock ? mmss(view.audio?.timings.find(x => x.seq === t.seq)?.start ?? 0) : t.seq}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Lock-screen and headphone controls, where the browser supports them. */
function useMediaSession(view: ConversationView, play: Playback, cover: string | null, toggle: () => void, step: (d: number) => void) {
  const who = play.speakerId ? view.speakers[play.speakerId].name : null;
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.metadata = new MediaMetadata({
        title: view.topic,
        artist: who ? `${who} · CrossTalk` : `${view.speakers.A.name} & ${view.speakers.B.name} · CrossTalk`,
        album: view.format === 'live' ? 'CrossTalk Live' : episodeLabel(view.episode),
        artwork: cover ? [{ src: cover, sizes: '512x512', type: 'image/svg+xml' }] : [],
      });
      ms.playbackState = play.state === 'speaking' ? 'playing' : play.state === 'paused' ? 'paused' : 'none';
      ms.setActionHandler('play', toggle);
      ms.setActionHandler('pause', toggle);
      ms.setActionHandler('previoustrack', () => step(-1));
      ms.setActionHandler('nexttrack', () => step(1));
    } catch { /* some browsers support only part of this */ }
  });
}
