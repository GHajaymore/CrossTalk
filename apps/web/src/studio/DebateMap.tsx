import { sentencesOf, type SpeakerId, type Turn } from '@crosstalk/shared';

// The beats a debate organiser looks for, in the order a listener needs them, from each turn's job.
const BEATS: { jobs: string[]; label: string }[] = [
  { jobs: ['Catch', 'Push back'], label: 'Strongest challenge' },
  { jobs: ['Rethink'], label: 'What changed a mind' },
  { jobs: ['Common ground'], label: 'Where they agree' },
  { jobs: ['Still unsure'], label: 'Still open' },
  { jobs: ['Takeaway'], label: 'Takeaway' },
];

/** A line's point: its first sentence or two, at most about 30 words. */
export function pointOf(text: string) {
  const s = sentencesOf(text);
  const two = s.slice(0, 2).join(' ');
  const pick = two.split(/\s+/).length <= 30 ? two : s[0] ?? text;
  const words = pick.split(/\s+/);
  return words.length > 32 ? `${words.slice(0, 30).join(' ')}…` : pick;
}

/** The beats found in an episode (each from its own turn), or fewer than three when it doesn't have the shape. */
export function debateBeats(turns: Pick<Turn, 'seq' | 'speakerId' | 'objective' | 'text'>[]) {
  return BEATS.flatMap(b => {
    const t = b.jobs.map(j => turns.find(x => x.objective === j)).find(Boolean);
    return t ? [{ label: b.label, seq: t.seq, speakerId: t.speakerId, point: pointOf(t.text) }] : [];
  });
}

/** "The debate in a minute": the arc of the episode in five lines, each one tap from its turn. */
export function DebateMap({ turns, names }: { turns: Turn[]; names: Record<SpeakerId, string> }) {
  const beats = debateBeats(turns);
  if (beats.length < 3) return null;
  return (
    <details className="debate-map" open>
      <summary><span className="tag">The debate in a minute</span></summary>
      <ol>
        {beats.map(b => (
          <li key={b.label}>
            <span className="dm-label">{b.label}</span>
            <span className="dm-point">
              <b className={`dm-who ${b.speakerId}`}>{names[b.speakerId]}:</b> {b.point}{' '}
              <a href={`#turn-${b.seq}`} onClick={e => { e.preventDefault(); document.getElementById(`turn-${b.seq}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>turn {b.seq}</a>
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
