import { jobFor, MAX_TURNS, speakerFor, type Speakers, type Turn } from '@crosstalk/shared';

/** Eight pips across the top, one per turn, labelled with the turn's job. */
export function TurnRail({ turns, liveSeq, failedSeq, speakers }: { turns: Turn[]; liveSeq: number | null; failedSeq: number | null; speakers: Speakers }) {
  const done = new Set(turns.map(t => t.seq));
  return (
    <div className="rail" style={{ ['--n' as string]: MAX_TURNS }} aria-hidden="true">
      {Array.from({ length: MAX_TURNS }, (_, i) => i + 1).map(s => {
        const cls = [speakerFor(s), done.has(s) ? 'done' : '', liveSeq === s ? 'live' : '', failedSeq === s ? 'fail' : ''].join(' ');
        return (
          <div key={s} className={`pip ${cls}`} title={`Turn ${s}: ${speakers[speakerFor(s)].name}, ${jobFor(s)}`}>
            <div className="bar" />
            <span className="tag">{s} {jobFor(s)}</span>
          </div>
        );
      })}
    </div>
  );
}
