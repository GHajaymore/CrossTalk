import { useEffect, useRef, type ReactNode } from 'react';
import { initials as toInitials, type RunState, type Temperature } from '@crosstalk/shared';
import { HeatMeter } from '../lib/HeatMeter';
import { clock } from '../lib/text';
import './StudioSet.css';

export type SeatKey = 'A' | 'B' | 'G';

export type Presenter = {
  name: string;
  /** Shown under the name on the name bar, e.g. "The Optimist". */
  role: string;
  /** Replaces the initials, e.g. a live <video> from a PresenterProvider (Phase 2). */
  media?: ReactNode;
};

export type StudioSetProps = {
  /** "CrossTalk · Ep. 03". */
  show: string;
  topic: string;
  /** "Explore · General · Lively"; the heat meter is added from `temperature`. */
  tags: string;
  /** Warms or cools the room light. */
  temperature: Temperature;
  hosts: { A: Presenter; B: Presenter };
  /** The guest seat between the hosts; hidden when null. */
  guest?: Presenter | null;
  /** Who is on air right now. Highlights their tile and drives their voice meter. */
  speaking: SeatKey | null;
  /** 0–1. Set a new value whenever the speaker makes sound (a word streams, a syllable plays); the meter eases back on its own. */
  voiceLevel: number;
  caption: { who: SeatKey | null; text: string } | null;
  /** Run state, or "lobby" on the Create screen. Sets the REC light. */
  runState: RunState | 'lobby';
  /** Episode length so far. While `running`, the clock ticks on from here. */
  clock: { seconds: number; running: boolean };
  iris: { text: string; active: boolean };
};

const REC: Record<StudioSetProps['runState'], [string, string]> = {
  lobby: ['READY', ''], idle: ['READY', ''], generating: ['REC', 'on'], paused: ['PAUSED', 'hold'],
  completed: ['SAVED', 'done'], cancelled: ['STOPPED', ''], failed: ['CONNECTION LOST', 'warn'],
};

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function Mic() {
  return (
    <svg className="set-mic" viewBox="0 0 60 120" aria-hidden="true">
      <path d="M30 120V78" stroke="#2b2e34" strokeWidth="5" />
      <path d="M8 120h44" stroke="#2b2e34" strokeWidth="6" strokeLinecap="round" />
      <path d="M14 44a16 16 0 0 0 32 0" fill="none" stroke="#3a3e45" strokeWidth="3" />
      <path d="M30 60v18" stroke="#3a3e45" strokeWidth="3" />
      <rect x="19" y="4" width="22" height="46" rx="11" fill="#1f2125" stroke="#41454c" strokeWidth="2" />
      <path d="M21 14h18M21 21h18M21 28h18M21 35h18" stroke="#50555c" strokeWidth="1.5" />
    </svg>
  );
}

