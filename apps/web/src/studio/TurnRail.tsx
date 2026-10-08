import { jobIn, speakerFor, turnTotal, type Length, type Speakers, type Turn } from '@crosstalk/shared';

type Props = { turns: Turn[]; liveSeq: number | null; failedSeq: number | null; speakers: Speakers; branchSeq: number | null; length?: Length; cueSeqs: number[] };

/** One pip per turn across the top, labelled with the turn's job. A branch shows its cut and its 4 new turns. */
export function TurnRail({ turns, liveSeq, failedSeq, speakers, branchSeq, length, cueSeqs }: Props) {
  const done = new Set(turns.map(t => t.seq));
  const total = turnTotal({ branchSeq, length });
  const job = (s: number) => jobIn({ branchSeq, length }, s);
  return (
    <div className="rail" style={{ ['--n' as string]: total }} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => i + 1).map(s => {
        const cls = [speakerFor(s), done.has(s) ? 'done' : '', liveSeq === s ? 'live' : '', failedSeq === s ? 'fail' : '',
          branchSeq && s <= branchSeq ? 'inherited' : '', branchSeq === s ? 'cut' : '', cueSeqs.includes(s) ? 'cued' : ''].join(' ');
        return (
          <div key={s} className={`pip ${cls}`} title={`Turn ${s}: ${speakers[speakerFor(s)].name}, ${job(s)}${cueSeqs.includes(s) ? ' · your cue lands here' : ''}`}>
            <div className="bar" />
            <span className="tag"><b>{s}</b>{job(s)}</span>
          </div>
        );
      })}
    </div>
  );
}
