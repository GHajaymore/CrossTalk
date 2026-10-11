// The Iris print: her painting of the moment as a print-ready A4 page (2480×3508, 300 dpi), matted
// like a gallery print, drawn on the device. Plus listing text, should you ever offer prints; nothing
// is posted or sold automatically, and the listing always says the art is AI-made.
import { ARTIST, artworkSvg, episodeLabel, PAINT_STYLE_INFO, paintStyleOf, type ConversationView } from '@crosstalk/shared';
import { loadImage, SAY, TAG, UI, wrap } from './poster';
import { bestArt } from './irisArt';

/** Paper sizes people actually print at, portrait, in inches. */
export const PAPERS = {
  '5x7': { label: '5 × 7 in', w: 5, h: 7 },
  '8x10': { label: '8 × 10 in', w: 8, h: 10 },
  a4: { label: 'A4', w: 8.27, h: 11.69 },
  '11x14': { label: '11 × 14 in', w: 11, h: 14 },
  a3: { label: 'A3', w: 11.69, h: 16.54 },
  '18x24': { label: '18 × 24 in poster', w: 18, h: 24 },
} as const;
export type PaperKey = keyof typeof PAPERS;

// Phones can't draw a canvas much bigger than about 16 million pixels, so the largest sizes come out a
// little under 300 dpi (still poster-sharp at viewing distance); the vector file has no limit at all.
const MAX_PX = 16_000_000;
export function paperPixels(k: PaperKey) {
  const p = PAPERS[k];
  const dpi = Math.min(300, Math.floor(Math.sqrt(MAX_PX / (p.w * p.h))));
  return { w: Math.round(p.w * dpi), h: Math.round(p.h * dpi), dpi };
}
const MAT = '#F3EEE4', INK = '#1E1C1A', SOFT = '#6E675E';

