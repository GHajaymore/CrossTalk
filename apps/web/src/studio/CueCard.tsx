import { TEMPERATURES, type Intervention } from '@crosstalk/shared';

export const CUE_LABEL: Record<Intervention['kind'], string> = { challenge: 'Challenge', deeper: 'Go deeper', temp: 'Temperature', guest: 'On the mic' };

/** A listener's note passed across the desk, sitting on the centre line. A guest gets the gold guest seat. */
export function CueCard({ cue, onCancel }: { cue: Intervention; onCancel?: () => void }) {
  const queued = cue.status === 'queued';
  const body = cue.kind === 'temp' && cue.fromTemp && cue.toTemp ? `${TEMPERATURES[cue.fromTemp].label} → ${TEMPERATURES[cue.toTemp].label}`
    : cue.kind === 'deeper' ? `Back to turn ${cue.targetSeq}, and further in.`
    : cue.text;
  return (
    <div className={`cue ${cue.kind}${queued ? ' queued' : ''}`}>
      <div className="tag">{cue.kind === 'guest' ? 'Guest · you' : 'Your cue'} · {CUE_LABEL[cue.kind]} · {queued ? 'lands' : 'landed'} before turn {cue.appliesBeforeSeq}</div>
      {body && <p>{cue.kind === 'guest' ? `“${body}”` : body}</p>}
      {queued && onCancel && <button className="link-btn" onClick={onCancel}>Take it back</button>}
    </div>
  );
}
