import { pictureUrl, usePolledImage } from '../lib/usePolledImage';

/**
 * Iris's full painting of a drawing: her line-art Painting shows at once, and the real painting fades
 * in over it when the free image service has made it ("Iris is painting…" until then). If it can't be
 * made, her line art simply stays.
 */
export function IrisPicture({ conversationId, version, fallback, alt, className = '' }: { conversationId: string; version: number; fallback: string; alt: string; className?: string }) {
  const p = usePolledImage(pictureUrl(conversationId, version));
  return (
    <span className="iris-picture">
      <img className={className} src={fallback} alt={p.src ? '' : alt} aria-hidden={p.src ? true : undefined} />
      {p.src && <img className={`${className} pic-in`} src={p.src} alt={alt} />}
      {p.state === 'loading' && <span className="tag painting-now">Iris is painting…</span>}
    </span>
  );
}
