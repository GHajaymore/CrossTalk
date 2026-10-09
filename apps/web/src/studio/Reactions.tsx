import { useRef, useState } from 'react';
import { REACTIONS, type ConversationView, type ReactionKind } from '@crosstalk/shared';
import { api } from '../api/client';

type Float = { id: number; emoji: string; x: number };

/**
 * React while you listen: tap an emoji and it floats up, saved on the line being said (or the last
 * line). Free, no model request. Iris reads them when she picks the moment to draw.
 */
export function ReactionBar({ view, seq, setView, toast }: { view: ConversationView; seq: number | null; setView: (v: ConversationView) => void; toast: (m: string) => void }) {
  const [floats, setFloats] = useState<Float[]>([]);
  const next = useRef(0);
  const target = seq ?? view.turns[view.turns.length - 1]?.seq ?? null;
  if (!target) return null;
  const who = view.speakers[view.turns.find(t => t.seq === target)?.speakerId ?? 'A'].name;
  const react = async (kind: ReactionKind) => {
    const id = next.current++;
    setFloats(f => [...f.slice(-11), { id, emoji: REACTIONS[kind].emoji, x: 10 + Math.random() * 80 }]);
    window.setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 2200);
    try {
      const r = await api.react(view.id, target, kind);
      setView({ ...view, reactions: r.reactions });
    } catch (e) { toast((e as Error).message); }
  };
  return (
    <div className="react-bar" role="group" aria-label={`React to turn ${target}, ${who}`}>
      <div className="react-floats" aria-hidden="true">{floats.map(f => <span key={f.id} style={{ left: `${f.x}%` }}>{f.emoji}</span>)}</div>
      <span className="tag">React · turn {target}</span>
      {(Object.keys(REACTIONS) as ReactionKind[]).map(k => (
        <button key={k} className="react-btn" onClick={() => react(k)} title={REACTIONS[k].label} aria-label={`${REACTIONS[k].label} (${REACTIONS[k].emoji})`}>
          <span aria-hidden="true">{REACTIONS[k].emoji}</span>
        </button>
      ))}
    </div>
  );
}

/** Reaction counts on a line, in the transcript. */
export function ReactionChips({ counts }: { counts?: Partial<Record<ReactionKind, number>> }) {
  const list = counts ? (Object.keys(REACTIONS) as ReactionKind[]).filter(k => counts[k]) : [];
  if (!list.length) return null;
  return (
    <span className="react-chips" aria-label={`Your reactions: ${list.map(k => `${REACTIONS[k].label} ${counts![k]}`).join(', ')}`}>
      {list.map(k => <span key={k} className="react-chip" aria-hidden="true">{REACTIONS[k].emoji} {counts![k]}</span>)}
    </span>
  );
}
