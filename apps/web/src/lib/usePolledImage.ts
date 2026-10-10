import { useEffect, useState } from 'react';

export type PolledImage = { src: string | null; state: 'loading' | 'ok' | 'failed' };

/**
 * A picture the server may still be making: it answers at once with the image, 202 ("ask again
 * shortly") or 404. Asks again every few seconds while it's being made. Only real images are used.
 * `delayMs` waits before the first ask (so typing doesn't ask per keystroke). With `retryMs`, a picture
 * that isn't there is asked for again after that long, for as long as it's on screen.
 */
export function usePolledImage(url: string | null, delayMs = 0, tries = 30, retryMs = 0): PolledImage {
  const [img, setImg] = useState<PolledImage>({ src: null, state: 'loading' });
  useEffect(() => {
    setImg({ src: null, state: 'loading' });
    if (!url) return;
    let stop = false, timer = 0, blobUrl = '';
    let left = tries;
    const ask = async () => {
      try {
        const r = await fetch(url);
        if (stop) return;
        // 202 is "ok" too, so it's checked first: still being made.
        if (r.status === 202) { if (left-- > 0) { timer = window.setTimeout(ask, 4000); return; } }
        else if (r.ok && (r.headers.get('content-type') ?? '').startsWith('image/')) {
          const blob = await r.blob();
          if (stop) return;
          blobUrl = URL.createObjectURL(blob);
          setImg({ src: blobUrl, state: 'ok' });
          return;
        }
      } catch { /* offline */ }
      if (stop) return;
      // Some pictures are worth waiting for: ask again later instead of giving up.
      if (retryMs > 0) { left = tries; timer = window.setTimeout(ask, retryMs); setImg(i => (i.state === 'loading' ? i : { src: null, state: 'loading' })); return; }
      setImg({ src: null, state: 'failed' });
    };
    timer = window.setTimeout(ask, delayMs);
    return () => { stop = true; window.clearTimeout(timer); if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps
  return img;
}

/** Where Iris's AI picture of one drawing version lives: her photograph, or her dreamscape or sketch. `ready` only fetches one already made. */
export const pictureUrl = (conversationId: string, version: number, style: 'picture' | 'dreamscape' | 'sketch' = 'picture', ready = false) => {
  const q = [style === 'picture' ? '' : `style=${style}`, ready ? 'ready=1' : ''].filter(Boolean).join('&');
  return `/api/iris/picture/${conversationId}/${version}.jpg${q ? `?${q}` : ''}`;
};

/** Iris's finished painting for an episode's current drawing, if it's ready now (no waiting). */
export async function readyPicture(v: { id: string; artist?: { artStyle: string; version: number } | null }, onlyReady = false): Promise<Blob | null> {
  const style = v.artist?.artStyle;
  if (style !== 'picture' && style !== 'dreamscape' && style !== 'sketch') return null;
  try {
    const r = await fetch(pictureUrl(v.id, v.artist!.version, style, onlyReady));
    return r.status === 200 && (r.headers.get('content-type') ?? '').startsWith('image/') ? await r.blob() : null;
  } catch { return null; }
}
