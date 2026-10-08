// Iris paints: her checked line sketch, re-rendered as a Painting or a Dreamscape. No image model and
// no network: just SVG filters around her own lines, so it is free, works in mock mode and adds no
// new drawing for the safety check to worry about. The same seed always gives the same picture.

/** The styles she can show today. "picture" (a full illustration) still needs an image model. */
export const PAINT_STYLES = ['sketch', 'painting', 'dreamscape'] as const;
export type PaintStyle = (typeof PAINT_STYLES)[number];

export const PAINT_STYLE_INFO: Record<PaintStyle, { name: string; what: string }> = {
  sketch: { name: 'Sketch', what: 'Her line drawing, crisp and clear' },
  painting: { name: 'Painting', what: 'Watercolour washes and inky lines on grained paper' },
  dreamscape: { name: 'Dreamscape', what: 'A drifting sky, echoes and glow, for big open ideas' },
};

const GROUND = '#0F1013';
const C = { amber: '#E8A55A', teal: '#5FB8B0', gold: '#E9D36A', lavender: '#B9A4E6', ink: '#ECE8E1' };

/** A small, stable number from any text (an episode id), so each episode gets its own brushwork. */
export function paintSeed(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) % 997 + 1;
}

/** A tiny repeatable random sequence (mulberry32). */
function rand(seed: number) {
  let a = seed * 7919;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parts(svg: string) {
  const open = svg.match(/^\s*<svg\b[^>]*>/i)?.[0] ?? '';
  const vb = open.match(/viewBox="([\d.\s-]+)"/)?.[1]?.trim().split(/\s+/).map(Number);
  const [x, y, w, h] = vb && vb.length === 4 && vb.every(Number.isFinite) ? vb : [0, 0, 600, 360];
  // Her lines, without the outer <svg> and without any background she painted (we paint our own).
  const lines = svg.slice(open.length).replace(/<\/svg>\s*$/i, '')
    .replace(new RegExp(`<rect\\b[^>]*fill="${GROUND}"[^>]*/>`, 'gi'), '');
  // Keep the line settings she put on the outer <svg> (fill="none", stroke-width…).
  const keep = [...open.matchAll(/\s(fill|stroke|stroke-width|stroke-linecap|stroke-linejoin|opacity)="([^"]*)"/g)].map(m => ` ${m[1]}="${m[2]}"`).join('');
  return { x, y, w, h, inner: keep ? `<g${keep}>${lines}</g>` : lines };
}

/**
 * Her sketch in the chosen style, as a standalone SVG. Show it only as an image (never as live
 * markup), like the sketch itself. "sketch" returns the drawing unchanged.
 */
export function paintSvg(svg: string, style: PaintStyle, seedText: string): string {
  if (style === 'sketch' || !svg) return svg;
  const { x, y, w, h, inner } = parts(svg);
  const seed = paintSeed(seedText);
  const r = rand(seed);
  const box = `x="${x}" y="${y}" width="${w}" height="${h}"`;
  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}">`;
  const grain = `<filter id="grain" ${box} filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="${seed}" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.93 0 0 0 0 0.91 0 0 0 0 0.88 0 0 0 0.09 0"/></filter>`;

  if (style === 'painting') {
    // Two loose colour washes bleeding out from her lines, then the lines themselves in wobbly ink.
    const tilt = (r() * 2 - 1).toFixed(2);
    return head + '<defs>'
      + `<filter id="wash" x="-15%" y="-15%" width="130%" height="130%"><feMorphology operator="dilate" radius="8"/><feGaussianBlur stdDeviation="8"/><feColorMatrix type="saturate" values="1.8" result="b"/><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="${seed}" result="n"/><feDisplacementMap in="b" in2="n" scale="46" xChannelSelector="R" yChannelSelector="G"/></filter>`
      + `<filter id="bloom" x="-15%" y="-15%" width="130%" height="130%"><feMorphology operator="dilate" radius="2"/><feGaussianBlur stdDeviation="3" result="b"/><feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="${seed + 7}" result="n"/><feDisplacementMap in="b" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G"/></filter>`
      + `<filter id="ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="1" seed="${seed + 3}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>`
      + grain
      + `<radialGradient id="light" cx="${(45 + r() * 10).toFixed(1)}%" cy="40%" r="75%"><stop offset="0" stop-color="${C.amber}" stop-opacity="0.16"/><stop offset="0.6" stop-color="${C.lavender}" stop-opacity="0.05"/><stop offset="1" stop-color="${GROUND}" stop-opacity="0"/></radialGradient>`
      + '</defs>'
      + `<rect ${box} fill="${GROUND}"/><rect ${box} fill="url(#light)"/>`
      + `<g filter="url(#wash)" opacity="0.36">${inner}</g>`
      + `<g filter="url(#wash)" opacity="0.22" transform="translate(${(r() * 10 - 5).toFixed(1)} ${(r() * 8 - 2).toFixed(1)}) rotate(${tilt} ${x + w / 2} ${y + h / 2})">${inner}</g>`
      + `<g filter="url(#bloom)" opacity="0.5">${inner}</g>`
      + `<g filter="url(#ink)" opacity="0.92">${inner}</g>`
      + `<rect ${box} filter="url(#grain)"/>`
      + '</svg>';
  }

  // Dreamscape: a soft sky, a scatter of stars, her lines drifting in coloured echoes, then glowing.
  const stars = Array.from({ length: 34 }, () => {
    const sx = (x + r() * w).toFixed(1), sy = (y + r() * h * 0.7).toFixed(1);
    return `<circle cx="${sx}" cy="${sy}" r="${(0.6 + r() * 1.4).toFixed(2)}" fill="${C.ink}" opacity="${(0.25 + r() * 0.6).toFixed(2)}"/>`;
  }).join('');
  const lake = y + h * 0.9;
  const moon = { cx: (x + w * (0.12 + r() * 0.76)).toFixed(1), cy: (y + h * (0.12 + r() * 0.12)).toFixed(1) };
  return head + '<defs>'
    + `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.lavender}" stop-opacity="0.34"/><stop offset="0.55" stop-color="${C.teal}" stop-opacity="0.12"/><stop offset="1" stop-color="${GROUND}" stop-opacity="0"/></linearGradient>`
    + `<radialGradient id="moon"><stop offset="0" stop-color="${C.gold}" stop-opacity="0.55"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></radialGradient>`
    + `<filter id="drift" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.007" numOctaves="2" seed="${seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="70" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="2.2"/><feColorMatrix type="hueRotate" values="${40 + Math.round(r() * 60)}"/></filter>`
    + `<filter id="glow" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="1" seed="${seed + 5}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="4" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="d"/></feMerge></filter>`
    + grain
    + '</defs>'
    + `<rect ${box} fill="${GROUND}"/><rect ${box} fill="url(#sky)"/>${stars}`
    + `<circle cx="${moon.cx}" cy="${moon.cy}" r="${(h * 0.16).toFixed(1)}" fill="url(#moon)"/>`
    + `<circle cx="${moon.cx}" cy="${moon.cy}" r="${(h * 0.045).toFixed(1)}" fill="none" stroke="${C.gold}" stroke-width="1.6" opacity="0.8"/>`
    + `<g filter="url(#drift)" opacity="0.45" transform="translate(${(-10 - r() * 10).toFixed(1)} ${(6 + r() * 8).toFixed(1)})">${inner}</g>`
    + `<g filter="url(#drift)" opacity="0.3" transform="translate(${(10 + r() * 12).toFixed(1)} ${(-4 - r() * 8).toFixed(1)})">${inner}</g>`
    + `<g filter="url(#glow)">${inner}</g>`
    // A still lake: her drawing reflected, squashed and faint, under the horizon.
    + `<g filter="url(#drift)" opacity="0.16" transform="matrix(1 0 0 -0.32 0 ${(lake * 1.32).toFixed(1)})">${inner}</g>`
    + `<rect x="${x}" y="${lake.toFixed(1)}" width="${w}" height="1" fill="${C.ink}" opacity="0.12"/>`
    + `<rect ${box} filter="url(#grain)"/>`
    + '</svg>';
}

