// Iris paints: her checked line sketch, re-rendered as a Painting or a Dreamscape. No image model and
// no network: just SVG filters around her own lines, so it is free, works in mock mode and adds no
// new drawing for the safety check to worry about. The same seed always gives the same picture.

/**
 * The styles you tick for her on the Iris page. "picture" is a full painted illustration made by a free
 * image service from her own brief; until it arrives (or if it can't be made) her Painting stands in.
 */
export const PAINT_STYLES = ['picture', 'sketch', 'painting', 'dreamscape'] as const;
/**
 * Styles from the hosts' homes: broad art traditions, never a named artist. Iris may use one only
 * when a host comes from that part of the world (see HOME_ART), and only while you leave them on.
 */
export const HOME_STYLES = ['inkwash', 'folk', 'tiles', 'miniature', 'woven'] as const;
export const ART_STYLES = [...PAINT_STYLES, ...HOME_STYLES] as const;
export type PaintStyle = (typeof ART_STYLES)[number];
export type HomeStyle = (typeof HOME_STYLES)[number];

export const PAINT_STYLE_INFO: Record<PaintStyle, { name: string; what: string }> = {
  picture: { name: 'Picture', what: 'A full painted illustration of the moment, from her own art brief' },
  sketch: { name: 'Sketch', what: 'Her line drawing, crisp and clear' },
  painting: { name: 'Painting', what: 'Watercolour washes and inky lines on grained paper' },
  dreamscape: { name: 'Dreamscape', what: 'A drifting sky, echoes and glow, for big open ideas' },
  inkwash: { name: 'Ink wash', what: 'Brush and ink on pale paper with a red seal, from the East Asian ink-painting tradition' },
  folk: { name: 'Folk colour', what: 'Cut-paper bunting and bold colour, from Latin American folk art' },
  tiles: { name: 'Tile pattern', what: 'Her lines over geometric tilework, from Middle Eastern and North African pattern traditions' },
  miniature: { name: 'Miniature', what: 'A jewel-toned scene in an ornate gold border, from South Asian miniature painting' },
  woven: { name: 'Woven border', what: 'Bold woven-strip borders in earth and bright tones, from African textile traditions' },
};
export const isHomeStyle = (s: string): s is HomeStyle => (HOME_STYLES as readonly string[]).includes(s);

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
  // The real picture is an image of its own; in line-art places (and while it's being made) her Painting stands in.
  if (style === 'picture') return paintSvg(svg, 'painting', seedText);
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

  if (style !== 'dreamscape') return homeStyle(style, { x, y, w, h, inner, seed, r, box, head, grain });

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

type Canvas = { x: number; y: number; w: number; h: number; inner: string; seed: number; r: () => number; box: string; head: string; grain: string };
const f1 = (n: number) => n.toFixed(1);

