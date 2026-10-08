import { useEffect, useState } from 'react';
import { artworkSvg, episodeLabel, type ConversationView } from '@crosstalk/shared';
import { api, type ConversationSummary } from '../api/client';
import { sketchSrc } from './ArtistCard';

// What this tab has already played, and the episode it should start playing when it opens.
// Per tab (sessionStorage), so a new visit starts fresh. Losing it only means a repeat, never an error.
const PLAYED = 'ct_played';
const AUTOPLAY = 'ct_autoplay';
const COUNTDOWN = 5;

function read(key: string) { try { return sessionStorage.getItem(key); } catch { return null; } }
function write(key: string, value: string | null) {
  try { if (value == null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value); } catch { /* storage blocked */ }
}
const played = (): string[] => { try { return JSON.parse(read(PLAYED) ?? '[]'); } catch { return []; } };
const markPlayed = (id: string) => write(PLAYED, JSON.stringify([...new Set([...played(), id])].slice(-200)));

/** True once, when this episode was opened by Up next and should start playing. */
export function takeAutoplay(id: string) {
  if (read(AUTOPLAY) !== id) return false;
  write(AUTOPLAY, null);
  return true;
}

/** The next round if it's ready, otherwise the newest finished episode this tab hasn't played. */
export async function pickUpNext(view: ConversationView, all: ConversationSummary[]) {
  const skip = new Set([...played(), view.id]);
  const ready = (c: ConversationSummary) => c.run?.state === 'completed' && c.turnCount > 0 && !skip.has(c.id);
  const round = view.nextRound && all.find(c => c.id === view.nextRound!.id);
  if (round && ready(round)) return round;
  return all.filter(c => !c.parentId && ready(c)).sort((a, b) => b.episode - a.episode)[0] ?? null;
}

/** When an episode plays through, the next one starts after a short countdown, like a podcast app. */
export function UpNext({ view, finished }: { view: ConversationView; finished: number }) {
  const [next, setNext] = useState<ConversationSummary | null>(null);
  const [left, setLeft] = useState(COUNTDOWN);
  const [cancelled, setCancelled] = useState(false);
  const [looked, setLooked] = useState(false);

  useEffect(() => {
    if (!finished) return;
    markPlayed(view.id);
    let gone = false;
    api.list().then(all => pickUpNext(view, all)).then(n => { if (!gone) { setNext(n); setLeft(COUNTDOWN); setCancelled(false); setLooked(true); } }).catch(() => {});
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const play = (c: ConversationSummary) => { write(AUTOPLAY, c.id); location.hash = `#/studio/${c.id}/listen`; };
  useEffect(() => {
    if (!next || cancelled) return;
    if (left <= 0) { play(next); return; }
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [next, left, cancelled]);

  if (cancelled) return null;
  if (!next) return looked ? <p className="hint up-next-end">That's everything on your shelf. Make a new episode, or start a round two.</p> : null;
  const art = artworkSvg(next.artist?.state === 'done' ? next.artist : null);
  const isRound = next.id === view.nextRound?.id;
  return (
    <section className="up-next" aria-label="Up next">
      {art ? <img src={sketchSrc(art)} alt="" /> : <span className="up-next-blank" aria-hidden="true" />}
      <div className="up-next-text">
        <span className="tag">Up next{isRound ? ` · round ${next.round}` : ` · ${episodeLabel(next.episode)}`} · <span aria-hidden="true">in {left}</span></span>
        <b>{next.title}</b>
        <p className="sr-only" role="status">Up next: {next.title}. It starts in {COUNTDOWN} seconds.</p>
      </div>
      <div className="dock-row">
        <button className="btn primary sm" onClick={() => play(next)}>▶ Play now</button>
        <button className="btn ghost sm" onClick={() => setCancelled(true)}>Cancel</button>
      </div>
    </section>
  );
}
