// The Iris print: her painting of the moment as a print-ready A4 page (2480×3508, 300 dpi), matted
// like a gallery print, drawn on the device. Plus listing text, should you ever offer prints; nothing
// is posted or sold automatically, and the listing always says the art is AI-made.
import { ARTIST, artworkSvg, episodeLabel, PAINT_STYLE_INFO, paintStyleOf, type ConversationView } from '@crosstalk/shared';
import { loadImage, SAY, TAG, UI, wrap } from './poster';

const W = 2480, H = 3508, M = 220;
const MAT = '#F3EEE4', INK = '#1E1C1A', SOFT = '#6E675E';

/** The art rasterised at print size (a small SVG drawn large would come out soft). */
async function artAt(svg: string, w: number) {
  const vb = svg.match(/viewBox="\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/);
  const vw = Number(vb?.[1]) || 600, vh = Number(vb?.[2]) || 360;
  const h = Math.round(w * (vh / vw));
  const sized = svg.replace(/^<svg\b/, `<svg width="${w}" height="${h}"`);
  return { img: await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`), h };
}

export async function makePrint(v: ConversationView): Promise<Blob> {
  const a = v.artist;
  const svg = artworkSvg(a);
  if (!a || !svg) throw new Error("Iris hasn't finished a drawing for this episode yet.");
  await Promise.all([`italic 600 120px ${SAY}`, `italic 64px ${SAY}`, `44px ${TAG}`, `40px ${UI}`].map(f => document.fonts?.load(f).catch(() => {})));
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = MAT; ctx.fillRect(0, 0, W, H);
  // A whisper of paper texture.
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(110,103,94,${(i % 7) / 220})`;
    ctx.fillRect((i * 7919) % W, (i * 104729) % H, 2, 2);
  }
  // Lay the words out first, so the whole piece can sit in the middle of the page.
  const artW = W - M * 2;
  const { img, h } = await artAt(svg, artW);
  ctx.font = `italic 600 120px ${SAY}`; const title = wrap(ctx, `“${a.artTitle}”`, W - M * 2, 2);
  ctx.font = `italic 64px ${SAY}`; const quote = wrap(ctx, `“${a.caption}”`, W - M * 2.6, 3);
  ctx.font = `40px ${UI}`; const from = wrap(ctx, `CrossTalk ${episodeLabel(v.episode)} · ${v.topic}`, W - M * 2, 2);
  const block = h + 260 + title.length * 140 + 30 + quote.length * 84 + 70 + 70 + from.length * 56;
  const top = Math.max(300, Math.round((H - 260 - block) / 2));

  // The painting, with a fine keyline, like a window mat.
  ctx.fillStyle = 'rgba(30,28,26,0.12)'; ctx.fillRect(M + 14, top + 18, artW, h);
  ctx.drawImage(img, M, top, artW, h);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(M - 24, top - 24, artW + 48, h + 48);

  let y = top + h + 260;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK; ctx.font = `italic 600 120px ${SAY}`;
  for (const l of title) { ctx.fillText(l, W / 2, y); y += 140; }
  y += 30;
  ctx.fillStyle = SOFT; ctx.font = `italic 64px ${SAY}`;
  for (const l of quote) { ctx.fillText(l, W / 2, y); y += 84; }
  y += 70;
  ctx.fillStyle = INK; ctx.font = `44px ${TAG}`;
  ctx.fillText(`${ARTIST.name.toUpperCase()}, ${ARTIST.role.toUpperCase()} · ${PAINT_STYLE_INFO[paintStyleOf(a.artStyle)].name.toUpperCase()}`, W / 2, y);
  y += 70;
  ctx.fillStyle = SOFT; ctx.font = `40px ${UI}`;
  for (const l of from) { ctx.fillText(l, W / 2, y); y += 56; }
  // Always labelled as AI-made.
  ctx.font = `34px ${UI}`;
  ctx.fillText('AI-generated artwork by Iris, an AI artist on CrossTalk.', W / 2, H - 170);
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Couldn't draw the print."))), 'image/png'));
}

export const printName = (v: ConversationView) => `crosstalk-ep${String(v.episode).padStart(2, '0')}-iris-print.png`;

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
