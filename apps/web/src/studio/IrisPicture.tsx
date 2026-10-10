import { useEffect, useRef, useState } from 'react';
import { irisArtCached, paintIris, rememberIrisArt } from '../lib/irisEngine';
import { pictureUrl, usePolledImage } from '../lib/usePolledImage';

export type EngineArt = { sketch: string; seed: string; brief?: string };

/**
 * Iris's picture of a drawing. With `engine`, she paints it right here, stroke by stroke, with her own
 * engine (from her sketch and brief: free, on this device, always there). When the free image service
 * has also made a full painting, it fades in over it. Without `engine`, her line art stands in.
 */
export function IrisPicture({ conversationId, version, fallback, alt, className = '', engine }: { conversationId: string; version: number; fallback: string; alt: string; className?: string; engine?: EngineArt }) {
  const p = usePolledImage(pictureUrl(conversationId, version));
  const cached = engine ? irisArtCached(engine) : null;
  const [painting, setPainting] = useState(!!engine && !cached);
  const canvas = useRef<HTMLCanvasElement>(null);
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!engine || cached || !canvas.current) return;
    const c = canvas.current;
    const stop = new AbortController();
    setPainting(true);
    void paintIris(c, engine, { animate: !still, signal: stop.signal }).then(() => {
      if (stop.signal.aborted) return;
      try { rememberIrisArt(engine, c.toDataURL('image/jpeg', 0.9)); } catch { /* fine: it stays on the canvas */ }
      setPainting(false);
    });
    return () => stop.abort();
  }, [engine?.seed, engine?.brief, engine?.sketch]); // eslint-disable-line react-hooks/exhaustive-deps

  const base = !engine ? <img className={className} src={fallback} alt={p.src ? '' : alt} aria-hidden={p.src ? true : undefined} />
    : cached ? <img className={className} src={cached} alt={p.src ? '' : alt} aria-hidden={p.src ? true : undefined} />
    : <canvas ref={canvas} className={`${className} engine-art`} role="img" aria-label={p.src ? undefined : alt} aria-hidden={p.src ? true : undefined} />;
  return (
    <span className="iris-picture">
      {base}
      {p.src && <img className={`${className} pic-in`} src={p.src} alt={alt} />}
      {(painting || (!engine && p.state === 'loading')) && <span className="tag painting-now">Iris is painting…</span>}
    </span>
  );
}
