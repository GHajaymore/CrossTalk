import { useState } from 'react';
import { ARTIST, artworkSvg, homeStylesFor, PAINT_STYLE_INFO, PAINT_STYLES, paintStyleOf, type ArtistNotes, type ConversationView, type PaintStyle, type Speakers } from '@crosstalk/shared';
import { api } from '../api/client';
import { LivingSketch, useDrawReplay } from './LivingSketch';

/** Her sketch is shown as an image, never as live markup, so even a checked SVG can't run anything. */
export const sketchSrc = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

type Props = { notes: ArtistNotes; speakers: Speakers; conversationId: string; onAgain: () => void; onJump: (seq: number) => void; toast: (m: string) => void; setView: (v: ConversationView) => void };

/** Iris, the Artist: her perspective as a listener and the titled sketch of the moment that stayed with her. */
export function ArtistCard({ notes: a, speakers, conversationId, onAgain, onJump, toast, setView }: Props) {
  const [rating, setRating] = useState<'up' | 'down' | null>(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const replay = useDrawReplay();
  const [restyling, setRestyling] = useState(false);
  const style = paintStyleOf(a.artStyle);
  const styleName = PAINT_STYLE_INFO[style].name;
  const painted = style !== 'sketch';

  const head = (
    <div className="artist-head">
      <span className="flag C" aria-hidden="true">I</span>
      <span className="nm">{ARTIST.name}, {ARTIST.role}</span>
      <span className="tag">{a.modelId} · 1 request</span>
    </div>
  );

  if (a.state === 'listening') {
    return <section className="artist" aria-live="polite">{head}
      <div className="listening"><span className="lbars" aria-hidden="true"><i /><i /><i /><i /></span>{ARTIST.name} is listening back and sketching…</div>
    </section>;
  }
  if (a.state === 'failed') {
    return <section className="artist">{head}
      <div className="listening"><span>{a.error}</span><button className="btn sm" onClick={onAgain}>Try again</button></div>
    </section>;
  }

  const send = async () => {
    if (!rating) return;
    try {
      await api.sendIrisFeedback({ conversationId, rating, note });
      setSent(true);
      toast('Iris will remember this');
    } catch (e) { toast((e as Error).message); }
  };
  const who = speakers[a.momentSeq % 2 === 1 ? 'A' : 'B'].name;
  const restyle = async (s: PaintStyle) => {
    if (s === style || restyling) return;
    setRestyling(true);
    try {
      setView(await api.setArtStyle(conversationId, s));
      toast(`Now a ${PAINT_STYLE_INFO[s].name.toLowerCase()} · Iris notices what you pick`);
    } catch (e) { toast((e as Error).message); }
    setRestyling(false);
  };

  return (
    <section className="artist" aria-label="Iris's perspective">
      {head}
      <div className="artist-grid">
        <figure className="art">
          {a.sketchSvg
            ? <div className="sketch living-wrap">
                {painted && !replay.playing
                  ? <img key={style} className="living paint-in" src={sketchSrc(artworkSvg(a)!)} alt={`Iris's ${styleName.toLowerCase()}: ${a.artTitle}`} />
                  : <LivingSketch ghost className="living" svg={a.sketchSvg} progress={replay.progress ?? 1} label={`Iris's sketch: ${a.artTitle}`} />}
                <button className="btn sm ghost draw-btn" onClick={replay.start} disabled={replay.playing}>{replay.playing ? 'Drawing…' : painted ? '▶ Watch her paint' : '▶ Watch her draw'}</button>
              </div>
            : <div className="sketch-missing"><p className="hint">{a.error}</p><button className="btn sm" onClick={onAgain}>Sketch again</button></div>}
          <figcaption><span className="art-title">“{a.artTitle}”</span>Iris · {styleName.toLowerCase()} of turn {a.momentSeq}</figcaption>
        </figure>
        <div className="artist-body">
          <div className="styles" role="group" aria-label="Art style">
            <span className="tag">Art style</span>
            {[...PAINT_STYLES, ...homeStylesFor(speakers)].map(s => <button key={s} className="chip sm" aria-pressed={style === s} disabled={!a.sketchSvg || restyling}
              title={PAINT_STYLE_INFO[s].what} onClick={() => restyle(s)}>{PAINT_STYLE_INFO[s].name}</button>)}
            <button className="chip sm" disabled title="A full illustration needs an image model, and none is free yet">Picture · soon</button>
          </div>
          <span className="tag">As a listener</span>
          <p className="persp">{a.perspective}</p>
          <blockquote className="moment">“{a.caption}”<cite>The moment she drew · {who}, turn {a.momentSeq}</cite></blockquote>
          <div className="dock-row">
            <button className="btn sm" onClick={() => onJump(a.momentSeq)}>Go to turn {a.momentSeq}</button>
            <button className="btn sm ghost" onClick={onAgain}>Ask {ARTIST.name} again</button>
          </div>
          <div className="teach">
            <span className="tag">Help Iris learn</span>
            {sent ? <p className="hint">Thanks. Iris reads your notes before every drawing, so her next one will take this into account.</p> : <>
              <div className="dock-row">
                <button className="chip sm" aria-pressed={rating === 'up'} onClick={() => setRating('up')}>👍 Got it right</button>
                <button className="chip sm" aria-pressed={rating === 'down'} onClick={() => setRating('down')}>👎 Not quite</button>
              </div>
              {rating && <div className="dock-row">
                <input type="text" maxLength={300} value={note} onChange={e => setNote(e.target.value)}
                  placeholder={rating === 'up' ? 'What did you like? e.g. the warm colours' : 'What should she do differently? e.g. draw people, not objects'} />
                <button className="btn sm" onClick={send}>Tell Iris</button>
              </div>}
            </>}
          </div>
        </div>
      </div>
    </section>
  );
}