/** The art rasterised at print size (a small SVG drawn large would come out soft). */
async function artAt(svg: string, w: number) {
  const vb = svg.match(/viewBox="\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/);
  const vw = Number(vb?.[1]) || 600, vh = Number(vb?.[2]) || 360;
  const h = Math.round(w * (vh / vw));
  const sized = svg.replace(/^<svg\b/, `<svg width="${w}" height="${h}"`);
  return { img: await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`), h };
}

export type PrintArt = 'line' | 'picture';
/** The print file: her art matted on a page of the chosen size. 'line' draws her vector line art at full resolution; 'picture' uses her AI picture (sharp only up to its own size). */
export async function makePrint(v: ConversationView, paper: PaperKey = 'a4', art: PrintArt = 'picture'): Promise<Blob> {
  const { w: W, h: H } = paperPixels(paper);
  const k = W / 2480, M = Math.round(220 * k);
  const px = (n: number) => Math.round(n * k);
  const a = v.artist;
  const svg = artworkSvg(a);
  if (!a || !svg) throw new Error("Iris hasn't finished a drawing for this episode yet.");
  await Promise.all([`italic 600 ${px(120)}px ${SAY}`, `italic ${px(64)}px ${SAY}`, `${px(44)}px ${TAG}`, `${px(40)}px ${UI}`].map(f => document.fonts?.load(f).catch(() => {})));
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  // Art is drawn larger than it was made: the browser's best scaling keeps it sharp (its default is the softest).
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = MAT; ctx.fillRect(0, 0, W, H);
  // A whisper of paper texture.
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(110,103,94,${(i % 7) / 220})`;
    ctx.fillRect((i * 7919) % W, (i * 104729) % H, px(2) || 1, px(2) || 1);
  }
  // Lay the words out first, so the whole piece can sit in the middle of the page.
  const artW = W - M * 2;
  // Her AI picture when it's ready, otherwise the one she paints here; her line art (drawn at print size) for line styles.
  const best = art === 'picture' ? await bestArt(v).catch(() => null) : null;
  const painted = best ? await loadImage(best).catch(() => null) : null;
  const { img, h } = painted ? { img: painted, h: Math.round(artW * (painted.height / painted.width)) } : await artAt(svg, artW);
  if (painted?.src.startsWith('blob:')) URL.revokeObjectURL(painted.src);
  ctx.font = `italic 600 ${px(120)}px ${SAY}`; const title = wrap(ctx, `“${a.artTitle}”`, W - M * 2, 2);
  ctx.font = `italic ${px(64)}px ${SAY}`; const quote = wrap(ctx, `“${a.caption}”`, W - M * 2.6, 3);
  ctx.font = `${px(40)}px ${UI}`; const from = wrap(ctx, `CrossTalk ${episodeLabel(v.episode)} · ${v.topic}`, W - M * 2, 2);
  const block = h + px(260) + title.length * px(140) + px(30) + quote.length * px(84) + px(70) + px(70) + from.length * px(56);
  const top = Math.max(px(300), Math.round((H - px(260) - block) / 2));

  // The painting, with a fine keyline, like a window mat.
  ctx.fillStyle = 'rgba(30,28,26,0.12)'; ctx.fillRect(M + px(14), top + px(18), artW, h);
  ctx.drawImage(img, M, top, artW, h);
  ctx.strokeStyle = INK; ctx.lineWidth = px(3) || 1; ctx.strokeRect(M - px(24), top - px(24), artW + px(48), h + px(48));

  let y = top + h + px(260);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK; ctx.font = `italic 600 ${px(120)}px ${SAY}`;
  for (const l of title) { ctx.fillText(l, W / 2, y); y += px(140); }
  y += px(30);
  ctx.fillStyle = SOFT; ctx.font = `italic ${px(64)}px ${SAY}`;
  for (const l of quote) { ctx.fillText(l, W / 2, y); y += px(84); }
  y += px(70);
  ctx.fillStyle = INK; ctx.font = `${px(44)}px ${TAG}`;
  // Name the style actually on the page: without her AI picture, a Picture is shown as her Painting.
  const shown = paintStyleOf(a.artStyle) === 'picture' && !painted ? 'painting' : paintStyleOf(a.artStyle);
  ctx.fillText(`${ARTIST.name.toUpperCase()}, ${ARTIST.role.toUpperCase()} · ${PAINT_STYLE_INFO[shown].name.toUpperCase()}`, W / 2, y);
  y += px(70);
  ctx.fillStyle = SOFT; ctx.font = `${px(40)}px ${UI}`;
  for (const l of from) { ctx.fillText(l, W / 2, y); y += px(56); }
  // Always labelled as AI-made.
  ctx.font = `${px(34)}px ${UI}`;
  ctx.fillText('AI-generated artwork by Iris, an AI artist on CrossTalk.', W / 2, H - px(170));
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Couldn't draw the print."))), 'image/png'));
}

export const printName = (v: ConversationView, paper: PaperKey = 'a4') => `crosstalk-ep${String(v.episode).padStart(2, '0')}-iris-${paper}.png`;

/** Her art alone as a vector file (SVG): no pixels, so it scales to any size a print shop needs. */
export function vectorArt(v: ConversationView): Blob | null {
  const svg = artworkSvg(v.artist);
  if (!svg) return null;
  // No fixed width or height: the file fills whatever size it's printed at.
  const scalable = svg.replace(/^<svg\b([^>]*?)\s(width|height)="[^"]*"/, '<svg$1').replace(/^<svg\b([^>]*?)\s(width|height)="[^"]*"/, '<svg$1');
  return new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${scalable}`], { type: 'image/svg+xml' });
}
export const vectorName = (v: ConversationView) => `crosstalk-ep${String(v.episode).padStart(2, '0')}-iris-vector.svg`;

/** Listing text for a print shop, ready to paste. Honest that the art is AI-made. */
export function printListing(v: ConversationView): string {
  const a = v.artist;
  if (!a) return '';
  return [
    `“${a.artTitle}”, by ${ARTIST.name} (AI artist) · A4 art print`,
    '',
    `${ARTIST.name}, the AI artist who listens in on CrossTalk, painted this after ${episodeLabel(v.episode)}: “${v.topic}”. It captures the moment that stayed with her: “${a.caption}”`,
    '',
    `Style: ${PAINT_STYLE_INFO[paintStyleOf(a.artStyle)].name}. Print-ready at A4, 300 dpi.`,
    'This artwork is AI-generated.',
  ].join('\n');
}
