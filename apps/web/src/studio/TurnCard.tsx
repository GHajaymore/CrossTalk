import { useEffect, useRef, useState } from 'react';
import type { SpeakerId } from '@crosstalk/shared';

export type TurnCardProps = {
  seq: number;
  speakerId: SpeakerId;
  name: string;
  objective: string;
  modelId: string;
  text: string;
  state: 'completed' | 'streaming' | 'failed';
  onCopy?: () => void;
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
    <article ref={ref} className={`turn ${p.speakerId} ${p.state === 'failed' ? 'failed' : ''}`} id={`turn-${p.seq}`}>
      <span className={`flag ${p.speakerId}`} aria-hidden="true">{p.speakerId}</span>
      <div className="card">
        <div className="card-head">
          <span className="nm">{p.name}</span>
          <span className="tag">Turn {p.seq} · {p.objective}</span>
          {p.state === 'completed' && (
            <button className="menu-btn" aria-label={`Actions for turn ${p.seq}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>⋯</button>
          )}
        </div>
        <p className="say">
          {p.text}
          {p.state === 'streaming' && <span className="caret" aria-hidden="true" />}
        </p>
        <div className="card-foot">
          <span>{p.modelId}</span>
          <span>{p.state === 'streaming' ? 'streaming…' : p.state === 'failed' ? 'not saved' : 'saved'}</span>
        </div>
      </div>
      {open && (
        <div className="menu" role="menu">
          <button role="menuitem" disabled>Go deeper on this<small>Arrives in Milestone 4</small></button>
          <button role="menuitem" disabled>Branch from here<small>Arrives in Milestone 4</small></button>
          <button role="menuitem" disabled>Play from here<small>Arrives in Milestone 3</small></button>
          <button role="menuitem" onClick={() => { setOpen(false); p.onCopy?.(); }}>Copy text</button>
        </div>
      )}
    </article>
  );
}
