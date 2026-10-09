import { useEffect, useState } from 'react';
import { StorageBanner } from '../lib/Banners';
import { artworkSvg, episodeLabel, LANGUAGES, MODES, TITLE_MAX, turnTotal, type AppConfig } from '@crosstalk/shared';
import { api, type ConversationSummary } from '../api/client';
import { sketchSrc } from '../studio/ArtistCard';
import { Footer } from './Footer';
import { RecapPanel } from './Recap';

const STATUS: Record<string, string> = { idle: 'ready', generating: 'recording', paused: 'paused', completed: 'finished', cancelled: 'stopped', failed: 'failed' };
const when = (iso: string) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Every saved episode, each with its branches nested underneath. Open, rename, export or delete. */
export function Episodes({ config, toast }: { config: AppConfig | null; toast: (m: string) => void }) {
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [q, setQ] = useState('');
  const load = () => api.list().then(setItems).catch(() => setItems([]));
  useEffect(() => { void load(); }, []);

  const all = items ?? [];
  const match = (c: ConversationSummary) => !q.trim() || `${c.title} ${c.topic} ${c.branchDirection ?? ''}`.toLowerCase().includes(q.trim().toLowerCase());
  const kids = new Map<string, ConversationSummary[]>();
  for (const c of all) if (c.parentId) kids.set(c.parentId, [...(kids.get(c.parentId) ?? []), c]);
  const childrenOf = (id: string) => kids.get(id) ?? [];
  // Show a branch under its original; a match anywhere in a family shows the whole family.
  const family = (c: ConversationSummary): boolean => match(c) || childrenOf(c.id).some(family);
  const roots = all.filter(c => !c.parentId || !all.some(p => p.id === c.parentId)).filter(family);

  const row = (c: ConversationSummary, depth: number): JSX.Element => (
    <li key={c.id}>
      <EpisodeRow c={c} depth={depth} onChanged={load} toast={toast} />
      {childrenOf(c.id).length > 0 && <ul className="lib-list nested">{childrenOf(c.id).map(b => row(b, depth + 1))}</ul>}
    </li>
  );

  return (
    <div className="page">
      <StorageBanner config={config} />
      <div><h1>Episodes</h1><p className="hint">Every episode you've made, with its branches underneath. Iris's art is also in her gallery on the <a href="#/iris">Iris</a> page.</p></div>
      {items && <RecapPanel items={items} photos={!!config?.portraits} toast={toast} />}
      {items && items.length > 3 && (
        <label className="fld lib-search"><span className="sr-only">Search episodes</span>
          <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search titles, topics and branch directions" />
        </label>
      )}
      {!items ? <p className="hint">Loading…</p>
        : !items.length ? (
          <div className="first-run">
            <span className="brand-mark big" aria-hidden="true"><i /><i /></span>
            <h2>Your shelf is empty</h2>
            <p className="hint">Pick a topic, press record, and two hosts talk it through in about a minute. Iris listens from the booth and paints the moment that stayed with her. Every episode lands here.</p>
            <a className="btn primary" href="#/create">● Make your first episode</a>
          </div>
        )
        : !roots.length ? <p className="hint">Nothing matches “{q}”.</p>
        : <ul className="lib-list">{roots.map(c => row(c, 0))}</ul>}
      <Footer config={config} />
    </div>
  );
}

