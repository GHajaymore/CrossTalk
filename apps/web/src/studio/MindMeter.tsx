import { useState } from 'react';
import { mindChange, type Speakers, type Turn } from '@crosstalk/shared';

type You = { start: number | null; end: number | null };
type Props = {
  turns: Turn[]; speakers: Speakers; compact?: boolean;
  /** Where you stand: your own row, asked before you listen and again at the end. */
  you?: You;
  done?: boolean;
  onYou?: (patch: Partial<You>) => Promise<void>;
};

const movedText = (start: number, end: number | null, who: 'they' | 'you') => end == null ? null
  : Math.abs(end - start) < 3 ? (who === 'you' ? 'you held your ground' : 'held their ground')
  : `${who === 'you' ? 'you ' : ''}moved ${Math.abs(end - start)} toward ${end > start ? 'yes' : 'no'}`;

function Track({ start, end }: { start: number; end: number | null }) {
  return (
    <div className="mm-track" aria-hidden="true">
      {end != null && <i className="mm-span" style={{ left: `${Math.min(start, end)}%`, width: `${Math.abs(end - start)}%` }} />}
      <i className="mm-dot start" style={{ left: `${start}%` }} />
      {end != null && <i className="mm-dot end" style={{ left: `${end}%` }} />}
    </div>
  );
}

/**
 * Did anyone change their mind? Each host says how sure they are on their first line and again on
 * their last; you can add yourself. 0 is firmly no, 100 firmly yes. Hollow ring = start, filled = end.
 */
export function MindMeter({ turns, speakers, compact, you, done, onYou }: Props) {
  const m = mindChange(turns);
  const hosts = m.A.start != null || m.B.start != null;
  const askable = !!onYou;
  if (!hosts && !(askable || you?.start != null)) return null;
  const line = (id: 'A' | 'B') => {
    const { start, end } = m[id];
    if (start == null) return null;
    return (
      <div className={`mm-row ${id}`} key={id}>
        <span className="mm-name"><span className={`flag ${id}`} aria-hidden="true">{id}</span>{speakers[id].name}</span>
        <Track start={start} end={end} />
        <span className="mm-text">{start}%{end != null ? ` → ${end}%` : ''} · {movedText(start, end, 'they') ?? 'still to say where they landed'}</span>
      </div>
    );
  };
  return (
    <section className={`mind-meter${compact ? ' compact' : ''}`} aria-label="Mind-change meter">
      <div className="mm-head"><span className="tag">Mind-change meter</span><span className="tag">No · 0 ← → 100 · Yes</span></div>
      {line('A')}{line('B')}
      {(askable || you?.start != null) && <YouRow you={you ?? { start: null, end: null }} done={!!done} onYou={askable ? onYou : undefined} />}
    </section>
  );
}

function YouRow({ you, done, onYou }: { you: You; done: boolean; onYou?: Props['onYou'] }) {
  const [value, setValue] = useState(you.end ?? you.start ?? 50);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async (patch: Partial<You>) => {
    if (!onYou) return;
    setBusy(true);
    try { await onYou(patch); setEditing(false); } finally { setBusy(false); }
  };
  const name = <span className="mm-name"><span className="flag Y" aria-hidden="true">Y</span>You</span>;

  // Asking: before you listen, or once it's finished.
  const asking = onYou && (you.start == null || (done && (you.end == null || editing)));
  if (asking) {
    const before = you.start == null;
    return (
      <div className="mm-row Y mm-ask">
        {name}
        <label className="mm-slider">
          <span className="sr-only">{before ? 'Where you stand before listening' : 'Where you stand now'}, 0 is no and 100 is yes</span>
          <input type="range" min={0} max={100} step={5} value={value} onChange={e => setValue(Number(e.target.value))}
            aria-valuetext={`${value}% on yes`} />
        </label>
        <span className="mm-askbar">
          <span className="mm-text">{before ? 'Before you listen: where do you stand?' : 'Where are you now?'} <b>{value}%</b></span>
          <button className="btn sm" disabled={busy} onClick={() => save(before ? { start: value } : { end: value })}>{before ? "That's me" : 'Save'}</button>
        </span>
      </div>
    );
  }
  if (you.start == null) return null;
  return (
    <div className="mm-row Y">
      {name}
      <Track start={you.start} end={you.end} />
      <span className="mm-text">{you.start}%{you.end != null ? ` → ${you.end}%` : ''} · {movedText(you.start, you.end, 'you') ?? (done ? 'say where you landed' : 'listen, then say where you landed')}
        {onYou && you.end != null && <button className="linkish" onClick={() => { setValue(you.end!); setEditing(true); }}>Change</button>}
      </span>
    </div>
  );
}
