import { useEffect, useRef, useState } from 'react';
import { ARTIST, artSeed, episodeLabel, PAINT_STYLE_INFO, paintSvg, type Artwork, type GalleryEpisode } from '@crosstalk/shared';
import { musicPlan, playMusic } from '../lib/clipMusic';
import { sketchSrc } from './ArtistCard';
import { engineStyleOf, IrisPicture } from './IrisPicture';

const SLIDE_S = 8;

type Slide = { g: GalleryEpisode; a: Artwork; src: string };

/** Each episode's piece as it's shown now (its current version and style). */
export function slidesOf(gallery: GalleryEpisode[]): Slide[] {
  return gallery.flatMap(g => {
    const a = g.artworks.find(x => g.current && x.version === g.current.version && x.style === g.current.style) ?? g.artworks[0];
    return a ? [{ g, a, src: sketchSrc(paintSvg(a.svg, a.style, artSeed(g.conversationId, a.version))) }] : [];
  });
}

/**
 * Iris's gallery as an exhibition: one piece at a time, slowly drifting closer, with her title and
 * the moment it came from, to a soft score composed on the device. Esc closes; arrows step; space pauses.
 */
export function Slideshow({ gallery, onClose, pictures = false }: { gallery: GalleryEpisode[]; onClose: () => void; pictures?: boolean }) {
  const slides = slidesOf(gallery);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const n = slides.length;
  const go = (d: number) => setI(x => (x + d + n) % n);

  // Next piece every few seconds, unless paused.
  useEffect(() => {
    if (paused || n < 2) return;
    const t = window.setTimeout(() => go(1), SLIDE_S * 1000);
    return () => window.clearTimeout(t);
  }, [i, paused, n]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keys, and focus inside the dialog while it's open (once: callers pass a fresh onClose each render).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const stepRef = useRef(go);
  stepRef.current = go;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      else if (e.key === 'ArrowRight') stepRef.current(1);
      else if (e.key === 'ArrowLeft') stepRef.current(-1);
      else if (e.key === ' ' && (e.target as HTMLElement)?.tagName !== 'BUTTON') { e.preventDefault(); setPaused(p => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); before?.focus?.(); };
  }, []);

  // The score: calm, ten minutes, the same for the same gallery.
  useEffect(() => {
    if (!sound || paused) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ac = new Ctx();
    const stop = playMusic(ac, musicPlan(`gallery:${slides[0]?.g.conversationId ?? ''}`, 'calm', 600), ac.destination);
    return () => { stop(); void ac.close(); };
  }, [sound, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!n) return null;
  const s = slides[i];
  return (
    <div className="slideshow" role="dialog" aria-modal="true" aria-label={`${ARTIST.name}'s gallery, piece ${i + 1} of ${n}`} ref={box}>
      <div className="ss-stage">
        {slides.map((x, k) => {
          const cls = `ss-art${k === i ? ' on' : ''}${paused ? ' still' : ''}`;
          const alt = k === i ? `${ARTIST.name}'s ${PAINT_STYLE_INFO[x.a.style].name.toLowerCase()}: ${x.a.title}` : '';
          // Her full painting where there is one (fetched only once its slide is near).
          const own = engineStyleOf(x.a.style);
          if (own && Math.abs(k - i) <= 1) return <span key={x.a.id} className={cls} aria-hidden={k !== i}><IrisPicture conversationId={x.g.conversationId} version={x.a.version} fallback={x.src} alt={alt} engine={{ sketch: x.a.svg, seed: artSeed(x.g.conversationId, x.a.version), brief: x.a.brief, style: own }} /></span>;
          return x.a.style === 'picture' && pictures && Math.abs(k - i) <= 1
            ? <span key={x.a.id} className={cls} aria-hidden={k !== i}><IrisPicture conversationId={x.g.conversationId} version={x.a.version} fallback={x.src} alt={alt} engine={{ sketch: x.a.svg, seed: artSeed(x.g.conversationId, x.a.version), brief: x.a.brief }} /></span>
            : <img key={x.a.id} src={x.src} alt={alt} className={cls} aria-hidden={k !== i} />;
        })}
      </div>
      <div className="ss-caption" aria-live="polite">
        <span className="tag">{episodeLabel(s.g.episode)}{s.g.round > 1 ? ` · round ${s.g.round}` : ''} · {PAINT_STYLE_INFO[s.a.style].name}</span>
        <h2>“{s.a.title}”</h2>
        <p className="ss-quote">“{s.a.caption}”</p>
        <p className="ss-topic">{s.g.title}</p>
      </div>
      <div className="ss-controls">
        <button className="btn sm ghost" onClick={() => go(-1)} aria-label="Previous piece">←</button>
        <button className="btn sm ghost" onClick={() => setPaused(p => !p)}>{paused ? '▶ Play' : '❚❚ Pause'}</button>
        <button className="btn sm ghost" onClick={() => go(1)} aria-label="Next piece">→</button>
        <button className="btn sm ghost" onClick={() => setSound(x => !x)} aria-pressed={sound}>{sound ? '♪ Music on' : '♪ Music off'}</button>
        {typeof document.documentElement.requestFullscreen === 'function' && (
          <button className="btn sm ghost" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen())?.catch(() => {})}>⛶ Full screen</button>
        )}
        <span className="tag ss-count">{i + 1} / {n}</span>
        <button ref={closeBtn} className="btn sm" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