/** The five home styles. Each keeps her lines as the subject and adds the tradition around them. */
function homeStyle(style: HomeStyle, { x, y, w, h, inner, seed, r, box, head, grain }: Canvas): string {
  const wobble = `<filter id="ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="1" seed="${seed + 3}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G"/></filter>`;
  const glow = `<filter id="glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3.5" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

  if (style === 'inkwash') {
    // Pale paper, her lines turned to brushed black ink with a soft grey wash, and a small red seal.
    const paper = '#ECE4D3';
    const sx = x + w * (0.8 + r() * 0.08), sy = y + h * (0.72 + r() * 0.1), ss = Math.min(w, h) * 0.07;
    return head + '<defs>'
      + `<filter id="brush" x="-5%" y="-5%" width="110%" height="110%"><feColorMatrix values="0 0 0 0 0.09 0 0 0 0 0.09 0 0 0 0 0.1 0 0 0 1 0" result="k"/><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="${seed}" result="n"/><feDisplacementMap in="k" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>`
      + `<filter id="wash" x="-15%" y="-15%" width="130%" height="130%"><feColorMatrix values="0 0 0 0 0.2 0 0 0 0 0.21 0 0 0 0 0.22 0 0 0 1 0"/><feMorphology operator="dilate" radius="6"/><feGaussianBlur stdDeviation="9" result="b"/><feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" seed="${seed + 1}" result="n"/><feDisplacementMap in="b" in2="n" scale="30" xChannelSelector="R" yChannelSelector="G"/></filter>`
      + `<filter id="paper" ${box} filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" seed="${seed}"/><feColorMatrix values="0 0 0 0 0.45 0 0 0 0 0.4 0 0 0 0 0.32 0 0 0 0.12 0"/></filter>`
      + '</defs>'
      + `<rect ${box} fill="${paper}"/><rect ${box} filter="url(#paper)"/>`
      + `<g filter="url(#wash)" opacity="0.28">${inner}</g>`
      + `<g filter="url(#brush)" opacity="0.92">${inner}</g>`
      + `<rect x="${f1(sx)}" y="${f1(sy)}" width="${f1(ss)}" height="${f1(ss)}" rx="2" fill="#B8352B" opacity="0.88"/>`
      + `<rect x="${f1(sx + ss * 0.2)}" y="${f1(sy + ss * 0.2)}" width="${f1(ss * 0.6)}" height="${f1(ss * 0.6)}" fill="none" stroke="${paper}" stroke-width="1.6" opacity="0.8"/>`
      + '</svg>';
  }

  if (style === 'folk') {
    // A warm night, her lines in bold colour, and a string of cut-paper flags across the top.
    const colours = ['#E8A55A', '#E0607E', '#5FB8B0', '#E9D36A', '#B9A4E6', '#7BC86C'];
    const n = 9, fw = w / n, top = y + h * 0.04;
    const flags = Array.from({ length: n }, (_, i) => {
      const fx = x + i * fw, c = colours[(i + Math.floor(r() * 3)) % colours.length], dip = Math.sin((i + 0.5) / n * Math.PI) * h * 0.05;
      const fy = top + dip;
      return `<path d="M${f1(fx + 3)} ${f1(fy)} L${f1(fx + fw - 3)} ${f1(fy)} L${f1(fx + fw - 3)} ${f1(fy + h * 0.13)} L${f1(fx + fw / 2)} ${f1(fy + h * 0.1)} L${f1(fx + 3)} ${f1(fy + h * 0.13)} Z" fill="${c}" opacity="0.85"/>`
        + `<circle cx="${f1(fx + fw / 2)}" cy="${f1(fy + h * 0.045)}" r="${f1(fw * 0.09)}" fill="${GROUND}" opacity="0.8"/>`
        + `<path d="M${f1(fx + fw * 0.3)} ${f1(fy + h * 0.08)} l${f1(fw * 0.08)} -${f1(fw * 0.08)} l${f1(fw * 0.08)} ${f1(fw * 0.08)} l${f1(fw * 0.08)} -${f1(fw * 0.08)} l${f1(fw * 0.08)} ${f1(fw * 0.08)}" fill="none" stroke="${GROUND}" stroke-width="1.6" opacity="0.7"/>`;
    }).join('');
    const string = `<path d="M${x} ${f1(top)} Q${f1(x + w / 2)} ${f1(top + h * 0.1)} ${x + w} ${f1(top)}" fill="none" stroke="${C.ink}" stroke-width="1.2" opacity="0.5"/>`;
    return head + '<defs>' + `<filter id="vivid" x="-10%" y="-10%" width="120%" height="120%"><feColorMatrix type="saturate" values="1.9"/><feGaussianBlur stdDeviation="2.5" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` + wobble + grain
      + `<radialGradient id="warm" cx="50%" cy="65%" r="70%"><stop offset="0" stop-color="#E0607E" stop-opacity="0.18"/><stop offset="1" stop-color="${GROUND}" stop-opacity="0"/></radialGradient>`
      + '</defs>'
      + `<rect ${box} fill="${GROUND}"/><rect ${box} fill="url(#warm)"/>`
      + `<g filter="url(#vivid)"><g filter="url(#ink)">${inner}</g></g>`
      + string + flags
      + `<rect ${box} filter="url(#grain)"/>` + '</svg>';
  }

  if (style === 'tiles') {
    // Eight-point star tilework behind a soft arch, her lines glowing in front.
    const t = Math.min(w, h) / 6;
    const star = (cx: number, cy: number, s: number) => {
      const pts = Array.from({ length: 16 }, (_, i) => { const a = Math.PI / 8 * i, rr = i % 2 ? s * 0.55 : s; return `${f1(cx + Math.cos(a) * rr)},${f1(cy + Math.sin(a) * rr)}`; }).join(' ');
      return `<polygon points="${pts}"/>`;
    };
    const pattern = `<pattern id="tile" x="${x}" y="${y}" width="${f1(t)}" height="${f1(t)}" patternUnits="userSpaceOnUse"><g fill="none" stroke="${C.teal}" stroke-width="1.2" opacity="0.55">${star(t / 2, t / 2, t * 0.42)}<rect x="0" y="0" width="${f1(t)}" height="${f1(t)}" stroke="${C.gold}" opacity="0.4"/></g><circle cx="${f1(t / 2)}" cy="${f1(t / 2)}" r="${f1(t * 0.08)}" fill="${C.gold}" opacity="0.45"/></pattern>`;
    const aw = w * 0.62, ax = x + (w - aw) / 2, ab = y + h * 0.96, at = y + h * 0.1;
    const arch = `M${f1(ax)} ${f1(ab)} L${f1(ax)} ${f1(at + aw * 0.42)} Q${f1(ax)} ${f1(at)} ${f1(x + w / 2)} ${f1(at - h * 0.02)} Q${f1(ax + aw)} ${f1(at)} ${f1(ax + aw)} ${f1(at + aw * 0.42)} L${f1(ax + aw)} ${f1(ab)} Z`;
    return head + '<defs>' + pattern + glow + grain + `<clipPath id="arch"><path d="${arch}"/></clipPath>` + '</defs>'
      + `<rect ${box} fill="${GROUND}"/><rect ${box} fill="url(#tile)" opacity="${f1(0.55 + r() * 0.2)}"/>`
      + `<path d="${arch}" fill="${GROUND}" opacity="0.88"/><path d="${arch}" fill="none" stroke="${C.gold}" stroke-width="2.4" opacity="0.75"/>`
      + `<g filter="url(#glow)">${inner}</g>`
      + `<rect ${box} filter="url(#grain)"/>` + '</svg>';
  }

  if (style === 'miniature') {
    // A deep jewel-blue panel in a double gold frame with a running border of small flowers.
    const m = Math.min(w, h) * 0.06, step = m * 1.4;
    const flowers: string[] = [];
    for (let px = x + m * 1.2; px < x + w - m; px += step) for (const py of [y + m / 2, y + h - m / 2]) flowers.push(`<circle cx="${f1(px)}" cy="${f1(py)}" r="${f1(m * 0.22)}" fill="${C.gold}" opacity="0.8"/><circle cx="${f1(px)}" cy="${f1(py)}" r="${f1(m * 0.42)}" fill="none" stroke="#E0607E" stroke-width="1.2" opacity="0.7"/>`);
    for (let py = y + m * 1.2; py < y + h - m; py += step) for (const px of [x + m / 2, x + w - m / 2]) flowers.push(`<circle cx="${f1(px)}" cy="${f1(py)}" r="${f1(m * 0.22)}" fill="${C.gold}" opacity="0.8"/><circle cx="${f1(px)}" cy="${f1(py)}" r="${f1(m * 0.42)}" fill="none" stroke="${C.teal}" stroke-width="1.2" opacity="0.7"/>`);
    return head + '<defs>' + glow + grain
      + `<linearGradient id="jewel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B2A55"/><stop offset="1" stop-color="#2A1838"/></linearGradient>`
      + '</defs>'
      + `<rect ${box} fill="#3A2412"/>` + flowers.join('')
      + `<rect x="${f1(x + m)}" y="${f1(y + m)}" width="${f1(w - 2 * m)}" height="${f1(h - 2 * m)}" fill="url(#jewel)" stroke="${C.gold}" stroke-width="3"/>`
      + `<rect x="${f1(x + m * 1.35)}" y="${f1(y + m * 1.35)}" width="${f1(w - 2.7 * m)}" height="${f1(h - 2.7 * m)}" fill="none" stroke="${C.gold}" stroke-width="1" opacity="0.7"/>`
      + `<g transform="translate(${f1(x + w / 2)} ${f1(y + h / 2)}) scale(0.84) translate(${f1(-(x + w / 2))} ${f1(-(y + h / 2))})"><g filter="url(#glow)">${inner}</g></g>`
      + `<rect ${box} filter="url(#grain)"/>` + '</svg>';
  }

  // Woven border: bands of woven strips top and bottom, in earth and bright tones, her lines between.
  const band = h * 0.12, cell = band / 2;
  const tones = ['#E8A55A', '#2B1D12', '#E9D36A', '#5FB8B0', '#B8352B', '#ECE8E1'];
  const strips: string[] = [];
  for (const by of [y, y + h - band]) {
    for (let i = 0, px = x; px < x + w; i++, px += cell) {
      const c1 = tones[(i + Math.floor(r() * 2)) % tones.length], c2 = tones[(i + 3) % tones.length];
      strips.push(`<rect x="${f1(px)}" y="${f1(by)}" width="${f1(cell)}" height="${f1(cell)}" fill="${c1}" opacity="0.85"/><rect x="${f1(px)}" y="${f1(by + cell)}" width="${f1(cell)}" height="${f1(cell)}" fill="${c2}" opacity="0.85"/>`);
      if (i % 3 === 0) strips.push(`<path d="M${f1(px)} ${f1(by + cell)} l${f1(cell / 2)} -${f1(cell / 2)} l${f1(cell / 2)} ${f1(cell / 2)} l-${f1(cell / 2)} ${f1(cell / 2)} Z" fill="${GROUND}" opacity="0.7"/>`);
    }
  }
  return head + '<defs>' + glow + wobble + grain + '</defs>'
    + `<rect ${box} fill="#1A130D"/>` + strips.join('')
    + `<rect x="${x}" y="${f1(y + band)}" width="${w}" height="2" fill="${C.gold}" opacity="0.6"/><rect x="${x}" y="${f1(y + h - band - 2)}" width="${w}" height="2" fill="${C.gold}" opacity="0.6"/>`
    + `<g transform="translate(${f1(x + w / 2)} ${f1(y + h / 2)}) scale(0.78) translate(${f1(-(x + w / 2))} ${f1(-(y + h / 2))})"><g filter="url(#glow)"><g filter="url(#ink)">${inner}</g></g></g>`
    + `<rect ${box} filter="url(#grain)"/>` + '</svg>';
}

