import { useState } from 'react';
import { mindChange, type ConversationView } from '@crosstalk/shared';
import { api } from '../api/client';

/** Starts the next round (or opens it if it exists) and takes you there. */
export function useNextRound(view: ConversationView, toast: (m: string) => void) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (view.nextRound) { location.hash = `#/studio/${view.nextRound.id}/watch`; return; }
    setBusy(true);
    try {
      const next = await api.nextRound(view.id);
      // Starting can be refused (daily limit, another episode generating); the Studio then shows Start.
      await api.start(next.id).catch(() => {});
      location.hash = `#/studio/${next.id}/watch`;
    } catch (e) { toast((e as Error).message); }
    setBusy(false);
  };
  return { go, busy };
}

/** What's next: the same hosts take the question up again, starting where they ended. */
export function RoundCard({ view, toast }: { view: ConversationView; toast: (m: string) => void }) {
  const { go, busy } = useNextRound(view, toast);
  const m = mindChange(view.turns);
  const n = view.nextRound?.round ?? view.round + 1;
  const ends = (['A', 'B'] as const).filter(k => m[k].end != null).map(k => `${view.speakers[k].name} at ${m[k].end}%`);
  const you = view.youEnd ?? view.youStart;
  return (
    <section className="round-card" aria-label={`Round ${n}`}>
      <div>
        <span className="tag">What's next</span>
        <h3>{view.nextRound ? `Round ${n} is ready` : `Round ${n}`}</h3>
        <p className="hint">Same hosts, same question. They pick up where they ended{ends.length ? `: ${ends.join(', ')} on yes` : ''}{you != null ? `, and you at ${you}%` : ''}, and dig into what was still open.</p>
      </div>
      <button className="btn primary" disabled={busy} onClick={go}>{view.nextRound ? `Open round ${n} →` : busy ? 'Starting…' : `↻ Start round ${n}`}</button>
    </section>
  );
}
