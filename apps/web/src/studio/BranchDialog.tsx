import { useEffect, useRef, useState } from 'react';
import { CUE_TEXT_MAX } from '@crosstalk/shared';

const IDEAS = ['Take the other side', 'Make it about kids', 'Fast-forward ten years', 'What would go wrong?'];

type Props = { seq: number; who: string; onClose: () => void; onCreate: (direction: string) => Promise<void> };

/** "Branch from turn N": a new direction, then a child episode with 4 new turns. */
export function BranchDialog({ seq, who, onClose, onCreate }: Props) {
  const [direction, setDirection] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    box.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [onClose]);
  const go = async () => { setBusy(true); try { await onCreate(direction.trim()); } finally { setBusy(false); } };
  return (
    <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="branch-title">
        <span className="tag">✂ Branch</span>
        <h2 id="branch-title">Branch from turn {seq}</h2>
        <p className="hint">Keeps everything up to {who}'s turn {seq}, then the hosts take 4 new turns in your direction. This episode stays exactly as it is.</p>
        <textarea ref={box} value={direction} maxLength={CUE_TEXT_MAX} onChange={e => setDirection(e.target.value)} placeholder="Where should it go? e.g. What if it were a nine-day fortnight instead?" />
        <div className="chips">{IDEAS.map(i => <button key={i} className="chip sm" onClick={() => setDirection(i)}>{i}</button>)}</div>
        <div className="dock-row">
          <button className="btn primary" disabled={busy || !direction.trim()} onClick={go}>{busy ? 'Branching…' : 'Create branch'}</button>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
