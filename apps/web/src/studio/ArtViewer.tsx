import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ARTIST } from '@crosstalk/shared';
import { irisArtCached } from '../lib/irisEngine';
import { pictureUrl } from '../lib/usePolledImage';
import { IrisPicture, type EngineArt } from './IrisPicture';

export type ViewedArt = {
  /** Her line art (or painted line art) as an image URL; shown at once and as the fallback. */
  src: string;
  /** Her full painting, when this is a Picture. */
  picture?: { conversationId: string; version: number } | null;
  title: string;
  caption: string;
  styleName: string;
  brief?: string;
  where?: string;
  /** What her own engine paints from, for a Picture. */
  engine?: EngineArt;
};

/** Iris's art, full size: the piece, its title and quote, her sketchbook note, and a download. Esc or a click outside closes it. */
export function ArtViewer({ art, onClose }: { art: ViewedArt; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  // Callers pass a fresh onClose each render; the latest is kept here so focus is only moved once.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); before?.focus?.(); };
  }, []);
  const alt = `${ARTIST.name}'s ${art.styleName.toLowerCase()}: ${art.title}`;
  const file = `iris-${art.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'art'}`;
  // Drawn at the top of the page, so nothing around the art it was opened from can shape it.
  return createPortal(
    <div className="art-viewer" role="dialog" aria-modal="true" aria-label={`${art.title}, full size`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <figure>
        {art.picture
          ? <IrisPicture conversationId={art.picture.conversationId} version={art.picture.version} fallback={art.src} alt={alt} engine={art.engine} />
          : art.engine ? <IrisPicture conversationId="" version={0} fallback={art.src} alt={alt} engine={art.engine} />
          : <img src={art.src} alt={alt} />}
        <figcaption>
          <span className="tag">{ARTIST.name}, {ARTIST.role} · {art.styleName}{art.where ? ` · ${art.where}` : ''}</span>
          <h2>“{art.title}”</h2>
          {art.caption && <p className="av-quote">“{art.caption}”</p>}
          {art.brief && <p className="av-brief"><span className="tag">From her sketchbook</span> {art.brief}</p>}
          <div className="dock-row">
            {!art.picture && !art.engine && <a className="btn sm" href={art.src} download={`${file}.svg`}>Download</a>}
            {!art.picture && art.engine && <button className="btn sm" onClick={() => { const u = irisArtCached(art.engine!); if (u) save(u, `${file}.jpg`); }}>Download</button>}
            {art.picture && <button className="btn sm" onClick={() => void downloadPicture(art, file)}>Download picture</button>}
            <button ref={close} className="btn sm ghost" onClick={onClose}>Close</button>
          </div>
        </figcaption>
      </figure>
    </div>,
    document.body,
  );
}

/** The full painting if the image service made one, otherwise the one she painted here. */
async function downloadPicture(art: ViewedArt, file: string) {
  let href: string | null = null;
  try {
    const r = await fetch(pictureUrl(art.picture!.conversationId, art.picture!.version));
    if (r.status === 200 && (r.headers.get('content-type') ?? '').startsWith('image/')) href = URL.createObjectURL(await r.blob());
  } catch { /* offline: use hers */ }
  href ??= art.engine ? irisArtCached(art.engine) : null;
  if (href) save(href, `${file}.jpg`);
}

function save(href: string, name: string) {
  const a = document.createElement('a');
  a.href = href; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}
