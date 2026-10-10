import { useEffect, useState } from 'react';
import { AUTOPILOT_REQUESTS, SCOUT_CATS, SCOUT_REGIONS, scoutPicks, splitLabel, type Audience, type Rules, type ScoutPrefs, type ScoutTopic } from '@crosstalk/shared';
import { api, type ScoutView } from '../api/client';
import { BriefBox } from './BriefBox';
import { ScoutPrefsEditor } from './ScoutPrefsEditor';

type Props = { rules: Rules; audience: Audience; selected: string | null; onPick: (t: ScoutTopic) => void; toast: (m: string) => void; real: boolean };

/** How many outlets and places a brief draws on, so you can see its balance at a glance. */
const perspectives = (t: ScoutTopic) => {
  const outlets = new Set(t.bullets.map(b => b.source)).size;
  const places = new Set(t.bullets.map(b => b.home).filter(Boolean)).size;
  return `${outlets} ${outlets === 1 ? 'source' : 'sources'}${places > 1 ? ` · ${places} regions` : ''}`;
};

const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });

/** Today · from the Scout: what people are arguing about, each with a sourced brief. */
export function TodayTray({ rules, audience, selected, onPick, toast, real }: Props) {
  const [data, setData] = useState<ScoutView | null>(null);
  const [running, setRunning] = useState(false);
  // Five at first; Show more reveals the rest of this run's topics, with no new request.
  const [shown, setShown] = useState(5);
  useEffect(() => { api.scout().then(setData).catch(() => {}); }, []);
  if (!data) return null;

  const save = async (p: ScoutPrefs) => {
    const before = data.prefs;
    setData({ ...data, prefs: p });
    // A refused change (say, a private link) puts the old settings back.
    try { setData(await api.setScoutPrefs(p)); } catch (e) { setData({ ...data, prefs: before }); toast((e as Error).message); throw e; }
  };
  const runNow = async () => {
    setRunning(true);
    try { const v = await api.runScout(); setData(v); setShown(5); toast(v.status.lastRun?.state === 'ok' ? 'Fresh topics are in' : v.status.lastRun?.error ?? 'The Scout came back empty'); }
    catch (e) { toast((e as Error).message); }
    finally { setRunning(false); }
  };

  const { prefs, status, topics } = data;
  const all = scoutPicks(topics, prefs, audience, rules);
  const picks = all.slice(0, shown);
  const wait = status.refreshAfter ? Math.max(1, Math.ceil((new Date(status.refreshAfter).getTime() - Date.now()) / 60_000)) : 0;
  const last = status.lastRun;
  const ago = last ? Math.round((Date.now() - new Date(last.startedAt).getTime()) / 60_000) : null;
  const [h, m] = status.time.split(':').map(Number);
  const at = new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <section className="today" aria-label="Today's topics">
      <div className="today-head">
        <div><span className="tag">Today · from the Scout{real ? '' : ' · sample topics'}</span><h2>What people are arguing about</h2></div>
        <label className="switch"><input type="checkbox" checked={prefs.autopilot} onChange={e => save({ ...prefs, autopilot: e.target.checked })} /> Autopilot</label>
      </div>
      {/* Where the Scout looks is a setting, not a step: folded away until you want it. */}
      <details className="scout-prefs">
        <summary>Customise the Scout · themes, places and sources</summary>
        <ScoutPrefsEditor prefs={prefs} onChange={save} audience={audience} allowPolitics={rules.allowPolitics} />
        <p className="hint">
          {prefs.rank === 'buzz' ? 'Ranked by how much people are talking about it.' : 'Ranked by how divided people are.'}{' '}
          The Scout looks every day at {at}{last ? `; last looked ${when(last.startedAt)}` : ''}.{' '}
          {prefs.autopilot ? `Autopilot runs the top pick as a Friendly Debate, with Iris, once a day (about ${AUTOPILOT_REQUESTS} requests).` : 'Turn on Autopilot to have the top pick ready as an episode each morning.'}
        </p>
      </details>
      {last?.state === 'failed' && <p className="hint">Last run didn't finish: {last.error}</p>}
      {last?.sourcesFailed.length ? <p className="hint">Couldn't reach {last.sourcesFailed.join(', ')} last time; the others still counted.</p> : null}
      {last?.autopilotConversationId && <p className="hint">Autopilot made today's episode: <a href={`#/studio/${last.autopilotConversationId}/watch`}>open it</a>.</p>}
      {last?.autopilotNote && <p className="hint">Autopilot: {last.autopilotNote}</p>}
      {!topics.length ? <p className="empty-stage tray-empty">No topics yet. The Scout looks at {at}, or press Refresh topics.</p>
        : !picks.length ? <p className="empty-stage tray-empty">No topics match your choices. Turn on more topics or regions.</p>
        : (
          <div className="tray">
            {picks.map(t => (
              <article key={t.id} className={`topic-card${selected === t.id ? ' sel' : ''}`}>
                <span className="tag cat">{t.pinned ? '📌 ' : ''}{SCOUT_CATS[t.category]} · {t.region === 'local' && prefs.place ? prefs.place : SCOUT_REGIONS[t.region]}</span>
                <div className="split">
                  <span className="sbar" aria-hidden="true"><i style={{ width: `${prefs.rank === 'buzz' ? t.buzz : t.split}%` }} /></span>
                  <span className="tag">{prefs.rank === 'buzz' ? `Talked about · ${t.buzz}` : `${splitLabel(t.split)} · ${t.split}–${100 - t.split}`}</span>
                </div>
                <h3>{t.question}</h3>
                <div className="srcs">{t.sources.map(s => <span key={s} className="src">{s}</span>)}</div>
                <span className="tag perspectives">{perspectives(t)}</span>
                <details className="brief"><summary>Brief · {t.bullets.length} points</summary><BriefBox brief={t} /></details>
                <button className="btn sm" aria-pressed={selected === t.id} onClick={() => onPick(t)}>{selected === t.id ? 'Selected' : 'Discuss this'}</button>
              </article>
            ))}
          </div>
        )}
      <div className="dock-row">
        {all.length > shown && <button className="btn sm" onClick={() => setShown(n => n + 5)}>Show more · {all.length - shown} left</button>}
        <button className="btn sm ghost" disabled={running || status.running || wait > 0} onClick={runNow}>
          {running || status.running ? 'Looking…' : wait > 0 ? `↻ Refresh in ${wait} min` : '↻ Refresh topics'}
        </button>
        <span className="hint">
          {ago != null ? `Last refreshed ${ago < 1 ? 'just now' : ago < 60 ? `${ago} min ago` : when(last!.startedAt)}. ` : ''}
          {real ? 'Refresh reads your sources again and uses 1 free request (at most every 30 min); Show more is free.' : 'Mock mode reads saved sample stories; no network, no requests.'}
        </span>
      </div>
    </section>
  );
}
