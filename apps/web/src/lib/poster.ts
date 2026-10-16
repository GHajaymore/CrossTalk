// The episode poster: a 1080×1350 image to share, drawn on the device (no server, no cost).
import { ARTIST, artworkSvg, episodeLabel, hasCrux, hostSubtitle, mindChange, MODES, NOTICE, SCOUT_NOTICE, VERDICTS, type ConversationView } from '@crosstalk/shared';
import { pointOf } from '../studio/DebateMap';
import { bestArt } from './irisArt';

const W = 1080, H = 1350, PAD = 72;
// The studio tokens, as plain colours (a canvas can't read CSS variables).
export const C = { bg: '#111214', surface: '#1A1C1F', line: '#2E3238', text: '#ECE8E1', muted: '#A39E96', a: '#E8A55A', b: '#5FB8B0', cue: '#E9D36A', iris: '#B9A4E6' };
export const SAY = '"Source Serif 4", Georgia, serif', UI = '"Schibsted Grotesk", system-ui, sans-serif', TAG = '"JetBrains Mono", ui-monospace, monospace';

/** Lines that fit a width, at most `max` lines (the last ends in an ellipsis if cut). */
export function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number) {
  // A single word wider than the line (a URL, say) is split so it can never run off the poster.
  const words = text.split(/\s+/).flatMap(w => {
    if (ctx.measureText(w).width <= width) return [w];
    const parts: string[] = []; let cur = '';
    for (const ch of w) { if (ctx.measureText(cur + ch).width > width && cur) { parts.push(cur); cur = ch; } else cur += ch; }
    return cur ? [...parts, cur] : parts;
  });
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > width && line) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > max) {
    lines.length = max;
    let last = lines[max - 1];
    while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    lines[max - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

export const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('image'));
  img.src = src;
});