/**
 * Iris's own pick when she hasn't said: practical, calm talk stays a sketch; big ideas dream; hot talk
 * paints. Only from the styles the listener has ticked; the next closest one if her first choice isn't.
 */
export function defaultPaintStyle(e: { mode: string; temperature: string }, allowed: readonly PaintStyle[] = PAINT_STYLES): PaintStyle {
  const order: PaintStyle[] = e.temperature === 'calm' ? ['sketch', 'painting', 'dreamscape']
    : e.mode === 'explore' ? ['dreamscape', 'painting', 'sketch'] : ['painting', 'dreamscape', 'sketch'];
  return order.find(s => allowed.includes(s)) ?? order[0];
}

/** The listener's ticked styles, cleaned up: known styles only, in order, never empty. */
export function cleanStyles(input: unknown): PaintStyle[] {
  const list = Array.isArray(input) ? PAINT_STYLES.filter(s => input.includes(s)) : [];
  return list.length ? list : [...PAINT_STYLES];
}

/** One saved piece in Iris's gallery: a drawing version, in one style. */
export type Artwork = { id: number; version: number; style: PaintStyle; title: string; caption: string; momentSeq: number; svg: string; createdAt: string };
/** An episode's shelf in the gallery: what's showing now, and everything she has made for it. */
export type GalleryEpisode = {
  conversationId: string; title: string; topic: string; episode: number; parentId: string | null; round: number;
  current: { version: number; style: PaintStyle } | null;
  artworks: Artwork[];
};

/** The style to show for saved art ("picture" isn't available yet, so it shows as a sketch). */
export const paintStyleOf = (s: string | null | undefined): PaintStyle => (PAINT_STYLES as readonly string[]).includes(s ?? '') ? s as PaintStyle : 'sketch';

/** Iris's finished art for an episode, in the style chosen for it, or null if there's no drawing. */
export function artworkSvg(a: { sketchSvg: string | null; artStyle: string; conversationId: string } | null | undefined): string | null {
  if (!a?.sketchSvg) return null;
  return paintSvg(a.sketchSvg, paintStyleOf(a.artStyle), a.conversationId);
}