/**
 * Iris's own pick when she hasn't said: practical, calm talk stays a sketch; big ideas dream; hot talk
 * paints. Only from the styles the listener has ticked; the next closest one if her first choice isn't.
 */
export function defaultPaintStyle(e: { mode: string; temperature: string }, allowed: readonly PaintStyle[] = PAINT_STYLES): PaintStyle {
  // Her full painting first (it carries the hosts' home traditions too); then a home style, which is
  // only in `allowed` when it fits this episode; then her own feel for the talk.
  const order: PaintStyle[] = ['picture', ...allowed.filter(isHomeStyle), ...(e.temperature === 'calm' ? ['sketch', 'painting', 'dreamscape'] as const
    : e.mode === 'explore' ? ['dreamscape', 'painting', 'sketch'] as const : ['painting', 'dreamscape', 'sketch'] as const)];
  return order.find(s => allowed.includes(s)) ?? allowed[0] ?? 'painting';
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
export const paintStyleOf = (s: string | null | undefined): PaintStyle => (ART_STYLES as readonly string[]).includes(s ?? '') ? s as PaintStyle : 'sketch';

/** Iris's finished art for an episode, in the style chosen for it, or null if there's no drawing. */
export function artworkSvg(a: { sketchSvg: string | null; artStyle: string; conversationId: string; version?: number } | null | undefined): string | null {
  if (!a?.sketchSvg) return null;
  return paintSvg(a.sketchSvg, paintStyleOf(a.artStyle), artSeed(a.conversationId, a.version));
}

/**
 * The brushwork seed for one version of a drawing: stable for that version (a gallery never shifts
 * under you), fresh for every new one. Version 1 keeps the episode's own seed, as before.
 */
export const artSeed = (conversationId: string, version = 1) => (version > 1 ? `${conversationId}:v${version}` : conversationId);
