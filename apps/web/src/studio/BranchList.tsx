import type { ConversationView } from '@crosstalk/shared';

const STATE: Record<string, string> = { idle: 'ready', generating: 'recording', paused: 'paused', completed: 'finished', cancelled: 'stopped', failed: 'failed' };

/** Where this conversation sits: the original it came from, and the branches cut from it. */
export function BranchList({ view }: { view: ConversationView }) {
  return <>
    {view.parent && (
      <div className="voice-row"><h3>Branched from</h3>
        <a className="branch-link" href={`#/studio/${view.parent.id}/read`}>← {view.parent.title}</a>
        <p className="hint">Cut at turn {view.branchSeq}: “{view.branchDirection}”</p>
      </div>
    )}
    <div className="voice-row"><h3>Branches of this episode <span className="counter">{view.branches.length}</span></h3>
      {view.branches.length ? (
        <ul className="branch-list">
          {view.branches.map(b => (
            <li key={b.id}><a href={`#/studio/${b.id}/read`}><span className="tag">✂ Turn {b.branchSeq} · {STATE[b.state]}</span>{b.direction}</a></li>
          ))}
        </ul>
      ) : <p className="hint">None yet.</p>}
      <p className="hint">To branch, open ⋯ on any finished turn and choose "Branch from here". A branch gets 4 new turns and never changes this episode.</p>
    </div>
  </>;
}
