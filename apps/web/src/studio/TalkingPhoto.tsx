// A host's photo, alive but honest: the face is never redrawn to fake speech (a drawn-on mouth looked
// false, owner's call, Oct 10, 2026); only the eyes blink now and then, using the photo's own skin.
// Who is talking shows in the set around it: the lit frame, the voice bars and the camera.
// Drawn on this device from the photo and its face map; the photo itself never leaves. With no clear
// face (or reduced motion) the still photo shows, still moving with the same gentle life as before.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { faceMapFor, type FaceMap } from '../lib/faceMap';

/** One frame: the photo as it is, with the eyelids closing for a blink. */
export function drawBlink(ctx: CanvasRenderingContext2D, img: CanvasImageSource, m: FaceMap, blink: number) {
  ctx.drawImage(img, 0, 0);
  if (blink > 0.02) {
    // The eyelid closing: the skin just above each eye slides down over the eye's own opening, so it
    // keeps the real skin, light and make-up; a lash line marks its edge.
    for (const e of m.eyes) {
      const ys = e.contour.map(q => q.y), xs = e.contour.map(q => q.x);
      const top = Math.min(...ys), bottom = Math.max(...ys), left = Math.min(...xs), right = Math.max(...xs);
      const eh = Math.max(bottom - top, 2), lid = top + blink * (eh + 1);
      const s = eh * 1.1;
      ctx.save();
      ctx.beginPath();
      e.contour.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, left - 2, top - s, right - left + 4, s, left - 2, top - s, right - left + 4, s + (lid - top));
      ctx.strokeStyle = 'rgba(28,18,14,0.7)';
      ctx.lineWidth = Math.max(1, eh * 0.18);
      ctx.beginPath();
      ctx.moveTo(left, lid - eh * 0.15);
      ctx.quadraticCurveTo((left + right) / 2, lid + eh * 0.2, right, lid - eh * 0.15);
      ctx.stroke();
      ctx.restore();
    }
  }
}

export function TalkingPhoto({ src, code, style, onLoad, onError }: { src: string; code: string; style?: CSSProperties; onLoad: () => void; onError: () => void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [map, setMap] = useState<FaceMap | null>(null);
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const loaded = () => {
    onLoad();
    const img = imgRef.current;
    if (!img || still) return;
    void faceMapFor(code, img).then(m => { if (imgRef.current === img) setMap(m); });
  };
  useEffect(() => setMap(null), [src]);

  useEffect(() => {
    const img = imgRef.current, canvas = canvasRef.current;
    if (!map || !img || !canvas) return;
    const w = img.naturalWidth, h = img.naturalHeight;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let frame = 0, last = -1;
    let blinkAt = performance.now() + 1500 + Math.random() * 3000, blinkTwice = false;
    const tick = (t: number) => {
      // Blinks every few seconds (sometimes twice), about a seventh of a second each.
      let blink = 0;
      const since = t - blinkAt;
      if (since > 0) {
        blink = since < 70 ? since / 70 : since < 150 ? 1 - (since - 70) / 80 : 0;
        if (since >= 150) {
          blinkAt = t + (blinkTwice ? 180 : 2200 + Math.random() * 4200);
          blinkTwice = !blinkTwice && Math.random() < 0.18;
        }
      }
      const key = Math.round(blink * 20);
      if (key !== last) { drawBlink(ctx, img, map, blink); last = key; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [map]);

  return (
    <>
      <img ref={imgRef} src={src} alt="" style={{ ...style, visibility: map ? 'hidden' : undefined }} onLoad={loaded} onError={onError} />
      {map && <canvas ref={canvasRef} className="talking" style={style} />}
    </>
  );
}
