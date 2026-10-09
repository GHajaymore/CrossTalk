import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ARTIST } from '@crosstalk/shared';
import { IrisPicture } from './IrisPicture';

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
};

/** Iris's art, full size: the piece, its title and quote, her sketchbook note, and a download. Esc or a click outside closes it. */
export function ArtViewer({ art, onClose }: { art: ViewedArt; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); before?.focus?.(); };
  }, [onClose]);
  const alt = `${ARTIST.name}'s ${art.styleName.toLowerCase()}: ${art.title}`;
  const file = `iris-${art.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'art'}`;
  // Drawn at the top of the page, so nothing around the art it was opened from can shape it.
  return createPortal(
    <div className="art-viewer" role="dialog" aria-modal="true" aria-label={`${art.title}, full size`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <figure>
        {art.picture
          ? <IrisPicture conversationId={art.picture.conversationId} version={art.picture.version} fallback={art.src} alt={alt} />
          : <img src={art.src} alt={alt} />}
        <figcaption>
          <span className="tag">{ARTIST.name}, {ARTIST.role} · {art.styleName}{art.where ? ` · ${art.where}` : ''}</span>
          <h2>“{art.title}”</h2>
          {art.caption && <p className="av-quote">“{art.caption}”</p>}
          {art.brief && <p className="av-brief"><span className="tag">From her sketchbook</span> {art.brief}</p>}
          <div className="dock-row">
            {!art.picture && <a className="btn sm" href={art.src} download={`${file}.svg`}>Download</a>}
            {art.picture && <a className="btn sm" href={`/api/iris/picture/${art.picture.conversationId}/${art.picture.version}.jpg`} download={`${file}.jpg`}>Download painting</a>}
            <button ref={close} className="btn sm ghost" onClick={onClose}>Close</button>
          </div>
        </figcaption>
      </figure>
    </div>,
    document.body,
  );
}