function EpisodeRow({ c, depth, onChanged, toast }: { c: ConversationSummary; depth: number; onChanged: () => void; toast: (m: string) => void }) {
  const [mode, setMode] = useState<'view' | 'rename' | 'delete'>('view');
  const [title, setTitle] = useState(c.title);
  const [busy, setBusy] = useState(false);
  const st = c.run?.state ?? 'idle';

  const rename = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { await api.rename(c.id, title); setMode('view'); toast('Renamed'); onChanged(); } catch (err) { toast((err as Error).message); } finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await api.remove(c.id); toast('Deleted'); onChanged(); } catch (err) { toast((err as Error).message); setMode('view'); } finally { setBusy(false); }
  };

  return (
    <div className={`lib-item${depth ? ' branch' : ''}`}>
      <div className="lib-row">
        {c.artist?.sketchSvg
          ? <img className="thumb" src={sketchSrc(artworkSvg(c.artist)!)} alt="" />
          : <span className="thumb thumb-empty" aria-hidden="true">{depth ? '✂' : <small>{st === 'failed' ? 'No art: it didn\'t finish' : c.artist?.state === 'listening' ? 'Iris is drawing…' : c.artist?.state === 'failed' ? 'Iris couldn\'t draw this one' : st === 'completed' ? 'No art yet' : 'Art comes at the end'}</small>}</span>}
        <div style={{ minWidth: 0 }}>
          {mode === 'rename' ? (
            <form className="dock-row" onSubmit={rename}>
              <label className="sr-only" htmlFor={`t-${c.id}`}>New title</label>
              <input id={`t-${c.id}`} type="text" autoFocus maxLength={TITLE_MAX} value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setMode('view'); }} />
              <button className="btn sm primary" disabled={busy || !title.trim()}>Save</button>
              <button type="button" className="btn sm ghost" onClick={() => { setMode('view'); setTitle(c.title); }}>Cancel</button>
            </form>
          ) : (
            <a className="lib-title" href={`#/studio/${c.id}/read`}>{depth > 0 && <span className="lib-branch">✂ Turn {c.branchSeq} · </span>}{c.title}{c.round > 1 && <span className="lib-round">Round {c.round}</span>}</a>
          )}
          <div className="lib-meta">
            <span className={`status ${st}`}>{c.run?.stopReason === 'interrupted' ? 'interrupted' : STATUS[st]}</span>
            <span>{episodeLabel(c.episode)}</span>
            <span>{MODES[c.mode].label}</span>
            <span>{c.speakers.A.name} & {c.speakers.B.name}</span>
            {c.language && c.language !== 'en' && <span lang={c.language}>{LANGUAGES[c.language].native}</span>}
            <span>{c.turnCount} of {turnTotal(c)} turns</span>
            {c.branchCount > 0 && <span>{c.branchCount} branch{c.branchCount === 1 ? '' : 'es'}</span>}
            <span>{when(c.createdAt)}</span>
            {c.artist?.state === 'done' && <span>“{c.artist.artTitle}”</span>}
          </div>
          {st === 'failed' && c.run?.stopReason && c.run.stopReason !== 'interrupted' && (
            <p className="lib-why"><b>Why it stopped:</b> {c.run.stopReason} <a href={`#/studio/${c.id}/read`}>Open it to retry</a></p>
          )}
        </div>
      </div>
      {mode === 'delete' ? (
        <div className="lib-confirm" role="alertdialog" aria-label={`Delete ${c.title}?`}>
          <span>Delete “{c.title}”? Its turns, cues and Iris's sketch go too. This can't be undone.</span>
          <div className="dock-row">
            <button className="btn sm danger" autoFocus disabled={busy} onClick={remove}>Delete for good</button>
            <button className="btn sm ghost" onClick={() => setMode('view')}>Keep it</button>
          </div>
        </div>
      ) : mode === 'view' && (
        <div className="dock-row lib-actions">
          <a className="btn sm" href={`#/studio/${c.id}/read`}>Open</a>
          <button className="btn sm ghost" onClick={() => { setTitle(c.title); setMode('rename'); }}>Rename</button>
          {c.turnCount > 0 && <a className="btn sm ghost" href={`/api/conversations/${c.id}/export.md`} download>Export</a>}
          <button className="btn sm ghost danger" disabled={st === 'generating' || c.branchCount > 0}
            title={st === 'generating' ? 'Stop it first' : c.branchCount ? 'Delete its branches first: they read its turns' : undefined} onClick={() => setMode('delete')}>Delete</button>
        </div>
      )}
    </div>
  );
}