export async function makePoster(v: ConversationView): Promise<Blob> {
  await Promise.all([`600 72px ${SAY}`, `italic 34px ${SAY}`, `600 30px ${UI}`, `22px ${TAG}`].map(f => document.fonts?.load(f).catch(() => {})));
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.textBaseline = 'top';
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

  // Iris's art leads, edge to edge: her painting (the AI one, or the one she paints on this device)
  // when her style has one; otherwise her line art, drawn at the poster's own size with her lines
  // kept sharp, never made small and stretched.
  const art = v.artist?.state === 'done' ? v.artist : null;
  const ART_TOP = 80, ART_MAX = 700;
  let artBottom = ART_TOP + 560;
  const painted = await bestArt(v).then(u => (u ? loadImage(u) : null)).catch(() => null);
  if (painted) {
    const h = Math.min(ART_MAX, Math.round(W * painted.height / painted.width));
    ctx.drawImage(painted, 0, ART_TOP, W, h);
    artBottom = ART_TOP + h;
    if (painted.src.startsWith('blob:')) URL.revokeObjectURL(painted.src);
  } else if (art?.sketchSvg) {
    try {
      const svg = artworkSvg(art, { crisp: true })!;
      const { vw, vh } = viewBoxOf(svg);
      const h = Math.min(ART_MAX, Math.round(W * vh / vw)), w = Math.round(h * vw / vh);
      const { img } = await loadSketch(svg, w, h);
      ctx.fillStyle = ART_GROUND; ctx.fillRect(0, ART_TOP, W, h);
      ctx.drawImage(img, Math.round((W - w) / 2), ART_TOP, w, h);
      artBottom = ART_TOP + h;
    } catch { /* the poster stands on its words */ }
  }
  // Soft edges into the page above and below, so the art sits in the poster rather than on it.
  const fade = (y0: number, y1: number) => {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, `${C.bg}00`); g.addColorStop(1, C.bg);
    ctx.fillStyle = g; ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));
  };
  fade(ART_TOP + 90, ART_TOP); fade(artBottom - 180, artBottom - 40);
  ctx.fillStyle = C.bg; ctx.fillRect(0, artBottom - 40, W, H - artBottom + 40);

  // Brand mark, show line
  ctx.fillStyle = C.a; ctx.fillRect(PAD, 48, 16, 36);
  ctx.fillStyle = C.b; ctx.fillRect(PAD + 22, 48, 16, 36);
  ctx.fillStyle = C.text; ctx.font = `700 32px ${UI}`;
  ctx.fillText('CrossTalk', PAD + 54, 50);
  ctx.fillStyle = C.muted; ctx.font = `20px ${TAG}`; ctx.textAlign = 'right';
  ctx.fillText(`${episodeLabel(v.episode).toUpperCase()} · ${MODES[v.mode].label.toUpperCase()}`, W - PAD, 58);
  ctx.textAlign = 'left';

  // Iris's credit on the faded foot of the art, then the question, large
  let y = artBottom - 44;
  if (art) {
    ctx.fillStyle = C.iris; ctx.font = `20px ${TAG}`;
    ctx.fillText(`ART BY ${ARTIST.name.toUpperCase()} · “${art.artTitle.toUpperCase()}”`, PAD, y, W - PAD * 2);
  }
  y += 44;
  let size = 72;
  ctx.font = `600 ${size}px ${SAY}`;
  let q = wrap(ctx, v.topic, W - PAD * 2, 3);
  if (q.length > 2) { size = 62; ctx.font = `600 ${size}px ${SAY}`; q = wrap(ctx, v.topic, W - PAD * 2, 3); }
  ctx.fillStyle = C.text; ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18;
  for (const l of q) { ctx.fillText(l, PAD, y); y += Math.round(size * 1.16); }
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';

  // From the bottom up: the AI notice, the hosts, who moved the listener, then the crux in what's left.
  const notice = H - 64;
  const hostsTop = notice - 28 - 124;
  const verdictTop = v.verdict ? hostsTop - 52 : hostsTop;
  const cruxTurn = hasCrux(v.createdAt) ? v.turns.find(t => t.objective === 'Test') : undefined;
  const quote = cruxTurn ? { label: `THE CRUX · ${v.speakers[cruxTurn.speakerId].name.toUpperCase()}`, text: pointOf(cruxTurn.text), color: cruxTurn.speakerId === 'A' ? C.a : C.b }
    : art ? { label: `${ARTIST.name.toUpperCase()}, FROM THE BOOTH`, text: art.caption, color: C.iris } : null;
  const room = verdictTop - 24 - (y + 28);
  if (quote && room >= 34 + 44) {
    ctx.font = `italic 34px ${SAY}`;
    const lines = wrap(ctx, `“${quote.text}”`, W - PAD * 2 - 28, Math.min(3, Math.floor((room - 34) / 44)));
    // Spare room is shared above and below the quote, so nothing floats in a gap.
    const top = y + 28 + Math.round((room - (34 + lines.length * 44)) / 2);
    ctx.fillStyle = quote.color; ctx.fillRect(PAD, top + 2, 4, 34 + lines.length * 44 - 12);
    ctx.font = `18px ${TAG}`; ctx.fillText(quote.label, PAD + 24, top, W - PAD * 2 - 24);
    ctx.fillStyle = C.text; ctx.font = `italic 34px ${SAY}`;
    lines.forEach((l, i) => ctx.fillText(l, PAD + 24, top + 34 + i * 44));
  }
  if (v.verdict) {
    ctx.fillStyle = C.cue; ctx.font = `600 26px ${UI}`;
    ctx.fillText(`Who moved me: ${VERDICTS[v.verdict]}`, PAD, verdictTop, W - PAD * 2);
  }

  // The hosts, each with their seat letter (colour is never the only cue)
  const m = mindChange(v.turns);
  const hostW = (W - PAD * 2 - 24) / 2;
  (['A', 'B'] as const).forEach((k, i) => {
    const x = PAD + i * (hostW + 24), hy = hostsTop;
    ctx.fillStyle = C.surface; ctx.beginPath(); ctx.roundRect(x, hy, hostW, 124, 12); ctx.fill();
    ctx.fillStyle = k === 'A' ? C.a : C.b; ctx.fillRect(x, hy, 6, 124);
    ctx.beginPath(); ctx.roundRect(x + 24, hy + 22, 40, 40, 8); ctx.fill();
    ctx.fillStyle = '#141517'; ctx.font = `600 22px ${TAG}`; ctx.fillText(k, x + 37, hy + 31);
    ctx.fillStyle = C.text; ctx.font = `600 30px ${UI}`; ctx.fillText(wrap(ctx, v.speakers[k].name, hostW - 104, 1)[0] ?? '', x + 80, hy + 22);
    ctx.fillStyle = C.muted; ctx.font = `20px ${UI}`;
    ctx.fillText(wrap(ctx, hostSubtitle(v.speakers[k]), hostW - 104, 1)[0] ?? '', x + 80, hy + 60);
    const r = m[k];
    if (r.start != null) {
      ctx.fillStyle = k === 'A' ? C.a : C.b; ctx.font = `20px ${TAG}`;
      ctx.fillText(r.end != null ? `${r.start}% → ${r.end}% on yes` : `${r.start}% on yes`, x + 80, hy + 90);
    }
  });

  // Always labelled AI-generated
  ctx.fillStyle = C.muted; ctx.font = `20px ${UI}`;
  ctx.fillText(v.brief ? SCOUT_NOTICE : NOTICE, PAD, notice, W - PAD * 2);

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Couldn't draw the poster."))), 'image/png'));
}

/** The ground Iris paints on, so the band behind her art meets it without a seam. */
const ART_GROUND = '#0F1013';

export const viewBoxOf = (svg: string) => {
  const vb = svg.match(/viewBox="\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/);
  return { vw: Number(vb?.[1]) || 600, vh: Number(vb?.[2]) || 360 };
};

/**
 * Iris's sketch as an image, sized in pixels (some browsers won't draw a sizeless SVG). Pass the size
 * it will be drawn at: an SVG drawn larger than it was sized comes out soft.
 */
export async function loadSketch(svg: string, pw?: number, ph?: number) {
  const { vw, vh } = viewBoxOf(svg);
  const w = Math.round(pw ?? vw), h = Math.round(ph ?? (pw ? pw * vh / vw : vh));
  const sized = svg.replace(/^<svg\b/, `<svg width="${w}" height="${h}"`);
  return { img: await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`), vw, vh };
}

export const posterName = (v: ConversationView) => `crosstalk-ep${String(v.episode).padStart(2, '0')}-poster.png`;
