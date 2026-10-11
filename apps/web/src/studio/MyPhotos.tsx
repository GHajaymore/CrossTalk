import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { printSizeLine } from '../lib/printSize';
import type { AppConfig } from '@crosstalk/shared';

type Photo = { id: string; title: string; prompt: string; createdAt: string };

/** My photos: the Photo of the day pictures you kept, newest first, saved with the episodes. */
export function MyPhotos({ config, refresh }: { config: AppConfig | null; refresh: number }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/photos').then(r => r.json()).then((r: { photos: Photo[] }) => setPhotos(r.photos)).catch(() => setError("Couldn't load My photos."));
  }, [refresh]);

  const remove = async (id: string) => {
    const r = await fetch(`/api/photos/${id}`, { method: 'DELETE' });
    if (r.ok || r.status === 404) {
      const left = (photos ?? []).filter(x => x.id !== id);
      setPhotos(left);
      // In the viewer, step to the next photo (or close when none are left).
      setOpen(o => (o == null ? null : left.length ? Math.min(o, left.length - 1) : null));
    }
    setConfirming(null);
  };
  const file = (p: Photo) => `crosstalk-${p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'photo'}.jpg`;

  return (
    <div className="my-photos">
      <h3>My photos</h3>
      {config?.storage === 'paused' && <p className="hint">⏸ Backup paused: photos you keep now are lost at the next restart. Download any you can't lose.</p>}
      {config?.storage === 'forgets' && <p className="hint">⚠ Not backed up: kept photos are lost when the server restarts. Download any you can't lose.</p>}
      {error && <p className="hint" role="alert">{error}</p>}
      {!photos ? <p className="hint">Loading…</p> : !photos.length ? <p className="hint">None yet. Make a photo above and tap ☆ Keep in My photos.</p> : (
        <ul className="photo-grid">
          {photos.map(p => (
            <li key={p.id}>
              <button className="photo-open" onClick={() => setOpen(photos.indexOf(p))} aria-label={`Open ${p.title} full size`}><img src={`/api/photos/${p.id}.jpg`} alt="" loading="lazy" /></button>
              <b>{p.title}</b>
              <span className="tag">{new Date(p.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <div className="dock-row">
                <a className="btn sm" href={`/api/photos/${p.id}.jpg`} download={file(p)}>⤓ Download</a>
                {confirming === p.id
                  ? <><button className="btn sm danger" onClick={() => void remove(p.id)}>Yes, remove</button><button className="btn sm ghost" onClick={() => setConfirming(null)}>Keep</button></>
                  : <button className="btn sm ghost" onClick={() => setConfirming(p.id)}>Remove</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {open != null && photos?.[open] && (
        <PhotoViewer photo={photos[open]} index={open} count={photos.length} file={file(photos[open])}
          confirming={confirming === photos[open].id} onConfirm={v => setConfirming(v ? photos[open].id : null)}
          onRemove={() => void remove(photos[open].id)} onStep={d => { setConfirming(null); setOpen(o => (o == null ? o : (o + d + photos.length) % photos.length)); }}
          onClose={() => { setConfirming(null); setOpen(null); }} />
      )}
    </div>
  );
}

/** One kept photo, full size: its title and brief, Download and Remove. Arrows step, Esc closes. */
function PhotoViewer({ photo, index, count, file, confirming, onConfirm, onRemove, onStep, onClose }: {
  photo: Photo; index: number; count: number; file: string; confirming: boolean;
  onConfirm: (v: boolean) => void; onRemove: () => void; onStep: (d: number) => void; onClose: () => void;
}) {
  const close = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const keys = useRef({ onStep, onClose });
  keys.current = { onStep, onClose };
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') keys.current.onClose();
      else if (e.key === 'ArrowRight') keys.current.onStep(1);
      else if (e.key === 'ArrowLeft') keys.current.onStep(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); before?.focus?.(); };
  }, []);
  return createPortal(
    <div className="art-viewer" role="dialog" aria-modal="true" aria-label={`${photo.title}, full size, photo ${index + 1} of ${count}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <figure>
        <img src={`/api/photos/${photo.id}.jpg`} alt={`${photo.title}: ${photo.prompt}`} onLoad={e => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
        <figcaption>
          <span className="tag">My photos · {index + 1} of {count} · {new Date(photo.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <h2>{photo.title}</h2>
          {size && <p className="hint print-size">🖨 {printSizeLine(size)}</p>}
          <p className="av-brief"><span className="tag">The brief</span> {photo.prompt}</p>
          <div className="dock-row">
            {count > 1 && <button className="btn sm ghost" onClick={() => onStep(-1)} aria-label="Previous photo">←</button>}
            <a className="btn sm" href={`/api/photos/${photo.id}.jpg`} download={file}>⤓ Download</a>
            {confirming
              ? <><button className="btn sm danger" onClick={onRemove}>Yes, remove it</button><button className="btn sm ghost" onClick={() => onConfirm(false)}>Keep it</button></>
              : <button className="btn sm ghost" onClick={() => onConfirm(true)}>Remove</button>}
            {count > 1 && <button className="btn sm ghost" onClick={() => onStep(1)} aria-label="Next photo">→</button>}
            <button ref={close} className="btn sm" onClick={onClose}>Close</button>
          </div>
        </figcaption>
      </figure>
    </div>,
    document.body,
  );
}
