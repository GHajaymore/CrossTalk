import { useEffect, useRef, useState } from 'react';
import { jobLabel, type SpeakerId } from '@crosstalk/shared';
import type { ReactionKind } from '@crosstalk/shared';
import { ReactionChips } from './Reactions';

export type TurnCardProps = {
  seq: number;
  speakerId: SpeakerId;
  name: string;
  objective: string;
  modelId: string;
  text: string;
  state: 'completed' | 'streaming' | 'failed';
  /** Being read aloud right now. */
  speaking?: boolean;
  onCopy?: () => void;
  onPlayFrom?: () => void;
  /** Queue a Go deeper cue on this turn; the reason it can't is shown instead when given. */
  onDeeper?: () => void;
  deeperBlocked?: string | null;
  onBranch?: () => void;
  branchBlocked?: string | null;
  /** In a branch: a turn read from the original episode. */
  inherited?: boolean;
  /** Branches cut at this turn (splice marks). */
  splices?: { id: string; direction: string }[];
  /** Your reactions to this line. */
  reactions?: Partial<Record<ReactionKind, number>>;
  /** The co-host who laughed at this line, when it was a joke. */
  laughedBy?: string;
};

/** One spoken turn, landing from its speaker's side of the table. */
export function TurnCard(p: TurnCardProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', close); };
  }, [open]);

  return (
    <article ref={ref} className={`turn ${p.speakerId}${p.state === 'failed' ? ' failed' : ''}${p.speaking ? ' speaking' : ''}${p.inherited ? ' inherited' : ''}`} id={`turn-${p.seq}`}>
      <span className={`flag ${p.speakerId}`} aria-hidden="true">{p.speakerId}</span>
      <div className="card">
        <div className="card-head">
          <span className="nm">{p.name}</span>
          <span className="tag">Turn {p.seq} · {jobLabel(p.objective)}</span>
          {p.state === 'completed' && (
            <button className="menu-btn" aria-label={`Actions for turn ${p.seq}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>⋯</button>
          )}
        </div>
        <p className="say" dir="auto">
          {p.text}
          {p.state === 'streaming' && <span className="caret" aria-hidden="true" />}
        </p>
        <div className="card-foot">
          <span>{p.modelId}</span>
          <ReactionChips counts={p.reactions} />
          {p.laughedBy && <span className="laughed"><span aria-hidden="true">😄</span> {p.laughedBy} laughed</span>}
          <span>{p.state === 'streaming' ? 'streaming…' : p.state === 'failed' ? 'not saved' : p.inherited ? 'from the original' : 'saved'}</span>
        </div>
        {p.splices?.map(b => (
          <a key={b.id} className="splice" href={`#/studio/${b.id}/read`}><span aria-hidden="true">✂</span> Branched here: {b.direction} →</a>
        ))}
      </div>
      {open && (
        <div className="menu" role="menu">
          <button role="menuitem" disabled={!!p.deeperBlocked || !p.onDeeper} onClick={() => { setOpen(false); p.onDeeper?.(); }}>Go deeper on this<small>{p.deeperBlocked ?? 'The next host digs into it · uses a cue'}</small></button>
          <button role="menuitem" disabled={!!p.branchBlocked || !p.onBranch} onClick={() => { setOpen(false); p.onBranch?.(); }}>Branch from here<small>{p.branchBlocked ?? '4 new turns in your direction'}</small></button>
          <button role="menuitem" disabled={!p.onPlayFrom} onClick={() => { setOpen(false); p.onPlayFrom?.(); }}>Play from here<small>{p.onPlayFrom ? 'Read aloud from this turn' : "Speech isn't available in this browser"}</small></button>
          <button role="menuitem" onClick={() => { setOpen(false); p.onCopy?.(); }}>Copy text</button>
        </div>
      )}
    </article>
  );
}
