import { useEffect, useState } from 'react';
import {
  SCOUT_CATS, SCOUT_COUNTRIES, SCOUT_INTERESTS_MAX, SCOUT_MAX_FEEDS, SCOUT_REGIONS, SCOUT_SOURCES, SENSITIVE_CATS,
  type Audience, type ScoutCat, type ScoutCountry, type ScoutPrefs, type ScoutRegion, type ScoutSourceKey,
} from '@crosstalk/shared';

type Props = { prefs: ScoutPrefs; onChange: (p: ScoutPrefs) => void | Promise<void>; audience?: Audience; allowPolitics?: boolean };

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

/** Topics · Where · Sources · Rank by. The same chips on the Today tray and in Settings. */
export function ScoutPrefsEditor({ prefs, onChange, audience, allowPolitics = true }: Props) {
  const [interests, setInterests] = useState(prefs.interests);
  const [feed, setFeed] = useState('');
  useEffect(() => setInterests(prefs.interests), [prefs.interests]);
  const saveInterests = () => { if (interests.trim() !== prefs.interests) void onChange({ ...prefs, interests: interests.trim() }); };
  const addFeed = async () => {
    const url = feed.trim();
    if (!url || prefs.feeds.includes(url)) return;
    await onChange({ ...prefs, feeds: [...prefs.feeds, url] });
    setFeed('');
  };
  const sensitive = prefs.cats.some(c => (SENSITIVE_CATS as readonly string[]).includes(c));
  return (
    <div className="prefs">
      <div className="pref-row" role="group" aria-label="Topics">
        <span className="tag">Topics</span>
        {(Object.entries(SCOUT_CATS) as [ScoutCat, string][]).map(([k, l]) => (
          <button key={k} className="chip sm" aria-pressed={prefs.cats.includes(k)} onClick={() => onChange({ ...prefs, cats: toggle(prefs.cats, k) })}
            disabled={!allowPolitics && (SENSITIVE_CATS as readonly string[]).includes(k)} title={!allowPolitics && (SENSITIVE_CATS as readonly string[]).includes(k) ? 'Switched off in the Control room' : undefined}>{l}</button>
        ))}
      </div>
      <div className="pref-row">
        <label className="tag" htmlFor="scout-interests">Your interests</label>
        <input id="scout-interests" className="pref-input" type="text" maxLength={SCOUT_INTERESTS_MAX} value={interests} placeholder="e.g. golf, AI in healthcare, small business"
          onChange={e => setInterests(e.target.value)} onBlur={saveInterests} onKeyDown={e => { if (e.key === 'Enter') saveInterests(); }} />
      </div>
      <div className="pref-row" role="group" aria-label="Where">
        <span className="tag">Where</span>
        {(Object.entries(SCOUT_REGIONS) as [ScoutRegion, string][]).map(([k, l]) => (
          <button key={k} className="chip sm" aria-pressed={prefs.regions.includes(k)} onClick={() => onChange({ ...prefs, regions: toggle(prefs.regions, k) })}>
            {k === 'local' && prefs.place ? `Local · ${prefs.place}` : l}
          </button>
        ))}
      </div>
      <div className="pref-row" role="group" aria-label="Countries">
        <span className="tag">Countries</span>
        {prefs.countries.map(c => (
          <button key={c} className="chip sm" aria-pressed="true" aria-label={`Stop following ${SCOUT_COUNTRIES[c]}`}
            onClick={() => onChange({ ...prefs, countries: prefs.countries.filter(x => x !== c) })}>{SCOUT_COUNTRIES[c]} ×</button>
        ))}
        {prefs.countries.length < 8 && (
          <select aria-label="Follow a country" value="" onChange={e => { const c = e.target.value as ScoutCountry; if (c) onChange({ ...prefs, countries: [...prefs.countries, c] }); }}>
            <option value="">＋ Follow a country</option>
            {(Object.entries(SCOUT_COUNTRIES) as [ScoutCountry, string][]).filter(([k]) => !prefs.countries.includes(k)).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        )}
      </div>
      <div className="pref-row" role="group" aria-label="Sources">
        <span className="tag">Sources</span>
        {(Object.entries(SCOUT_SOURCES) as [ScoutSourceKey, string][]).map(([k, l]) => (
          <button key={k} className="chip sm" aria-pressed={prefs.sources.includes(k)}
            onClick={() => { const next = toggle(prefs.sources, k); if (next.length) onChange({ ...prefs, sources: next }); }}>{l}</button>
        ))}
      </div>
      <div className="pref-row" role="group" aria-label="Your news sites">
        <span className="tag">Your sites</span>
        {prefs.feeds.map(u => (
          <button key={u} className="chip sm" aria-pressed="true" aria-label={`Remove ${u}`} onClick={() => onChange({ ...prefs, feeds: prefs.feeds.filter(x => x !== u) })}>{new URL(u).host} ×</button>
        ))}
        {prefs.feeds.length < SCOUT_MAX_FEEDS && <>
          <input className="pref-input" type="url" value={feed} placeholder="Paste a news site's RSS link (https://…)" aria-label="RSS link of a news site to add"
            onChange={e => setFeed(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void addFeed(); }} />
          <button className="btn sm" disabled={!feed.trim()} onClick={() => void addFeed()}>Add</button>
        </>}
      </div>
      <p className="hint">Each region reads several outlets that lean different ways, and briefs cite more than one where they can.{prefs.sources.some(s => s === 'reddit' || s === 'social') ? ' Reddit, Bluesky and Mastodon are what people are saying: the brief reports them as opinions, never as facts.' : ''}</p>
      <div className="pref-row" role="group" aria-label="Rank by">
        <span className="tag">Rank by</span>
        <div className="seg">
          {([['split', 'Most divided'], ['buzz', 'Most talked about']] as const).map(([k, l]) => (
            <button key={k} aria-pressed={prefs.rank === k} onClick={() => onChange({ ...prefs, rank: k })}>{l}</button>
          ))}
        </div>
      </div>
      {!allowPolitics && <p className="hint">Politics and Scandals are switched off in the Control room.</p>}
      {sensitive && allowPolitics && <p className="hint sens">Politics and scandals stay balanced and sourced: both sides get their strongest case, accusations are reported as allegations, and private people are never named.{audience === 'kids' ? ' Hidden for the Kids audience.' : ''}</p>}
    </div>
  );
}
