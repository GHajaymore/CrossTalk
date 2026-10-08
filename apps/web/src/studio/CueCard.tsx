import type { Intervention } from '@crosstalk/shared';

const LABEL: Record<Intervention['kind'], string> = { challenge: 'Challenge', deeper: 'Go deeper', temp: 'Temperature', guest: 'On the mic' };

/** A listener's note passed across the desk, sitting on the centre line. Used from Milestone 4. */
export function CueCard({ cue }: { cue: Intervention }) {
  const queued = cue.status === 'queued';
  return (
    <div className={`cue${queued ? ' queued' : ''}`}>
      <div className="tag">Your cue · {LABEL[cue.kind]} · {queued ? 'Lands' : 'Given'} before turn {cue.appliesBeforeSeq}</div>
      {cue.text && <p>{cue.text}</p>}
    </div>
  );
}
