import { useEffect, useState } from 'react';
import { artworkSvg, episodeLabel, SCOUT_CATS, SCOUT_REGIONS, turnTotal, type AppConfig, type Overview, type Rules } from '@crosstalk/shared';
import { api, type ConversationSummary, type ScoutView } from '../api/client';
import { sketchSrc } from '../studio/ArtistCard';
import { Footer } from './Footer';

type Tab = 'overview' | 'live' | 'publish' | 'topics' | 'rules';
const TABS: [Tab, string][] = [['overview', 'Overview'], ['live', 'Live control'], ['publish', 'Publishing'], ['topics', 'Topics'], ['rules', 'Rules']];
type Props = { config: AppConfig | null; tab: string | null; toast: (m: string) => void; refreshConfig: () => void };

/** Admin · only you. Overview, Live control with producer notes, Publishing approvals, Topics and Rules. */
export function ControlRoom({ config, tab: raw, toast, refreshConfig }: Props) {
  const tab: Tab = TABS.some(([k]) => k === raw) ? raw as Tab : 'overview';
  const [list, setList] = useState<ConversationSummary[]>([]);
  const load = () => api.list().then(setList).catch(() => {});
  useEffect(() => { void load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const on = () => refreshConfig();
    addEventListener('crosstalk:admin-locked', on);
    return () => removeEventListener('crosstalk:admin-locked', on);
  }, [refreshConfig]);

  if (!config) return <div className="empty-stage">Opening the Control room…</div>;
  if (config.admin.required && !config.admin.ok) return <AdminLock admin={config.admin} onOpen={refreshConfig} />;

  const active = list.filter(c => ['generating', 'paused', 'failed'].includes(c.run?.state ?? ''));
  const waiting = list.filter(c => c.run?.state === 'completed' && c.publish === 'waiting');
  const label = (k: Tab, l: string) => l + (k === 'live' && active.length ? ` · ${active.length}` : k === 'publish' && waiting.length ? ` · ${waiting.length}` : '');

  return (
    <div className="page control">
      <div><span className="tag">Admin · only you</span><h1>Control room</h1></div>
      <nav className="ctabs" aria-label="Control room">
        {TABS.map(([k, l]) => <a key={k} href={`#/control/${k}`} aria-current={tab === k ? 'page' : undefined}>{label(k, l)}</a>)}
      </nav>
      {tab === 'overview' && <OverviewTab />}
      {tab === 'live' && <LiveTab active={active} reload={load} toast={toast} />}
      {tab === 'publish' && <PublishTab list={list} reload={load} toast={toast} />}
      {tab === 'topics' && <TopicsTab toast={toast} />}
      {tab === 'rules' && <RulesTab config={config} toast={toast} refreshConfig={refreshConfig} />}
      <Footer config={config} />
    </div>
  );
}

