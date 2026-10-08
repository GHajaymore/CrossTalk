import { useState } from 'react';
import { CUE_LIMIT } from '@crosstalk/shared';

type Tab = 'cue' | 'voices' | 'branches';

/** Cue · Voices · Branches. In Milestone 1 these show what's coming, clearly marked. */
export function SidePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('cue');
  return (
    <aside className={`panel${open ? ' open' : ''}`} aria-label="Studio controls">
      <div className="tabs" role="tablist">
        {([['cue', 'Cue'], ['voices', 'Voices'], ['branches', 'Branches']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="panel-body">
        {tab === 'cue' && <>
          <div className="voice-row"><h3>Challenge a claim <span className="soon">Milestone 4</span></h3>
            <p className="hint">A short objection. The next speaker must answer it.</p>
            <textarea disabled placeholder="e.g. Doesn't this only work for office jobs?" />
            <div className="dock-row"><button className="btn sm" disabled>Queue challenge</button><span className="counter">{CUE_LIMIT} of {CUE_LIMIT} left</span></div>
          </div>
          <div className="voice-row"><h3>Go deeper <span className="soon">Milestone 4</span></h3>
            <p className="hint">Pick a turn; the next speaker expands it instead of moving on.</p>
            <button className="btn sm" disabled>Queue go deeper</button>
          </div>
          <div className="voice-row"><h3>Take the mic <span className="soon">Milestone 4</span></h3>
            <p className="hint">Say your piece on air as a guest. It takes the guest seat in the middle and the next host responds to it.</p>
            <button className="btn sm" disabled>Go on air</button>
          </div>
          <div className="voice-row"><h3>Temperature <span className="soon">Milestone 4</span></h3>
            <p className="hint">Turn it up or cool it down from the next turn. Uses one cue.</p>
            <div className="dock-row"><button className="btn sm" disabled>Cool it down</button><button className="btn sm" disabled>Turn it up</button></div>
          </div>
        </>}
        {tab === 'voices' && <p className="hint">Voice per host, with preview, arrives in Milestone 3. The most natural-sounding voices your device offers will be picked first.</p>}
        {tab === 'branches' && <p className="hint">Branch from any finished turn with its ⋯ menu, from Milestone 4. Branches get 4 new turns and never change the original.</p>}
        {open && <button className="btn ghost sm" onClick={onClose}>Close</button>}
      </div>
    </aside>
  );
}
