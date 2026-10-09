// A host's photo that talks: the jaw drops and the mouth opens with their voice (the --lvl the set
// writes while they speak), and the eyes blink now and then. Drawn on this device from the photo and
// its face map; the photo itself never leaves. With no clear face (or reduced motion) the still
// photo shows, still moving with the same random life as before.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { faceMapFor, type FaceMap } from '../lib/faceMap';

const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** The lower face, from the lower lip's inner edge to below the chin, feathered, to slide down as the jaw opens. */
export function lowerFace(img: CanvasImageSource, w: number, h: number, m: FaceMap): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const mw = m.mouthR.x - m.mouthL.x;
  const cx = (m.mouthL.x + m.mouthR.x) / 2;
  const top = (m.lipTop.y + m.lipBottom.y) / 2;
  const span = Math.max(m.chin.y - top, mw * 0.6);
  // Soft at the sides and the bottom: an oval from the lips down past the chin.
  ctx.filter = `blur(${Math.max(1.5, mw * 0.08)}px)`;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(cx, top + span * 0.42, mw * 0.8, span * 0.88, 0, 0, Math.PI * 2);
  ctx.fill();
  // Its top edge is the lower lip's own inner edge, so only the lower lip and jaw move.
  ctx.filter = 'blur(0.6px)';
  ctx.globalCompositeOperation = 'destination-in';
  const L = m.innerBottom[0], R = m.innerBottom[m.innerBottom.length - 1];
  ctx.beginPath();
  ctx.moveTo(L.x - mw * 1.5, L.y);
  for (const q of m.innerBottom) ctx.lineTo(q.x, q.y);
  ctx.lineTo(R.x + mw * 1.5, R.y);
  ctx.lineTo(R.x + mw * 1.5, h);
  ctx.lineTo(L.x - mw * 1.5, h);
  ctx.closePath();
  ctx.fill();
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-in';
  ctx.drawImage(img, 0, 0, w, h);
  return c;
}

/** One frame: the photo, the open mouth (its own lip shape, dark, a hint of teeth), the dropped jaw, and the eyelids. */
export function drawTalking(ctx: CanvasRenderingContext2D, img: CanvasImageSource, lower: CanvasImageSource, m: FaceMap, open: number, blink: number) {
  ctx.drawImage(img, 0, 0);
  const mw = m.mouthR.x - m.mouthL.x;
  if (open > 0.02) {
    // About as far as a mouth opens in speech, never a yawn. The middle drops most; the corners stay joined.
    const d = open * 0.17 * mw;
    const cx = (m.mouthL.x + m.mouthR.x) / 2;
    const drop = (x: number) => d * Math.max(0.12, 1 - ((x - cx) / (mw * 0.72)) ** 2);
    const n = m.innerBottom.length - 1;
    ctx.save();
    ctx.beginPath();
    m.innerTop.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    for (let i = n; i >= 0; i--) {
      const q = m.innerBottom[i];
      ctx.lineTo(q.x, q.y + (i === 0 || i === n ? 0 : drop(q.x)));
    }
    ctx.closePath();
    const top = Math.min(...m.innerTop.map(q => q.y));
    const g = ctx.createLinearGradient(0, top, 0, top + d + 2);
    g.addColorStop(0, '#3a1a17'); g.addColorStop(0.5, '#1d0b0a'); g.addColorStop(1, '#2a1210');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    // A soft hint of upper teeth under the top lip.
    const lip = m.innerTop[Math.floor(m.innerTop.length / 2)];
    const th = Math.min(d * 0.42, mw * 0.065);
    ctx.fillStyle = 'rgba(214,206,192,0.55)';
    ctx.beginPath();
    ctx.ellipse(lip.x, lip.y, mw * 0.3, th, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // The lower lip and jaw, moved down in thin columns, the middle furthest.
    const lw = (lower as HTMLCanvasElement).width, lh = (lower as HTMLCanvasElement).height;
    const x0 = Math.max(0, Math.floor(cx - mw * 1.6)), x1 = Math.min(lw, Math.ceil(cx + mw * 1.6));
    for (let x = x0; x < x1; x += 3) {
      const cw = Math.min(3, x1 - x);
      ctx.drawImage(lower, x, 0, cw, lh, x, drop(x + cw / 2), cw, lh);
    }
  }
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
    const lower = lowerFace(img, w, h, map);
    const phase = Math.random() * 6;
    let open = 0, frame = 0, last = -1;
    let blinkAt = performance.now() + 1500 + Math.random() * 3000, blinkTwice = false;
    const tick = (t: number) => {
      // How loud this host is right now, as the set writes it on their tile.
      const lvl = parseFloat((canvas.closest('.set-tile') as HTMLElement | null)?.style.getPropertyValue('--lvl') ?? '') || 0;
      // Syllables: the jaw doesn't hold open, it moves a few times a second while the voice is on.
      const target = clamp((lvl - 0.04) * 1.7) * (0.6 + 0.4 * Math.abs(Math.sin(t / 1000 * Math.PI * 4.3 + phase)));
      open += (target - open) * (target > open ? 0.55 : 0.3);
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
      const key = Math.round(open * 40) * 100 + Math.round(blink * 20);
      if (key !== last) { drawTalking(ctx, img, lower, map, open, blink); last = key; }
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
