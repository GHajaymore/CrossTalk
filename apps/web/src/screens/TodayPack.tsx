import { useEffect, useState } from 'react';
import { episodeLabel, type AppConfig, type ConversationView } from '@crosstalk/shared';
import { api, type ConversationSummary } from '../api/client';
import { makePoster, posterName } from '../lib/poster';
import { ClipTile, ImageTile, PostTile } from '../studio/EpisodeKit';
import { Footer } from './Footer';

/** Where you post, each a link to its own upload page. You post there yourself; nothing is posted from here. */
const PLACES = [
  { key: 'shorts', label: 'YouTube Shorts', url: 'https://www.youtube.com/upload' },
  { key: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/upload' },
  { key: 'reels', label: 'Instagram Reels', url: 'https://www.instagram.com/' },
] as const;

const doneKey = (id: string) => `ct_posted_${id}`;
const readDone = (id: string): string[] => { try { return JSON.parse(localStorage.getItem(doneKey(id)) ?? '[]') as string[]; } catch { return []; } };

/**
 * Today's pack: one screen with everything for today's post, from Autopilot's episode (or your latest
 * finished one): the clip, the poster, and the words for each platform. You download, paste and post,
 * about two minutes; nothing posts by itself.
 */
export function TodayPack({ config, toast }: { config: AppConfig | null; toast: (m: string) => void }) {
  const [list, setList] = useState<ConversationSummary[] | null>(null);
  const [autoId, setAutoId] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [view, setView] = useState<ConversationView | null>(null);
  const [posted, setPosted] = useState<string[]>([]);

  useEffect(() => {
    void Promise.all([api.list().catch(() => [] as ConversationSummary[]), api.scout().catch(() => null)]).then(([all, scout]) => {
      const ready = all.filter(c => c.run?.state === 'completed' && c.artist?.state === 'done')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 10);
      setList(ready);
      const auto = scout?.status.lastRun?.autopilotConversationId ?? null;
      const pick = auto && ready.some(c => c.id === auto) ? auto : ready[0]?.id ?? null;
      setAutoId(auto); setId(pick);
    });
  }, []);
  useEffect(() => {
    setView(null);
    if (!id) return;
    setPosted(readDone(id));
    api.get(id).then(setView).catch(() => toast("Couldn't open that episode."));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mark = (k: string) => {
    if (!id) return;
    const next = posted.includes(k) ? posted.filter(x => x !== k) : [...posted, k];
    setPosted(next);
    try { localStorage.setItem(doneKey(id), JSON.stringify(next)); } catch { /* this visit only */ }
  };
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="page today-pack">
      <div className="hero">
        <div className="tag">Today's pack · {today}</div>
        <h1>Everything for today's post, ready.</h1>
        <p>Make the clip, copy the words, post. About two minutes. Nothing posts by itself.</p>
      </div>

      {!list ? <p className="hint">Loading…</p> : !list.length ? (
        <div className="empty-stage">No finished episode yet. Record one on <a href="#/create">Create</a>, or turn on Autopilot (Create → 📰 In the news) to have one ready every morning.</div>
      ) : (
        <>
          <section className="sec pack-episode">
            <label className="fld"><span className="tag">{id === autoId ? "Autopilot's episode" : 'Episode'}</span>
              <select value={id ?? ''} onChange={e => setId(e.target.value)}>
                {list.map(c => <option key={c.id} value={c.id}>{episodeLabel(c.episode)} · {c.topic}{c.id === autoId ? ' · Autopilot' : ''}</option>)}
              </select>
            </label>
            {view && <p className="hint">“{view.artist?.artTitle}” by Iris · {view.turns.length} turns · <a href={`#/studio/${view.id}/watch`}>Watch it first</a></p>}
          </section>

          {!view ? <p className="hint">Opening the episode…</p> : (
            <ol className="pack-steps">
              <li>
                <h2><span className="pack-n">1</span>The clip</h2>
                <p className="hint">A 30–45 second vertical video. It records on this device while you watch, then download or share it.</p>
                <div className="kit-grid"><ClipTile c={view} toast={toast} photos={!!config?.portraits} /></div>
              </li>
              <li>
                <h2><span className="pack-n">2</span>The poster</h2>
                <p className="hint">For Instagram, a story, or the podcast cover.</p>
                <div className="kit-grid"><ImageTile c={view} toast={toast} title="Episode poster" button="Make poster" alt="Poster for" make={makePoster} name={posterName}
                  blurb="The question, the hosts, Iris's art and where each landed, in one image." /></div>
              </li>
              <li>
                <h2><span className="pack-n">3</span>The words</h2>
                <p className="hint">Pick the platform, copy, paste. Each one says plainly it's made with AI.</p>
                <div className="kit-grid"><PostTile c={view} toast={toast} /></div>
              </li>
              <li>
                <h2><span className="pack-n">4</span>Post it</h2>
                <p className="hint">Open each one, upload the clip, paste the words, and tick the platform's own AI-content label. Tick here when it's up.</p>
                <ul className="pack-places">
                  {PLACES.map(p => (
                    <li key={p.key}>
                      <a className="btn sm" href={p.url} target="_blank" rel="noopener noreferrer">Open {p.label} ↗</a>
                      <label className="check"><input type="checkbox" checked={posted.includes(p.key)} onChange={() => mark(p.key)} /> Posted</label>
                    </li>
                  ))}
                </ul>
                {posted.length === PLACES.length && <p className="hint" role="status">✓ All posted for today. See you tomorrow.</p>}
              </li>
            </ol>
          )}
        </>
      )}
      <Footer config={config} />
    </div>
  );
}
