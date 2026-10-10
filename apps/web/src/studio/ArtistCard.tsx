import { useEffect, useRef, useState } from 'react';
import { ARTIST, artSeed, artworkSvg, homeStylesFor, PAINT_STYLE_INFO, PAINT_STYLES, paintStyleOf, type ArtistNotes, type ConversationView, type Language, type PaintStyle, type Speakers } from '@crosstalk/shared';
import { speakAsIris } from '../speech/BrowserSpeech';
import { api } from '../api/client';
import { LivingSketch, useDrawReplay } from './LivingSketch';
import { ArtViewer } from './ArtViewer';
import { engineStyleOf, IrisPicture } from './IrisPicture';

/** Her sketch is shown as an image, never as live markup, so even a checked SVG can't run anything. */
export const sketchSrc = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

type Props = { notes: ArtistNotes; speakers: Speakers; conversationId: string; onAgain: () => void; onJump: (seq: number) => void; toast: (m: string) => void; setView: (v: ConversationView) => void; pictures?: boolean; lang?: Language; episodePlaying?: boolean };

/** Iris, the Artist: her perspective as a listener and the titled sketch of the moment that stayed with her. */
export function ArtistCard({ notes: a, speakers, conversationId, onAgain, onJump, toast, setView, pictures = false, lang = 'en', episodePlaying = false }: Props) {
  const [rating, setRating] = useState<'up' | 'down' | null>(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const replay = useDrawReplay();
  const [viewing, setViewing] = useState(false);
  // Hear Iris: she reads her reflection aloud in her own voice while her lines draw themselves again.
  // It lasts until both her voice and her redrawing have finished; Stop ends both.
  const [hearing, setHearing] = useState(false);
  const [voiceDone, setVoiceDone] = useState(true);
  const stopVoice = useRef<() => void>(() => {});
  useEffect(() => () => stopVoice.current(), []);
  useEffect(() => { if (hearing && voiceDone && !replay.playing) setHearing(false); }, [hearing, voiceDone, replay.playing]);
  const hear = () => {
    if (hearing) { stopVoice.current(); replay.stop(); setVoiceDone(true); setHearing(false); return; }
    setHearing(true); setVoiceDone(false);
    if (a.sketchSvg) replay.start();
    stopVoice.current = speakAsIris(a.perspective, lang, () => setVoiceDone(true));
  };
  const [restyling, setRestyling] = useState(false);
  const style = paintStyleOf(a.artStyle);
  const styleName = PAINT_STYLE_INFO[style].name;
  // Every style is a finished piece now (her Sketch is drawn in pencil on paper); her plain lines show while she redraws.
  const painted = true;

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
                  ? <button className="art-open" onClick={() => setViewing(true)} aria-label={`Open “${a.artTitle}” full size`}>
                      {style === 'picture' && pictures
                        ? <IrisPicture key={`${a.version}`} conversationId={conversationId} version={a.version} className="living paint-in" fallback={sketchSrc(artworkSvg(a)!)} alt={`Iris's picture: ${a.artTitle}`} engine={{ sketch: a.sketchSvg, seed: artSeed(conversationId, a.version), brief: a.imagePrompt }} />
                        : engineStyleOf(style)
                          ? <IrisPicture key={`${style}${a.version}`} conversationId={conversationId} version={a.version} className="living paint-in" fallback={sketchSrc(artworkSvg(a)!)} alt={`Iris's ${styleName.toLowerCase()}: ${a.artTitle}`} engine={{ sketch: a.sketchSvg, seed: artSeed(conversationId, a.version), brief: a.imagePrompt, style: engineStyleOf(style)! }} />
                          : <img key={style} className="living paint-in" src={sketchSrc(artworkSvg(a)!)} alt={`Iris's ${styleName.toLowerCase()}: ${a.artTitle}`} />}
                      <span className="expand-hint" aria-hidden="true">⤢</span>
                    </button>
                  : <LivingSketch ghost className="living" svg={a.sketchSvg} progress={replay.progress ?? 1} label={`Iris's sketch: ${a.artTitle}`} />}
                <button className="btn sm ghost draw-btn" onClick={replay.start} disabled={replay.playing}>{replay.playing ? 'Drawing…' : style === 'sketch' ? '▶ Watch her draw' : '▶ Watch her paint'}</button>
              </div>
            : <div className="sketch-missing"><p className="hint">{a.error}</p><button className="btn sm" onClick={onAgain}>Sketch again</button></div>}
          <figcaption><span className="art-title">“{a.artTitle}”</span>Iris · {styleName.toLowerCase()} of turn {a.momentSeq}
            {a.sketchSvg && <button className="link-btn full-size" onClick={() => setViewing(true)}>⤢ Full size</button>}</figcaption>
          {viewing && a.sketchSvg && <ArtViewer onClose={() => setViewing(false)} art={{
            src: sketchSrc(artworkSvg(a)!), picture: (style === 'picture' && pictures) || engineStyleOf(style) ? { conversationId, version: a.version } : null,
            title: a.artTitle, caption: a.caption, styleName, brief: style === 'picture' ? a.imagePrompt : undefined, where: `turn ${a.momentSeq}`,
            engine: (style === 'picture' && pictures) || engineStyleOf(style) ? { sketch: a.sketchSvg, seed: artSeed(conversationId, a.version), brief: a.imagePrompt, style: engineStyleOf(style) ?? 'picture' } : undefined,
          }} />}
          {a.imagePrompt && style === 'picture' && pictures && (
            <aside className="sketchbook" aria-label="From her sketchbook"><span className="tag">From her sketchbook</span><p>{a.imagePrompt}</p></aside>
          )}
        </figure>
        <div className="artist-body">
          <div className="styles" role="group" aria-label="Art style">
            <span className="tag">Art style</span>
            {[...PAINT_STYLES, ...homeStylesFor(speakers)].filter(s => s !== 'picture' || pictures).map(s => <button key={s} className="chip sm" aria-pressed={style === s} disabled={!a.sketchSvg || restyling}
              title={PAINT_STYLE_INFO[s].what} onClick={() => restyle(s)}>{PAINT_STYLE_INFO[s].name}</button>)}
          </div>
          <div className="persp-head">
            <span className="tag">As a listener</span>
            <button className="btn sm ghost hear-iris" aria-pressed={hearing} onClick={hear} disabled={episodePlaying && !hearing}
              title={episodePlaying ? 'Pause the episode to hear Iris' : undefined}>{hearing ? '■ Stop' : `▶ Hear ${ARTIST.name}`}</button>
          </div>
          <p className={`persp${hearing ? ' speaking' : ''}`}>{a.perspective}</p>
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
