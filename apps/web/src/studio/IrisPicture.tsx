import { useEffect, useRef, useState } from 'react';
import { irisArtCached, paintIris, rememberIrisArt, type EngineInput, type EngineStyle } from '../lib/irisEngine';
import { pictureUrl, usePolledImage } from '../lib/usePolledImage';
import { sourceSize, useCrisp } from '../lib/crisp';

export type EngineArt = EngineInput;
/** The styles her own engine paints on its own (no AI photo behind them). */
export const engineStyleOf = (style: string): EngineStyle | null => (style === 'painting' || style === 'dreamscape' || style === 'sketch' ? style : null);

/**
 * Iris's picture of a drawing. With `engine`, she paints it right here, stroke by stroke, with her own
 * engine (from her sketch and brief: free, on this device, always there). When the AI image service
 * has made the real thing in that style (a photograph, a gouache painting, a dreamscape, a pencil sketch), it fades in
 * over it. Without `engine`, her line art stands in.
 */
export function IrisPicture({ conversationId, version, fallback, alt, className = '', engine }: { conversationId: string; version: number; fallback: string; alt: string; className?: string; engine?: EngineArt }) {
  // The AI image for her style (a photograph, a painting, a dreamscape or a sketch) fades in over what she paints here.
  const p = usePolledImage(conversationId ? pictureUrl(conversationId, version, engine?.style ?? 'picture') : null);
  // The AI picture, enlarged and sharpened here so it stays crisp when shown large.
  const sharp = useCrisp(p.src);
  const shown = !!p.src && sharp.ready;
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
  }, [engine?.seed, engine?.brief, engine?.sketch, engine?.style]); // eslint-disable-line react-hooks/exhaustive-deps

  const base = !engine ? <img className={className} src={fallback} alt={shown ? '' : alt} aria-hidden={shown ? true : undefined} />
    : cached ? <img className={className} src={cached} alt={shown ? '' : alt} aria-hidden={shown ? true : undefined} />
    : <canvas ref={canvas} className={`${className} engine-art`} role="img" aria-label={shown ? undefined : alt} aria-hidden={shown ? true : undefined} />;
  return (
    <span className="iris-picture">
      {base}
      {shown && <img className={`${className} pic-in`} src={sharp.src!} alt={alt} {...sourceSize(sharp.crisp)} />}
      {(painting || (!engine && p.state === 'loading')) && <span className="tag painting-now">Iris is painting…</span>}
    </span>
  );
}
