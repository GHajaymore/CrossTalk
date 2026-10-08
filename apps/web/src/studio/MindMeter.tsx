import { mindChange, type Speakers, type Turn } from '@crosstalk/shared';

/**
 * Did anyone change their mind? Each host says how sure they are on their first line and again on
 * their last. 0 is firmly no, 100 firmly yes. Hollow ring = where they started, filled = where they ended.
 */
export function MindMeter({ turns, speakers, compact }: { turns: Turn[]; speakers: Speakers; compact?: boolean }) {
  const m = mindChange(turns);
  if (m.A.start == null && m.B.start == null) return null;
  const line = (id: 'A' | 'B') => {
    const { start, end } = m[id];
    if (start == null) return null;
    const moved = end == null ? null : end - start;
    const verdict = moved == null ? 'still to say where they landed'
      : Math.abs(moved) < 3 ? 'held their ground'
      : `moved ${Math.abs(moved)} toward ${moved > 0 ? 'yes' : 'no'}`;
    return (
      <div className={`mm-row ${id}`} key={id}>
        <span className="mm-name"><span className={`flag ${id}`} aria-hidden="true">{id}</span>{speakers[id].name}</span>
        <div className="mm-track" aria-hidden="true">
          {end != null && <i className="mm-span" style={{ left: `${Math.min(start, end)}%`, width: `${Math.abs(end - start)}%` }} />}
          <i className="mm-dot start" style={{ left: `${start}%` }} />
          {end != null && <i className="mm-dot end" style={{ left: `${end}%` }} />}
        </div>
        <span className="mm-text">{start}%{end != null ? ` → ${end}%` : ''} · {verdict}</span>
      </div>
    );
  };
  return (
    <section className={`mind-meter${compact ? ' compact' : ''}`} aria-label="Mind-change meter">
      <div className="mm-head"><span className="tag">Mind-change meter</span><span className="tag">No · 0 ← → 100 · Yes</span></div>
      {line('A')}{line('B')}
    </section>
  );
}
