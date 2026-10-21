// Crisper pictures, on this device: the free AI image service makes them about 1024 px wide, which goes
// soft when shown large, downloaded or printed. This enlarges a picture with the browser's best scaling
// and then sharpens its edges (an unsharp mask that leaves flat areas and fine grain alone). No new
// detail is invented, so print-size labels always use the picture's own pixels.
import { useEffect, useState } from 'react';

/** How strongly edges are lifted, and below what difference (out of 255) nothing changes, so grain stays quiet. */
const AMOUNT = 0.85, THRESHOLD = 4;

/** A copy of `canvas`, softly blurred by about `radius` pixels (in every browser). */
function blurred(canvas: HTMLCanvasElement, radius: number) {
  const out = document.createElement('canvas');
  out.width = canvas.width; out.height = canvas.height;
  const ctx = out.getContext('2d')!;
  if ('filter' in ctx) {
    ctx.filter = `blur(${radius}px)`;
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
    // Some browsers have the setting but ignore it: then fall through to shrink-and-grow.
    if (ctx.getImageData(0, 0, 1, 1).data[3] !== 0 && radius > 0 && !sameAs(canvas, out)) return out;
  }
  const s = document.createElement('canvas');
  const k = 1 + radius;
  s.width = Math.max(1, Math.round(canvas.width / k)); s.height = Math.max(1, Math.round(canvas.height / k));
  const sc = s.getContext('2d')!;
  sc.imageSmoothingEnabled = true; sc.imageSmoothingQuality = 'high';
  sc.drawImage(canvas, 0, 0, s.width, s.height);
  ctx.clearRect(0, 0, out.width, out.height);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(s, 0, 0, out.width, out.height);
  return out;
}

/** Whether a blur did nothing (a browser that ignores canvas filters), judged on a small middle patch. */
function sameAs(a: HTMLCanvasElement, b: HTMLCanvasElement) {
  const x = Math.floor(a.width / 2), y = Math.floor(a.height / 2), w = Math.min(32, a.width - x), h = Math.min(32, a.height - y);
  const p = a.getContext('2d')!.getImageData(x, y, w, h).data, q = b.getContext('2d')!.getImageData(x, y, w, h).data;
  for (let i = 0; i < p.length; i++) if (p[i] !== q[i]) return false;
  return true;
}

/**
 * The picture at `w`×`h` pixels, enlarged with the best scaling and its edges sharpened. Drawing a
 * picture larger than it was made goes through this, so it never comes out soft.
 */
export function crispCanvas(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  try {
    const sw = 'naturalWidth' in src ? (src as HTMLImageElement).naturalWidth : (src as HTMLCanvasElement).width;
    // Enlarged pictures need a wider touch than ones shown at their own size.
    const radius = Math.min(2.2, Math.max(0.8, (c.width / Math.max(1, sw)) * 0.9));
    const soft = blurred(c, radius).getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    const img = ctx.getImageData(0, 0, c.width, c.height), px = img.data;
    for (let i = 0; i < px.length; i += 4) {
      for (let k = 0; k < 3; k++) {
        const d = px[i + k] - soft[i + k];
        if (d > THRESHOLD || d < -THRESHOLD) px[i + k] = Math.max(0, Math.min(255, px[i + k] + d * AMOUNT));
      }
    }
    ctx.putImageData(img, 0, 0);
  } catch { /* a picture from elsewhere that can't be read: it stays smoothly enlarged */ }
  return c;
}

export type Crisp = { url: string; w: number; h: number; sourceW: number; sourceH: number };
const made = new Map<string, Promise<Crisp | null>>();

/**
 * A crisper copy of the picture at `src` (up to twice its size, at most `maxW` wide), as a JPEG blob
 * URL, made once per picture for this visit. Null if it can't be made; then use the original.
 */
export function crispUrl(src: string, maxW = 2048): Promise<Crisp | null> {
  const key = `${maxW}|${src}`;
  const hit = made.get(key);
  if (hit) return hit;
  const job = (async () => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const sw = img.naturalWidth, sh = img.naturalHeight;
    const k = Math.max(1, Math.min(2, maxW / sw));
    const c = crispCanvas(img, sw * k, sh * k);
    const blob = await new Promise<Blob | null>(res => c.toBlob(res, 'image/jpeg', 0.93));
    return blob ? { url: URL.createObjectURL(blob), w: c.width, h: c.height, sourceW: sw, sourceH: sh } : null;
  })().catch(() => null);
  made.set(key, job);
  return job;
}

/**
 * The crisper copy of a picture once it's ready (the original if it can't be made). `ready` turns true
 * once that's settled, so a picture can wait the moment it takes rather than swap in under you.
 */
export function useCrisp(src: string | null | undefined): { src: string | null; crisp: Crisp | null; ready: boolean } {
  const [state, setState] = useState<{ for: string; crisp: Crisp | null } | null>(null);
  useEffect(() => {
    if (!src) return;
    let live = true;
    void crispUrl(src).then(c => { if (live) setState({ for: src, crisp: c }); });
    return () => { live = false; };
  }, [src]);
  const done = !!src && state?.for === src;
  const crisp = done ? state!.crisp : null;
  return { src: crisp?.url ?? src ?? null, crisp, ready: done };
}

/** The picture's own pixel size, carried on a crisper copy so print-size labels stay honest. */
export const sourceSize = (c: Crisp | null) => (c ? { 'data-source-w': c.sourceW, 'data-source-h': c.sourceH } : {});

/** Saves a crisper copy of a picture (the original if one can't be made). */
export async function downloadCrisp(src: string, name: string) {
  const href = (await crispUrl(src))?.url ?? src;
  const a = document.createElement('a');
  a.href = href; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}

/** For a link that downloads a picture: saves the crisper copy instead (the plain link still works without script). */
export const crispDownload = (src: string, name: string) => ({
  href: src, download: name,
  onClick: (e: { preventDefault: () => void }) => { e.preventDefault(); void downloadCrisp(src, name); },
});