function AdminLock({ admin, onOpen }: { admin: AppConfig['admin']; onOpen: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!admin.configured) return (
    <div className="page"><section className="sec">
      <span className="tag">Admin · only you</span><h1>Control room</h1>
      <p>The Control room is locked while CrossTalk is online, so visitors can't change your rules or approve episodes.</p>
      <p className="hint">To open it, add an <b>ADMIN_CODE</b> (any 8+ characters you'll remember) in Render: your crosstalk service → Environment → Add → Save. On your own computer the Control room is always open.</p>
    </section></div>
  );
  return (
    <div className="page"><form className="sec" onSubmit={async e => {
      e.preventDefault(); setError(null);
      try { await api.adminSignIn(code); onOpen(); } catch (err) { setError((err as Error).message); setCode(''); }
    }}>
      <span className="tag">Admin · only you</span><h1>Control room</h1>
      <label className="fld"><span>Admin code</span><input type="password" autoComplete="current-password" value={code} onChange={e => setCode(e.target.value)} /></label>
      {error && <p className="lock-error" role="alert">✕ {error}</p>}
      <div className="dock-row"><button className="btn primary" disabled={!code.trim()}>Open the Control room</button><span className="hint">This device stays signed in for 30 days.</span></div>
    </form></div>
  );
}

function OverviewTab() {
  const [o, setO] = useState<Overview | null>(null);
  useEffect(() => { api.overview().then(setO).catch(() => {}); }, []);
  if (!o) return <p className="hint">Loading…</p>;
  const max = Math.max(1, ...o.topics.map(t => t.count));
  const tiles: [string, string | number][] = [
    ['Episodes made', o.episodes], ['Finished', o.finishedPct == null ? '—' : `${o.finishedPct}%`], ['Cues per episode', o.cuesPerEpisode],
    ['Iris artworks', o.irisArtworks], ['Waiting for your OK', o.waiting], ['Requests today', `${o.requestsToday} / ${o.dailyLimit}`],
  ];
  return <>
    <div className="tiles">{tiles.map(([l, v]) => <div className="tile" key={l}><span className="tag">{l}</span><b>{v}</b></div>)}</div>
    <section className="sec"><h2>Topics</h2>
      {o.topics.length ? <div className="bars">{o.topics.map(t => (
        <div className="bar-row" key={t.category}><span>{t.category}</span><div className="bar-track" aria-hidden="true"><i style={{ width: `${(t.count / max) * 100}%` }} /></div><b>{t.count}</b></div>
      ))}</div> : <p className="hint">No episodes yet.</p>}
      <p className="hint">Episodes from the Scout count under their category. Listens and shares appear once episodes are published.</p>
    </section>
    <section className="sec"><h2>Recent admin actions</h2>
      {o.audit.length ? <ul className="audit">{o.audit.map((a, i) => <li key={i}><span className="tag">{new Date(a.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span> <b>{a.action}</b> · {a.detail}</li>)}</ul>
        : <p className="hint">Nothing yet. Every rule change, note, approval and topic change is written here.</p>}
    </section>
  </>;
}

function LiveTab({ active, reload, toast }: { active: ConversationSummary[]; reload: () => void; toast: (m: string) => void }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  /** Runs an action; true only if it worked, so a failed note keeps what you typed. */
  const act = async (fn: () => Promise<unknown>, done: string) => { try { await fn(); toast(done); reload(); return true; } catch (e) { toast((e as Error).message); return false; } };
  if (!active.length) return <p className="empty-stage">Nothing is on air. Start a discussion and you can pause it, stop it or send a producer note from here.</p>;
  return <>{active.map(c => (
    <section className="sec live-row" key={c.id}>
      <div className="lr-head">
        <div><b>{c.title}</b>
          <div className="lib-meta"><span className={`status ${c.run!.state}`}>{c.run!.state}</span><span>{c.format === 'live' ? '● Live show' : 'Recorded'}</span><span>turn {c.turnCount} of {turnTotal(c)}</span></div>
        </div>
        <div className="dock-row">
          <a className="btn sm" href={`#/studio/${c.id}/watch`}>Open</a>
          {c.run!.state === 'generating' && <button className="btn sm" disabled={c.run!.pauseRequested} onClick={() => act(() => api.pause(c.id), 'Pausing after this turn')}>Pause</button>}
          <button className="btn sm danger" onClick={() => act(() => api.stop(c.id), 'Stopped')}>Stop</button>
        </div>
      </div>
      <form className="dock-row" onSubmit={e => { e.preventDefault(); void act(() => api.note(c.id, notes[c.id] ?? ''), 'Producer note queued for the next turn').then(ok => { if (ok) setNotes(n => ({ ...n, [c.id]: '' })); }); }}>
        <label className="sr-only" htmlFor={`note-${c.id}`}>Producer note</label>
        <input id={`note-${c.id}`} type="text" maxLength={200} value={notes[c.id] ?? ''} onChange={e => setNotes(n => ({ ...n, [c.id]: e.target.value }))}
          placeholder="Producer note for the next speaker, e.g. Keep it to the facts we have" style={{ flex: 1, minWidth: 200 }} />
        <button className="btn sm" disabled={!(notes[c.id] ?? '').trim()}>Send note</button>
      </form>
      <p className="hint">Producer notes land before the next turn, show on the centre line as "Producer note", and don't use the listener's cues.</p>
    </section>
  ))}</>;
}

function PublishTab({ list, reload, toast }: { list: ConversationSummary[]; reload: () => void; toast: (m: string) => void }) {
  const done = list.filter(c => c.run?.state === 'completed');
  const set = async (id: string, state: 'approved' | 'held') => { try { await api.publish(id, state); toast(state === 'approved' ? 'Approved' : 'Held'); reload(); } catch (e) { toast((e as Error).message); } };
  if (!done.length) return <p className="empty-stage">No finished episodes yet.</p>;
  return <>
    <ul className="lib-list">{done.map(c => (
      <li className="lib-item" key={c.id}>
        <div className="lib-row">
          {c.artist?.sketchSvg ? <img className="thumb" src={sketchSrc(artworkSvg(c.artist)!)} alt="" /> : <span className="thumb thumb-empty" aria-hidden="true" />}
          <div style={{ minWidth: 0 }}>
            <a className="lib-title" href={`#/studio/${c.id}/read`}>{c.title}</a>
            <div className="lib-meta">
              <span className={`status ${c.publish === 'approved' ? 'completed' : c.publish === 'held' ? 'failed' : 'paused'}`}>{c.publish === 'approved' ? 'approved' : c.publish === 'held' ? 'held' : 'waiting'}</span>
              <span>{episodeLabel(c.episode)}</span>
              {c.artist?.state === 'done' && <span>“{c.artist.artTitle}”</span>}
            </div>
          </div>
        </div>
        <div className="dock-row lib-actions">
          <button className="btn sm" aria-pressed={c.publish === 'approved'} onClick={() => set(c.id, 'approved')}>Approve</button>
          <button className="btn sm ghost" aria-pressed={c.publish === 'held'} onClick={() => set(c.id, 'held')}>Hold</button>
        </div>
      </li>
    ))}</ul>
    <p className="hint">Approved episodes go to the podcast, social and shop queues once those are connected (later phases). Nothing is ever posted without approval here; held episodes never enter a queue.</p>
  </>;
}

function TopicsTab({ toast }: { toast: (m: string) => void }) {
  const [data, setData] = useState<ScoutView | null>(null);
  useEffect(() => { api.scout().then(setData).catch(() => {}); }, []);
  const flag = async (id: string, f: { pinned?: boolean; hidden?: boolean }) => { try { setData(await api.topicFlags(id, f)); } catch (e) { toast((e as Error).message); } };
  if (!data) return <p className="hint">Loading…</p>;
  if (!data.topics.length) return <p className="empty-stage">No Scout topics yet. Run the Scout from Create.</p>;
  return <>
    <p className="hint">Hide a topic to keep it out of the Today tray and Autopilot; pin one to put it first.</p>
    <ul className="lib-list">{data.topics.map(t => (
      <li className="lib-item" key={t.id}>
        <div style={{ minWidth: 0 }}>
          <div className="lib-title">{t.pinned ? '📌 ' : ''}{t.question}</div>
          <div className="lib-meta"><span>{SCOUT_CATS[t.category]} · {SCOUT_REGIONS[t.region]}</span><span>split {t.split}–{100 - t.split}</span><span>talked about {t.buzz}</span>{t.hidden && <span className="status failed">hidden</span>}</div>
        </div>
        <div className="dock-row lib-actions">
          <button className="btn sm ghost" onClick={() => flag(t.id, { pinned: !t.pinned })}>{t.pinned ? 'Unpin' : 'Pin'}</button>
          <button className="btn sm ghost" onClick={() => flag(t.id, { hidden: !t.hidden })}>{t.hidden ? 'Show' : 'Hide'}</button>
        </div>
      </li>
    ))}</ul>
  </>;
}

function RulesTab({ config, toast, refreshConfig }: { config: AppConfig; toast: (m: string) => void; refreshConfig: () => void }) {
  const [r, setR] = useState<Rules>(config.rules);
  const [blocked, setBlocked] = useState(config.rules.blocked.join('\n'));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.setRules({ ...r, blocked: blocked.split('\n').map(w => w.trim()).filter(Boolean) });
      setR(saved); setBlocked(saved.blocked.join('\n')); toast('Rules saved'); refreshConfig();
    } catch (e) { toast((e as Error).message); } finally { setSaving(false); }
  };
  return <>
    <section className="sec"><h2>Content</h2>
      <label className="fld"><span className="tag">Blocked words and topics (one per line)</span><textarea rows={4} value={blocked} onChange={e => setBlocked(e.target.value)} /></label>
      <p className="hint">A topic, cue or branch containing any of these can't go on air, and the Scout drops matching stories.</p>
      <label className="toggle"><input type="checkbox" checked={r.allowMature} onChange={e => setR({ ...r, allowMature: e.target.checked })} /> Allow the Mature audience</label>
      <label className="toggle"><input type="checkbox" checked={r.allowHeated} onChange={e => setR({ ...r, allowHeated: e.target.checked })} /> Allow Heated temperature</label>
      <label className="toggle"><input type="checkbox" checked={r.allowPolitics} onChange={e => setR({ ...r, allowPolitics: e.target.checked })} /> Allow Politics and Scandals in the Scout</label>
    </section>
    <section className="sec"><h2>Limits</h2>
      <label className="fld"><span className="tag">Listener cues per episode: {r.cueLimit}</span><input type="range" min={0} max={6} value={r.cueLimit} onChange={e => setR({ ...r, cueLimit: Number(e.target.value) })} /></label>
      <dl className="kv"><dt>Requests per day</dt><dd>{config.dailyLimit} (MAX_REQUESTS_PER_DAY in the server's settings)</dd><dt>Approval before publishing</dt><dd>Always on</dd></dl>
    </section>
    <div className="dock-row"><button className="btn primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save rules'}</button></div>
  </>;
}
