import { useEffect, useState } from 'react';
import { ARTIST, episodeLabel, PAINT_STYLE_INFO, PAINT_STYLES, paintSvg, type AppConfig, type Artwork, type GalleryEpisode, type IrisFeedback, type PaintStyle } from '@crosstalk/shared';
import { api } from '../api/client';
import { sketchSrc } from '../studio/ArtistCard';
import { Footer } from './Footer';

const art = (g: GalleryEpisode, a: Artwork) => sketchSrc(paintSvg(a.svg, a.style, g.conversationId));

/** Iris, the Artist: everything she has drawn, and everything she has learned from you. */
export function IrisPage({ config }: { config: AppConfig | null }) {
  const [gallery, setGallery] = useState<GalleryEpisode[] | null>(null);
  const [notes, setNotes] = useState<IrisFeedback[] | null>(null);
  const [styles, setStyles] = useState<PaintStyle[] | null>(null);
  const [styleMsg, setStyleMsg] = useState('');
  useEffect(() => {
    api.irisGallery().then(setGallery).catch(() => setGallery([]));
    api.irisFeedback().then(setNotes).catch(() => setNotes([]));
    api.irisStyles().then(r => setStyles(r.styles)).catch(() => setStyles([...PAINT_STYLES]));
  }, []);

  const pieces = (gallery ?? []).reduce((n, g) => n + g.artworks.length, 0);
  const liked = (notes ?? []).filter(n => n.rating === 'up').length;

  const toggle = async (s: PaintStyle) => {
    if (!styles) return;
    const next = styles.includes(s) ? styles.filter(x => x !== s) : PAINT_STYLES.filter(x => x === s || styles.includes(x));
    if (!next.length) { setStyleMsg('Keep at least one style ticked.'); return; }
    try {
      const r = await api.setIrisStyles(next);
      setStyles(r.styles);
      setStyleMsg(r.styles.length === 1 ? `Iris will use ${PAINT_STYLE_INFO[r.styles[0]].name} for every new drawing.` : `Iris will choose among ${r.styles.map(x => PAINT_STYLE_INFO[x].name).join(', ')} for each new drawing.`);
    } catch (e) { setStyleMsg((e as Error).message); }
  };

  return (
    <div className="page iris-page">
      <header className="iris-hero">
        <span className="flag C big" aria-hidden="true">I</span>
        <div>
          <span className="tag">The listener in the booth</span>
          <h1>{ARTIST.name}, {ARTIST.role}</h1>
          <p className="hint">She listens to every finished episode, picks the one moment that stayed with her, says how it felt as a listener, and draws it. Before each drawing she reads your latest notes, so she gets better as the show does.</p>
          <div className="iris-stats">
            <span><b>{gallery ? pieces : '…'}</b> pieces</span>
            <span><b>{notes ? notes.length : '…'}</b> notes from you</span>
            <span><b>{notes ? liked : '…'}</b> she got right</span>
          </div>
          {config?.storage === 'backed-up' && <p className="hint">☁ Her drawings and notes are backed up, so they stay when the server restarts.</p>}
          {config?.storage === 'forgets' && <p className="hint">⚠ Online without a backup, her drawings are forgotten when the server restarts or updates. docs/DEPLOY.md → Keep episodes for good.</p>}
        </div>
      </header>

      <section className="sec"><h2>Gallery</h2>
        <p className="hint">Everything she has made: each drawing, each time you asked her again, and each style you chose.</p>
        {!gallery ? <p className="hint">Loading…</p> : !gallery.length ? <p className="hint">No drawings yet. Finish an episode and Iris paints it.</p> : (
          <ul className="gallery">{gallery.map(g => <GalleryCard key={g.conversationId} g={g} />)}</ul>
        )}
      </section>

      <section className="sec"><h2>Her styles</h2>
        <p className="hint">Tick the styles Iris may use. With more than one, she picks the one that fits each episode (and leans toward the ones you keep choosing). You can still switch any drawing on her card under Read.</p>
        <div role="group" aria-label="Styles Iris may use"><ul className="iris-styles">
          {PAINT_STYLES.map(s => {
            const on = !!styles?.includes(s);
            return (
              <li key={s} className={on ? 'on' : undefined}>
                <button className="style-pick" aria-pressed={on} disabled={!styles} onClick={() => toggle(s)}>
                  <span className="tick" aria-hidden="true">{on ? '✓' : ''}</span>
                  <b>{PAINT_STYLE_INFO[s].name}</b>
                  <span className="hint">{PAINT_STYLE_INFO[s].what}</span>
                </button>
              </li>
            );
          })}
          <li><div className="style-pick off"><span className="tick" aria-hidden="true" /><b>Picture <span className="soon">Soon</span></b>
            <span className="hint">A full illustration from her saved picture prompt. Needs an image model, and none is free yet.</span></div></li>
        </ul></div>
        {styleMsg && <p className="hint" role="status">{styleMsg}</p>}
        <p className="hint">She paints in your browser from her own lines: no image model, nothing sent anywhere, always free.</p>
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
      <Footer config={config} />
    </div>
  );
}

/** One episode on the wall: what's showing now, with every other version one tap away. */
function GalleryCard({ g }: { g: GalleryEpisode }) {
  const now = g.artworks.find(a => g.current && a.version === g.current.version && a.style === g.current.style) ?? g.artworks[0];
  const [shown, setShown] = useState<Artwork>(now);
  const label = (a: Artwork) => `${PAINT_STYLE_INFO[a.style].name}${g.artworks.some(x => x.version !== a.version) ? ` · v${a.version}` : ''}`;
  return (
    <li className="g-card">
      <a className="g-link" href={`#/studio/${g.conversationId}/read`}>
        <img src={art(g, shown)} alt={`Iris's ${PAINT_STYLE_INFO[shown.style].name.toLowerCase()}: ${shown.title}`} />
        <span className="g-title">“{shown.title}”</span>
        <span className="g-quote">“{shown.caption}”</span>
        <span className="tag">{episodeLabel(g.episode)}{g.round > 1 ? ` · round ${g.round}` : ''} · turn {shown.momentSeq} · {label(shown)}</span>
        <span className="g-topic">{g.title}</span>
      </a>
      {g.artworks.length > 1 && (
        <div className="g-versions" role="group" aria-label={`Every version for ${g.title}`}>
          {g.artworks.map(a => (
            <button key={a.id} aria-pressed={a.id === shown.id} onClick={() => setShown(a)} title={label(a)}>
              <img src={art(g, a)} alt={label(a)} />
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
