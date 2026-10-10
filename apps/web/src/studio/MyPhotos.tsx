import { useEffect, useState } from 'react';
import type { AppConfig } from '@crosstalk/shared';

type Photo = { id: string; title: string; prompt: string; createdAt: string };

/** My photos: the Photo of the day pictures you kept, newest first, saved with the episodes. */
export function MyPhotos({ config, refresh }: { config: AppConfig | null; refresh: number }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/photos').then(r => r.json()).then((r: { photos: Photo[] }) => setPhotos(r.photos)).catch(() => setError("Couldn't load My photos."));
  }, [refresh]);

  const remove = async (id: string) => {
    const r = await fetch(`/api/photos/${id}`, { method: 'DELETE' });
    if (r.ok || r.status === 404) setPhotos(p => p?.filter(x => x.id !== id) ?? null);
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
              <a href={`/api/photos/${p.id}.jpg`} target="_blank" rel="noopener"><img src={`/api/photos/${p.id}.jpg`} alt={`${p.title}: ${p.prompt}`} loading="lazy" /></a>
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
    </div>
  );
}
