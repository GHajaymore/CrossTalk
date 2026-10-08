import type { ScoutTopic } from '@crosstalk/shared';

/** The Scout's brief: what happened, each point linked to where the Scout read it. */
export function BriefBox({ brief, note }: { brief: ScoutTopic; note?: string }) {
  return (
    <div className="brief-box">
      <span className="tag brief-tag">Today's brief · the hosts treat only this as fact{note ? ` · ${note}` : ''}</span>
      <ul>
        {brief.bullets.map((b, i) => (
          <li key={i}>{b.text} <a className="src" href={b.url} target="_blank" rel="noopener noreferrer">{b.source}<span className="sr-only"> (opens in a new tab)</span></a></li>
        ))}
      </ul>
    </div>
  );
}
