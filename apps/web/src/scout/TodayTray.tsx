import { useEffect, useState } from 'react';
import { AUTOPILOT_REQUESTS, SCOUT_CATS, SCOUT_REGIONS, scoutPicks, splitLabel, type Audience, type Rules, type ScoutPrefs, type ScoutTopic } from '@crosstalk/shared';
import { api, type ScoutView } from '../api/client';
import { BriefBox } from './BriefBox';
import { ScoutPrefsEditor } from './ScoutPrefsEditor';

type Props = { rules: Rules; audience: Audience; selected: string | null; onPick: (t: ScoutTopic) => void; toast: (m: string) => void; real: boolean };

const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });

/** Today · from the Scout: what people are arguing about, each with a sourced brief. */
export function TodayTray({ rules, audience, selected, onPick, toast, real }: Props) {
  const [data, setData] = useState<ScoutView | null>(null);
  const [running, setRunning] = useState(false);
  useEffect(() => { api.scout().then(setData).catch(() => {}); }, []);
  if (!data) return null;

  const save = async (p: ScoutPrefs) => {
    setData({ ...data, prefs: p });
    try { setData(await api.setScoutPrefs(p)); } catch (e) { toast((e as Error).message); }
  };
  const runNow = async () => {
    setRunning(true);
    try { const v = await api.runScout(); setData(v); toast(v.status.lastRun?.state === 'ok' ? 'Fresh topics are in' : v.status.lastRun?.error ?? 'The Scout came back empty'); }
    catch (e) { toast((e as Error).message); }
    finally { setRunning(false); }
  };

  const { prefs, status, topics } = data;
  const picks = scoutPicks(topics, prefs, audience, rules).slice(0, 6);
  const last = status.lastRun;
  const [h, m] = status.time.split(':').map(Number);
  const at = new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <section className="today" aria-label="Today's topics">
      <div className="today-head">
        <div><span className="tag">Today · from the Scout{real ? '' : ' · sample topics'}</span><h2>What people are arguing about</h2></div>
        <label className="switch"><input type="checkbox" checked={prefs.autopilot} onChange={e => save({ ...prefs, autopilot: e.target.checked })} /> Autopilot</label>
      </div>
      <ScoutPrefsEditor prefs={prefs} onChange={save} audience={audience} allowPolitics={rules.allowPolitics} />
      <p className="hint">
        {prefs.rank === 'buzz' ? 'Ranked by how much people are talking about it.' : 'Ranked by how divided people are.'}{' '}
        The Scout looks every day at {at}{last ? `; last looked ${when(last.startedAt)}` : ''}.{' '}
        {prefs.autopilot ? `Autopilot runs the top pick as a Friendly Debate, with Iris, once a day (about ${AUTOPILOT_REQUESTS} requests).` : 'Turn on Autopilot to have the top pick ready as an episode each morning.'}
      </p>
      {last?.state === 'failed' && <p className="hint">Last run didn't finish: {last.error}</p>}
      {last?.sourcesFailed.length ? <p className="hint">Couldn't reach {last.sourcesFailed.join(', ')} last time; the others still counted.</p> : null}
      {last?.autopilotConversationId && <p className="hint">Autopilot made today's episode: <a href={`#/studio/${last.autopilotConversationId}/watch`}>open it</a>.</p>}
      {last?.autopilotNote && <p className="hint">Autopilot: {last.autopilotNote}</p>}
      {!topics.length ? <p className="empty-stage tray-empty">No topics yet. The Scout looks at {at}, or press Run Scout now.</p>
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
                <details className="brief"><summary>Brief · {t.bullets.length} points</summary><BriefBox brief={t} /></details>
                <button className="btn sm" aria-pressed={selected === t.id} onClick={() => onPick(t)}>{selected === t.id ? 'Selected' : 'Discuss this'}</button>
              </article>
            ))}
          </div>
        )}
      <div className="dock-row">
        <button className="btn sm ghost" disabled={running || status.running} onClick={runNow}>{running || status.running ? 'Looking…' : 'Run Scout now'}</button>
        <span className="hint">{real ? 'Reads Hacker News, Wikipedia and your RSS feeds, then uses 1 request to rank and brief.' : 'Mock mode reads saved sample stories; no network, no requests.'}</span>
      </div>
    </section>
  );
}
