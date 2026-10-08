import { SCOUT_CATS, SCOUT_REGIONS, SENSITIVE_CATS, type Audience, type ScoutCat, type ScoutPrefs, type ScoutRegion } from '@crosstalk/shared';

type Props = { prefs: ScoutPrefs; onChange: (p: ScoutPrefs) => void; audience?: Audience };

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

/** Topics · Where · Rank by. The same chips on the Today tray and in Settings. */
export function ScoutPrefsEditor({ prefs, onChange, audience }: Props) {
  const sensitive = prefs.cats.some(c => (SENSITIVE_CATS as readonly string[]).includes(c));
  return (
    <div className="prefs">
      <div className="pref-row" role="group" aria-label="Topics">
        <span className="tag">Topics</span>
        {(Object.entries(SCOUT_CATS) as [ScoutCat, string][]).map(([k, l]) => (
          <button key={k} className="chip sm" aria-pressed={prefs.cats.includes(k)} onClick={() => onChange({ ...prefs, cats: toggle(prefs.cats, k) })}>{l}</button>
        ))}
      </div>
      <div className="pref-row" role="group" aria-label="Where">
        <span className="tag">Where</span>
        {(Object.entries(SCOUT_REGIONS) as [ScoutRegion, string][]).map(([k, l]) => (
          <button key={k} className="chip sm" aria-pressed={prefs.regions.includes(k)} onClick={() => onChange({ ...prefs, regions: toggle(prefs.regions, k) })}>
            {k === 'local' && prefs.place ? `Local · ${prefs.place}` : l}
          </button>
        ))}
      </div>
      <div className="pref-row" role="group" aria-label="Rank by">
        <span className="tag">Rank by</span>
        <div className="seg">
          {([['split', 'Most divided'], ['buzz', 'Most talked about']] as const).map(([k, l]) => (
            <button key={k} aria-pressed={prefs.rank === k} onClick={() => onChange({ ...prefs, rank: k })}>{l}</button>
          ))}
        </div>
      </div>
      {sensitive && <p className="hint sens">Politics and scandals stay balanced and sourced: both sides get their strongest case, accusations are reported as allegations, and private people are never named.{audience === 'kids' ? ' Hidden for the Kids audience.' : ''}</p>}
    </div>
  );
}