/** The video-podcast studio set. Self-contained: give it who is on air and what they're saying. */
export function StudioSet(p: StudioSetProps) {
  const tiles = useRef<Record<SeatKey, HTMLDivElement | null>>({ A: null, B: null, G: null });
  const timerEl = useRef<HTMLSpanElement>(null);
  const meter = useRef({ lvl: { A: 0, B: 0, G: 0 }, tgt: { A: 0, B: 0, G: 0 }, t: 0 });
  const live = useRef({ speaking: p.speaking, anchor: 0, running: false });

  // A new voice level is a pulse on the speaker's meter.
  useEffect(() => {
    if (!p.speaking) return;
    const m = meter.current;
    m.tgt[p.speaking] = Math.min(1, m.tgt[p.speaking] + p.voiceLevel);
  }, [p.voiceLevel, p.speaking]);

  // The clock: anchored when recording starts, so it ticks smoothly between updates.
  useEffect(() => {
    const L = live.current;
    if (p.clock.running && !L.running) L.anchor = Date.now() - p.clock.seconds * 1000;
    L.running = p.clock.running;
    if (!p.clock.running && timerEl.current) timerEl.current.textContent = clock(p.clock.seconds);
  }, [p.clock.running, p.clock.seconds]);

  useEffect(() => { live.current.speaking = p.speaking; }, [p.speaking]);

  // One animation loop for meters and the clock. Writes straight to the DOM; React doesn't re-render per frame.
  useEffect(() => {
    const still = reducedMotion();
    let raf = 0;
    const draw = () => {
      const m = meter.current, L = live.current;
      m.t += 1 / 60;
      (['A', 'B', 'G'] as SeatKey[]).forEach(k => {
        const idle = L.speaking === k ? 0.22 : 0;
        m.tgt[k] += (idle - m.tgt[k]) * 0.05;
        m.lvl[k] += (m.tgt[k] - m.lvl[k]) * 0.2;
        const level = still ? (L.speaking === k ? 0.5 : 0) : m.lvl[k];
        const tile = tiles.current[k];
        if (!tile) return;
        tile.style.setProperty('--lvl', level.toFixed(3));
        tile.querySelectorAll<HTMLElement>('.set-lvl i').forEach((bar, i) => {
          const v = still ? level : Math.max(0, level * (0.45 + 0.55 * Math.abs(Math.sin(m.t * 8 + i * 1.9))));
          bar.style.transform = `scaleY(${(0.15 + v * 0.85).toFixed(3)})`;
        });
      });
      if (L.running && timerEl.current) timerEl.current.textContent = clock((Date.now() - L.anchor) / 1000);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const [recText, recClass] = REC[p.runState];
  const capName = p.caption?.who === 'G' ? 'YOU' : p.caption?.who ? p.hosts[p.caption.who].name.toUpperCase() : '';

  const tile = (k: SeatKey, who: Presenter) => (
    <div className={`set-tile ${k}${p.speaking === k ? ' on' : ''}`} ref={el => { tiles.current[k] = el; }} key={k}>
      <div className="set-cam">
        <div className="set-lamp" />
        {who.media
          ? <div className="set-media">{who.media}</div>
          : <div className="set-avatar"><span className="set-halo" /><span className="set-ini">{k === 'G' ? '🎙' : toInitials(who.name)}</span></div>}
        <Mic />
        <span className="set-camtag">{k === 'G' ? 'Guest · real person' : 'Host · AI presenter'}</span>
        {k !== 'G' && !who.media && <span className="set-vidnote">live video here · Phase 2</span>}
        <span className="set-livedot" aria-hidden="true" />
      </div>
      <div className="set-l3"><b>{who.name}</b><span>{who.role}</span></div>
      <div className="set-lvl" aria-hidden="true"><i /><i /><i /><i /><i /></div>
    </div>
  );

  return (
    <section className={`set${p.guest ? ' has-guest' : ''}`} data-temp={p.temperature} aria-label="Studio">
      <div className="set-wall" />
      <header className="set-top">
        <span className={`set-rec ${recClass}`}>{recText}</span>
        <span className="set-timer" ref={timerEl}>{clock(p.clock.seconds)}</span>
        <span className="set-show">{p.show}</span>
        <span className={`set-iris${p.iris.active ? ' on' : ''}`}><i />{p.iris.text}</span>
      </header>
      <div className="set-title">
        <span className="tag">{p.tags} <HeatMeter temperature={p.temperature} /></span>
        <h2>{p.topic}</h2>
      </div>
      <div className="set-tiles">
        {tile('A', p.hosts.A)}
        {p.guest && tile('G', p.guest)}
        {tile('B', p.hosts.B)}
      </div>
      <div className="set-desk" aria-hidden="true" />
      {p.caption?.text ? (
        <div className="set-cap" aria-live="off">
          {capName && <b className={p.caption.who ?? ''}>{capName}</b>}
          <span>{p.caption.text}</span>
        </div>
      ) : null}
    </section>
  );
}
