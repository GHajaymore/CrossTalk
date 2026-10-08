// The episode poster: a 1080×1350 image to share, drawn on the device (no server, no cost).
import { ARTIST, artworkSvg, episodeLabel, hostSubtitle, mindChange, MODES, NOTICE, SCOUT_NOTICE, VERDICTS, type ConversationView } from '@crosstalk/shared';

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
  await Promise.all([`600 64px ${SAY}`, `italic 36px ${SAY}`, `600 30px ${UI}`, `22px ${TAG}`].map(f => document.fonts?.load(f).catch(() => {})));
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

  // Brand mark and show line
  ctx.fillStyle = C.a; ctx.fillRect(PAD, PAD, 18, 40);
  ctx.fillStyle = C.b; ctx.fillRect(PAD + 24, PAD, 18, 40);
  ctx.fillStyle = C.text; ctx.font = `700 34px ${UI}`; ctx.textBaseline = 'top';
  ctx.fillText('CrossTalk', PAD + 60, PAD + 2);
  ctx.fillStyle = C.muted; ctx.font = `22px ${TAG}`;
  ctx.fillText(`${episodeLabel(v.episode).toUpperCase()} · ${MODES[v.mode].label.toUpperCase()}`, PAD, PAD + 70);

  // The question
  let y = PAD + 120;
  ctx.fillStyle = C.text; ctx.font = `600 64px ${SAY}`;
  for (const l of wrap(ctx, v.topic, W - PAD * 2, 3)) { ctx.fillText(l, PAD, y); y += 76; }

  // Iris's sketch, framed
  y += 24;
  const art = v.artist?.state === 'done' ? v.artist : null;
  // Room for the verdict line without ever touching the AI-generated notice at the bottom.
  const boxH = v.verdict ? 430 : 480;
  ctx.fillStyle = '#0e0d0c'; ctx.strokeStyle = C.line; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(PAD, y, W - PAD * 2, boxH, 16); ctx.fill(); ctx.stroke();
  if (art?.sketchSvg) {
    try {
      const { img, vw, vh } = await loadSketch(artworkSvg(art)!);
      const scale = Math.min((W - PAD * 2 - 40) / vw, (boxH - 40) / vh);
      const w = vw * scale, h = vh * scale;
      ctx.drawImage(img, (W - w) / 2, y + (boxH - h) / 2, w, h);
    } catch { /* the frame stays empty */ }
  }
  y += boxH + 26;

  // Her quote
  if (art) {
    ctx.fillStyle = C.iris; ctx.font = `italic 36px ${SAY}`;
    for (const l of wrap(ctx, `“${art.caption}”`, W - PAD * 2, 2)) { ctx.fillText(l, PAD, y); y += 46; }
    ctx.fillStyle = C.muted; ctx.font = `20px ${TAG}`;
    ctx.fillText(`${ARTIST.name.toUpperCase()} · “${art.artTitle.toUpperCase()}” · TURN ${art.momentSeq}`, PAD, y + 4, W - PAD * 2);
    y += 48;
  }

  // The hosts, each with their seat letter (colour is never the only cue)
  const m = mindChange(v.turns);
  const hostW = (W - PAD * 2 - 24) / 2;
  (['A', 'B'] as const).forEach((k, i) => {
    const x = PAD + i * (hostW + 24);
    ctx.fillStyle = C.surface; ctx.beginPath(); ctx.roundRect(x, y, hostW, 132, 12); ctx.fill();
    ctx.fillStyle = k === 'A' ? C.a : C.b; ctx.fillRect(x, y, 6, 132);
    ctx.beginPath(); ctx.roundRect(x + 24, y + 22, 40, 40, 8); ctx.fill();
    ctx.fillStyle = '#141517'; ctx.font = `600 22px ${TAG}`; ctx.fillText(k, x + 37, y + 31);
    ctx.fillStyle = C.text; ctx.font = `600 30px ${UI}`; ctx.fillText(wrap(ctx, v.speakers[k].name, hostW - 104, 1)[0] ?? '', x + 80, y + 26);
    ctx.fillStyle = C.muted; ctx.font = `20px ${UI}`;
    ctx.fillText(wrap(ctx, hostSubtitle(v.speakers[k]), hostW - 104, 1)[0] ?? '', x + 80, y + 64);
    const r = m[k];
    if (r.start != null) {
      ctx.fillStyle = k === 'A' ? C.a : C.b; ctx.font = `20px ${TAG}`;
      ctx.fillText(r.end != null ? `${r.start}% → ${r.end}% on yes` : `${r.start}% on yes`, x + 80, y + 96);
    }
  });
  y += 160;

  if (v.verdict) {
    ctx.fillStyle = C.cue; ctx.font = `600 28px ${UI}`;
    ctx.fillText(`Who moved me: ${VERDICTS[v.verdict]}`, PAD, y, W - PAD * 2); y += 44;
  }

  // Always labelled AI-generated
  ctx.fillStyle = C.muted; ctx.font = `20px ${UI}`;
  ctx.fillText(v.brief ? SCOUT_NOTICE : NOTICE, PAD, H - PAD - 10);

  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Couldn't draw the poster."))), 'image/png'));
}

/** Iris's sketch as an image with its own size from its viewBox (some browsers won't draw a sizeless SVG). */
export async function loadSketch(svg: string) {
  const vb = svg.match(/viewBox="\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/);
  const vw = Number(vb?.[1]) || 600, vh = Number(vb?.[2]) || 360;
  const sized = svg.replace(/^<svg\b/, `<svg width="${vw}" height="${vh}"`);
  return { img: await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`), vw, vh };
}

export const posterName = (v: ConversationView) => `crosstalk-ep${String(v.episode).padStart(2, '0')}-poster.png`;
