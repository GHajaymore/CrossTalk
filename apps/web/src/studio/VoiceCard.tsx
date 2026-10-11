/** Thirty-two bars of a voice print: each bar's own height and rhythm, so the wave never looks mechanical. */
const BARS = Array.from({ length: 32 }, (_, i) => ({ k: 0.35 + 0.65 * Math.abs(Math.sin(i * 2.17 + 0.6)), d: 0.52 + ((i * 37) % 11) / 20 }));

/**
 * A host as a voice, not a face: their initials in a ring, and a voice print that moves with what
 * they're actually saying (the set writes --lvl on the tile). Nothing here pretends to be a person.
 */
export function VoiceCard({ name, seat }: { name: string; seat: 'A' | 'B' }) {
  const ini = name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || seat;
  return (
    <div className={`voice-card seat-${seat}`} aria-hidden="true">
      <div className="vc-orb">
        <span className="vc-ring r1" /><span className="vc-ring r2" /><span className="vc-ring r3" />
        <span className="vc-ini">{ini}</span>
      </div>
      <div className="vc-wave">
        {BARS.map((b, i) => <i key={i} style={{ ['--k' as string]: b.k, animationDuration: `${b.d}s`, animationDelay: `-${(i % 7) / 10}s` }} />)}
      </div>
    </div>
  );
}
