import { useState, type ReactNode } from 'react';

type Tab = 'cue' | 'voices' | 'branches';

/** Cue · Voices · Branches, beside the Studio (a bottom sheet on phones). */
export function SidePanel({ open, onClose, cue, voices, branches }: { open: boolean; onClose: () => void; cue: ReactNode; voices: ReactNode; branches: ReactNode }) {
  const [tab, setTab] = useState<Tab>('cue');
  return (
    <aside className={`panel${open ? ' open' : ''}`} aria-label="Studio controls">
      <div className="tabs" role="tablist">
        {([['cue', 'Cue'], ['voices', 'Voices'], ['branches', 'Branches']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="panel-body" tabIndex={0} aria-label="Studio controls content">
        {tab === 'cue' && cue}
        {tab === 'voices' && voices}
        {tab === 'branches' && branches}
        {open && <button className="btn ghost sm" onClick={onClose}>Close</button>}
      </div>
    </aside>
  );
}
