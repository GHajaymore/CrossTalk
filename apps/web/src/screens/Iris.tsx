import { useEffect, useState } from 'react';
import { ARTIST, episodeLabel, type AppConfig, type IrisFeedback } from '@crosstalk/shared';
import { api, type ConversationSummary } from '../api/client';
import { sketchSrc } from '../studio/ArtistCard';
import { Footer } from './Footer';

const STYLES: [string, string, boolean][] = [
  ['Sketch', 'Line drawings she makes herself, checked and safe to show', true],
  ['Picture', 'A full illustration from her saved picture prompt', false],
  ['Painting', 'The same moment with brushwork and light', false],
  ['Dreamscape', 'Looser, stranger, for big-idea episodes', false],
];

/** Iris, the Artist: everything she has drawn, and everything she has learned from you. */
export function IrisPage({ config }: { config: AppConfig | null }) {
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [notes, setNotes] = useState<IrisFeedback[] | null>(null);
  useEffect(() => {
    api.list().then(setItems).catch(() => setItems([]));
    api.irisFeedback().then(setNotes).catch(() => setNotes([]));
  }, []);

  const drawn = (items ?? []).filter(c => c.artist?.state === 'done');
  const liked = (notes ?? []).filter(n => n.rating === 'up').length;

  return (
    <div className="page iris-page">
      <header className="iris-hero">
        <span className="flag C big" aria-hidden="true">I</span>
        <div>
          <span className="tag">The listener in the booth</span>
          <h1>{ARTIST.name}, {ARTIST.role}</h1>
          <p className="hint">She listens to every finished episode, picks the one moment that stayed with her, says how it felt as a listener, and draws it. Before each drawing she reads your latest notes, so she gets better as the show does.</p>
          <div className="iris-stats">
            <span><b>{items ? drawn.length : '…'}</b> sketches</span>
            <span><b>{notes ? notes.length : '…'}</b> notes from you</span>
            <span><b>{notes ? liked : '…'}</b> she got right</span>
          </div>
        </div>
      </header>

      <section className="sec"><h2>Gallery</h2>
        {!items ? <p className="hint">Loading…</p> : !drawn.length ? <p className="hint">No sketches yet. Finish an episode and Iris draws it.</p> : (
          <ul className="gallery">
            {drawn.map(c => {
              const a = c.artist!;
              return (
                <li key={c.id}>
                  <a className="g-card" href={`#/studio/${c.id}/read`}>
                    {a.sketchSvg
                      ? <img src={sketchSrc(a.sketchSvg)} alt={`Iris's sketch: ${a.artTitle}`} />
                      : <div className="g-missing hint">No sketch this time</div>}
                    <span className="g-title">“{a.artTitle}”</span>
                    <span className="g-quote">“{a.caption}”</span>
                    <span className="tag">{episodeLabel(c.episode)} · turn {a.momentSeq}</span>
                    <span className="g-topic">{c.parentId ? <>{c.topic} <span className="lib-branch">✂ {c.title}</span></> : c.title}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="sec"><h2>What Iris has learned</h2>
        <p className="hint">She reads your latest 10 notes before every drawing. Add one with "Help Iris learn" on her card, under Read in the Studio.</p>
        {!notes ? <p className="hint">Loading…</p> : !notes.length ? <p className="hint">Nothing yet. Your first note teaches her what you like.</p> : (
          <ul className="learned">
            {notes.map(n => (
              <li key={n.id}>
                <span>{n.rating === 'up' ? '👍' : '👎'} {n.note || (n.rating === 'up' ? 'Liked it' : 'Wanted something different')}{n.artTitle && <span className="hint"> · on “{n.artTitle}”</span>}</span>
                <button onClick={async () => setNotes(await api.forgetIrisFeedback(n.id))}>Forget</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sec"><h2>Her styles</h2>
        <ul className="iris-styles">
          {STYLES.map(([name, what, on]) => (
            <li key={name} className={on ? 'on' : undefined}>
              <b>{name}</b> <span className={on ? 'tag' : 'soon'}>{on ? 'Now' : 'Soon'}</span>
              <p className="hint">{what}</p>
            </li>
          ))}
        </ul>
        <p className="hint">The other styles need a free image model running on a GPU. Iris already saves a picture prompt with every sketch, so past episodes can be redrawn when it's ready.</p>
      </section>
      <Footer config={config} />
    </div>
  );
}
