// Iris's own painting engine, on this device: no image service, no cost, always there. From her
// sketch (the subject), her art brief (colours and mood) and a seed (so a piece never changes), it
// paints a layered picture: a lit ground, soft underpainting, thousands of brushstrokes flowing along
// a current, her subject built up out of brighter, denser strokes, then glow, mist, grain and a
// vignette. It can paint itself in front of you, stroke by stroke.

export const ART_W = 1024;
export const ART_H = 614;

type RGB = [number, number, number];

// Colour words an art brief tends to use, and what Iris mixes for each.
const COLOURS: Record<string, string> = {
  ochre: '#c98a2b', amber: '#e0a030', gold: '#d9a93a', golden: '#e2b24a', honey: '#e5a84a', saffron: '#f0a32a', mustard: '#c9a227',
  lemon: '#ecd56a', yellow: '#e8c547', apricot: '#f2a06a', peach: '#f3b38f', coral: '#ef7f68', salmon: '#ee8f7a', orange: '#e57a2e',
  rust: '#a9472a', copper: '#b8673a', bronze: '#a6773a', sienna: '#a0522d', umber: '#5e4026', terracotta: '#c4643f', brick: '#9b3b2a',
  vermilion: '#e2412e', scarlet: '#d8312b', crimson: '#b5203a', red: '#c73a35', burgundy: '#6d1f2f', maroon: '#6a2131', wine: '#6e2240',
  rose: '#d9718a', blush: '#e9a3a8', pink: '#e48aa6', fuchsia: '#c83e8e', magenta: '#b8337f', plum: '#6b3a63', violet: '#7a55b0',
  purple: '#6b4a9a', lavender: '#a99be0', lilac: '#b9a3d8', mauve: '#a07a96', indigo: '#3b3f8f', ultramarine: '#2e44a8', cobalt: '#2d5ab3',
  navy: '#1d2b52', midnight: '#151a38', blue: '#3a6db5', azure: '#3f8fd8', cerulean: '#3b8ec4', sky: '#8fc3e8', teal: '#2a8c8c',
  turquoise: '#3cb7a8', cyan: '#4ac2d0', aqua: '#5fd0c8', jade: '#3a9a6e', emerald: '#2f8f5b', green: '#4c8a4a', forest: '#2f5a37',
  moss: '#6b7a3a', olive: '#7a7a3a', sage: '#9aaf8a', mint: '#9fd8b8', lime: '#a8c94a', sand: '#d8c39a', beige: '#d6c3a0', tan: '#c19a6b',
  cream: '#efe3c8', ivory: '#f1ead8', pearl: '#e9e4dc', white: '#f2efe9', silver: '#b9bcc4', grey: '#8a8d96', gray: '#8a8d96',
  slate: '#56607a', smoke: '#7d7f88', charcoal: '#2d2f36', ink: '#1a1b26', black: '#14141a', brown: '#6b4a32', chocolate: '#4e3224',
};

// When a brief names no colours: a few palettes she loves, dark to light.
const PALETTES: string[][] = [
  ['#120f24', '#3b2f6b', '#c0577a', '#f0a35e', '#f7e2b8'],
  ['#0b1a24', '#1f5a6b', '#3fa3a0', '#e7c873', '#f5efd9'],
  ['#1a1012', '#5a1f2c', '#b8473a', '#e8a04a', '#f6e6c4'],
  ['#0e1420', '#283e6b', '#6b8fd8', '#c9b6f0', '#f4f1fb'],
  ['#10160f', '#2f4a2c', '#7a9a4a', '#e0c46a', '#f3ecd2'],
  ['#160d1c', '#4a2a5e', '#9a4f9a', '#f08a7a', '#fbe2d0'],
];

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lum = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const dist = (a: RGB, b: RGB) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
const css = (c: RGB, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a.toFixed(3)})`;

export function hashText(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Palette = { dark: RGB; deep: RGB; mids: RGB[]; light: RGB; accent: RGB };

/** Her palette for a piece: the colours her brief names (in its order), or one of hers; always with a deep dark and a light. */
export function paletteFor(brief: string, seed: number): Palette {
  const words = brief.toLowerCase().match(/[a-z]+/g) ?? [];
  const named: RGB[] = [];
  for (const w of words) {
    const c = COLOURS[w] ?? COLOURS[w.replace(/s$/, '')];
    if (c && !named.some(n => n.join() === hex(c).join())) named.push(hex(c));
  }
  const base = named.length >= 2 ? named : PALETTES[seed % PALETTES.length].map(hex);
  const sorted = [...base].sort((a, b) => lum(a) - lum(b));
  const night: RGB = [12, 11, 20];
  // The darkest colour, pushed deep enough to carry light; the lightest, lifted toward warm white.
  const dark = lum(sorted[0]) > 60 ? mix(sorted[0], night, 0.75) : mix(sorted[0], night, 0.35);
  const light = lum(sorted[sorted.length - 1]) < 170 ? mix(sorted[sorted.length - 1], [250, 244, 230], 0.55) : sorted[sorted.length - 1];
  const mids = sorted.slice(named.length >= 2 ? 0 : 1, -1).filter(c => lum(c) > 25);
  if (!mids.length) mids.push(mix(dark, light, 0.5));
  // The accent: the most colourful of what's left.
  const chroma = (c: RGB) => Math.max(...c) - Math.min(...c);
  const accent = [...mids].sort((a, b) => chroma(b) - chroma(a))[0];
  return { dark, deep: mix(dark, night, 0.5), mids, light, accent };
}

export type Mood = { night: boolean; warm: boolean; mist: number; water: boolean; storm: boolean };
/** A few words in her brief that change the light. */
export function moodFor(brief: string): Mood {
  const b = brief.toLowerCase();
  return {
    night: /\b(night|midnight|moon|moonlit|stars?|starlit|dark)\b/.test(b),
    warm: /\b(dawn|sunrise|sunset|dusk|golden|glow|lamp|candle|warm|evening)\b/.test(b),
    mist: /\b(mist|misty|fog|foggy|haze|hazy|smoke)\b/.test(b) ? 0.55 : /\b(rain|soft|dream|dreamy)\b/.test(b) ? 0.3 : 0.15,
    water: /\b(sea|ocean|river|water|lake|waves?|tide|rain)\b/.test(b),
    storm: /\b(storm|stormy|wind|turbulent|chaos|fire|flames?)\b/.test(b),
  };
}

// Smooth value noise, for the current the brushstrokes follow.
function noise2(seed: number) {
  const r = rng(seed);
  const p = Array.from({ length: 512 }, () => r());
  const at = (x: number, y: number) => p[((x & 255) * 7 + (y & 255) * 131) & 511];
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    const u = s(xf), v = s(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** A soft blur that works in every browser: shrink, then grow back smoothly. */
function softened(src: HTMLCanvasElement, factor: number) {
  const s = document.createElement('canvas');
  s.width = Math.max(1, Math.round(src.width / factor)); s.height = Math.max(1, Math.round(src.height / factor));
  const sc = s.getContext('2d')!;
  sc.imageSmoothingEnabled = true; sc.imageSmoothingQuality = 'high';
  sc.drawImage(src, 0, 0, s.width, s.height);
  const out = document.createElement('canvas');
  out.width = src.width; out.height = src.height;
  const oc = out.getContext('2d')!;
  oc.imageSmoothingEnabled = true; oc.imageSmoothingQuality = 'high';
  oc.drawImage(s, 0, 0, out.width, out.height);
  return out;
}

/** Her sketch as a picture the size of the canvas (fitted, centred), or null if it can't be drawn. */
async function sketchLayer(svg: string): Promise<HTMLCanvasElement | null> {
  if (!svg) return null;
  const vb = svg.match(/viewBox="\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/);
  const vw = vb ? Number(vb[3]) : 400, vh = vb ? Number(vb[4]) : 240;
  // Some browsers only draw an SVG with a size of its own.
  const sized = /<svg[^>]*\swidth=/.test(svg) ? svg : svg.replace('<svg', `<svg width="${vw}" height="${vh}"`);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
  try { await img.decode(); } catch { return null; }
  const c = document.createElement('canvas');
  c.width = ART_W; c.height = ART_H;
  const ctx = c.getContext('2d')!;
  const k = Math.min(ART_W / vw, ART_H / vh) * 0.92;
  const w = vw * k, h = vh * k;
  ctx.drawImage(img, (ART_W - w) / 2, (ART_H - h) / 2, w, h);
  // Keep only her marks: her sketches sit on a filled background, which isn't part of the subject.
  try {
    const d = ctx.getImageData(0, 0, ART_W, ART_H);
    const px = d.data;
    const at = (x: number, y: number) => (Math.round(y) * ART_W + Math.round(x)) * 4;
    const corner = at((ART_W - w) / 2 + 3, (ART_H - h) / 2 + 3);
    const bg: RGB = [px[corner], px[corner + 1], px[corner + 2]];
    const hasBg = px[corner + 3] > 200;
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue;
      const dist = Math.abs(px[i] - bg[0]) + Math.abs(px[i + 1] - bg[1]) + Math.abs(px[i + 2] - bg[2]);
      if (hasBg) px[i + 3] = Math.min(px[i + 3], Math.max(0, (dist - 30) * 3));
    }
    ctx.putImageData(d, 0, 0);
  } catch { return null; }
  return c;
}

export type PaintOptions = { animate?: boolean; signal?: AbortSignal; onDone?: () => void };

/** Paints one piece onto `canvas` (1024×614). Resolves when it's finished (or stopped). */
export async function paintIris(canvas: HTMLCanvasElement, input: { sketch: string; seed: string; brief?: string }, o: PaintOptions = {}) {
  canvas.width = ART_W; canvas.height = ART_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const seed = hashText(input.seed);
  const r = rng(seed);
  const brief = input.brief ?? '';
  const pal = paletteFor(brief, seed);
  const mood = moodFor(brief);
  const n = noise2(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const colourAt = (x: number, y: number): RGB => {
    // Colours drift across the picture, never at random: a gradient through her mid tones.
    const t = Math.min(0.999, Math.max(0, x / ART_W * 0.6 + n(x * 0.004 + 40, y * 0.004) * 0.6 - 0.1));
    return pal.mids[Math.floor(t * pal.mids.length)] ?? pal.mids[0];
  };

  // Where her subject is: the sketch, and a soft halo around it.
  const sk = await sketchLayer(input.sketch);
  let halo: Uint8ClampedArray | null = null, marks: Uint8ClampedArray | null = null;
  const subjectPts: [number, number][] = [];
  if (sk) {
    try {
      marks = sk.getContext('2d')!.getImageData(0, 0, ART_W, ART_H).data;
      halo = softened(sk, 10).getContext('2d')!.getImageData(0, 0, ART_W, ART_H).data;
      for (let i = 0; i < 4000; i++) {
        const x = Math.floor(r() * ART_W), y = Math.floor(r() * ART_H);
        if (halo[(y * ART_W + x) * 4 + 3] > 40) subjectPts.push([x, y]);
      }
    } catch { halo = marks = null; }
  }
  const near = (x: number, y: number) => {
    if (!halo || x < 0 || y < 0 || x >= ART_W || y >= ART_H) return 0;
    return halo[((y | 0) * ART_W + (x | 0)) * 4 + 3] / 255;
  };
  // The shapes her lines close (a window, a door, a face): each gets its own colour, painted in.
  const G = 4, gw = Math.ceil(ART_W / G), gh = Math.ceil(ART_H / G);
  const label = new Int32Array(gw * gh);
  const regionColour: RGB[] = [];
  const regionPts: [number, number, number][] = [];
  if (halo && marks) {
    // A cell is a wall if any of her marks pass through it, so thin lines still close a shape.
    const walls = new Uint8Array(gw * gh);
    for (let y = 0; y < ART_H; y++) for (let x = 0; x < ART_W; x++) {
      if (marks[(y * ART_W + x) * 4 + 3] > 60) walls[((y / G) | 0) * gw + ((x / G) | 0)] = 1;
    }
    const wall = (gx: number, gy: number) => walls[gx + gy * gw] === 1;
    const flood = (sx: number, sy: number, id: number) => {
      const stack = [sx + sy * gw];
      label[stack[0]] = id;
      let size = 0;
      while (stack.length) {
        const i = stack.pop()!;
        size++;
        const x = i % gw, y = (i / gw) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const j = nx + ny * gw;
          if (label[j] || wall(nx, ny)) continue;
          label[j] = id;
          stack.push(j);
        }
      }
      return size;
    };
    // Everything reachable from the edge is open ground, not a shape.
    for (let x = 0; x < gw; x++) for (const y of [0, gh - 1]) if (!label[x + y * gw] && !wall(x, y)) flood(x, y, -1);
    for (let y = 0; y < gh; y++) for (const x of [0, gw - 1]) if (!label[x + y * gw] && !wall(x, y)) flood(x, y, -1);
    const choices = [pal.accent, ...pal.mids, mix(pal.light, pal.accent, 0.4)];
    let id = 0;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      if (label[x + y * gw] || wall(x, y)) continue;
      id++;
      const size = flood(x, y, id);
      // Too small to paint, or so big it's really the background: leave it.
      const keep = size >= 10 && size < gw * gh * 0.4;
      // A colour that stands out from the ground around it (with a little variety between shapes).
      const ground = colourAt(x * G, y * G);
      const far = [...choices].sort((a, b) => dist(b, ground) - dist(a, ground));
      regionColour[id] = keep ? far[Math.floor(r() * Math.min(2, far.length))] : pal.dark;
      if (!keep) continue;
      for (let k = 0; k < Math.min(160, size); k++) regionPts.push([0, 0, id]);
    }
    // Sample points inside each kept shape.
    if (regionPts.length) {
      const byId = new Map<number, number[]>();
      for (let i = 0; i < label.length; i++) if (label[i] > 0 && regionColour[label[i]] !== pal.dark) (byId.get(label[i]) ?? byId.set(label[i], []).get(label[i])!).push(i);
      let j = 0;
      for (const p of regionPts) {
        const cells = byId.get(p[2])!;
        const c = cells[Math.floor(r() * cells.length)];
        p[0] = (c % gw) * G + r() * G; p[1] = ((c / gw) | 0) * G + r() * G; j++;
      }
    }
  }
  const regionAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= ART_W || y >= ART_H) return 0;
    const id = label[((y / G) | 0) * gw + ((x / G) | 0)];
    return id > 0 && regionColour[id] !== pal.dark ? id : 0;
  };
  if (o.signal?.aborted) return;

  // 1. The ground: a lit gradient and pools of light.
  const g = ctx.createLinearGradient(0, 0, 0, ART_H);
  const sky = mood.warm ? mix(pal.accent, pal.dark, 0.55) : mix(pal.mids[0], pal.dark, mood.night ? 0.8 : 0.6);
  g.addColorStop(0, css(sky)); g.addColorStop(0.62, css(pal.dark)); g.addColorStop(1, css(pal.deep));
  ctx.fillStyle = g; ctx.fillRect(0, 0, ART_W, ART_H);
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 4; i++) {
    const x = r() * ART_W, y = (mood.warm ? 0.45 + r() * 0.25 : r()) * ART_H, rad = 180 + r() * 320;
    const pool = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const c = i === 0 && mood.warm ? pal.light : pick([...pal.mids, pal.accent]);
    pool.addColorStop(0, css(c, 0.42)); pool.addColorStop(1, css(c, 0));
    ctx.fillStyle = pool; ctx.fillRect(0, 0, ART_W, ART_H);
  }
  ctx.globalCompositeOperation = 'source-over';
  // 2. Underpainting: soft blooms of colour.
  for (let i = 0; i < 420; i++) {
    const x = r() * ART_W, y = r() * ART_H, rad = 30 + r() * 120;
    const c = colourAt(x, y);
    const b = ctx.createRadialGradient(x, y, 0, x, y, rad);
    b.addColorStop(0, css(c, 0.05 + r() * 0.05)); b.addColorStop(1, css(c, 0));
    ctx.fillStyle = b; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // 2b. A first wash of colour inside her shapes.
  for (const [x, y, id] of regionPts) {
    const c = regionColour[id], rad = 10 + r() * 22;
    const b = ctx.createRadialGradient(x, y, 0, x, y, rad);
    b.addColorStop(0, css(c, 0.22)); b.addColorStop(1, css(c, 0));
    ctx.fillStyle = b; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // 3. Brushwork along the current: the ground loosely, the subject densely and bright.
  const turn = mood.storm ? 6 : mood.water ? 2.2 : 3.4;
  const scale = mood.water ? 0.0018 : 0.0026;
  const strokes: (() => void)[] = [];
  const total = 2600;
  for (let i = 0; i < total; i++) {
    const roll = r();
    const inShape = regionPts.length > 0 && roll < 0.3;
    const onSubject = !inShape && subjectPts.length > 0 && roll < 0.55;
    let [x, y] = inShape ? pick(regionPts) : onSubject ? pick(subjectPts) : [r() * ART_W, r() * ART_H];
    x += (r() - 0.5) * 6; y += (r() - 0.5) * 6;
    const steps = onSubject ? 10 + r() * 22 : 18 + r() * 40;
    const width = onSubject ? 0.7 + r() * 2.2 : 1 + r() * 5;
    const sx = x, sy = y;
    strokes.push(() => {
      let px = sx, py = sy;
      const shape = inShape ? regionAt(px, py) : 0;
      const k = shape ? 0 : near(px, py);
      const base = shape ? regionColour[shape] : k > 0.25 ? mix(pal.accent, pal.light, 0.3 + r() * 0.6) : colourAt(px, py);
      const c = mix(base, pal.light, r() * (shape ? 0.35 : 0.25));
      ctx.strokeStyle = css(c, shape ? 0.18 + r() * 0.24 : k > 0.25 ? 0.14 + r() * 0.3 : 0.05 + r() * 0.12);
      ctx.lineWidth = shape ? 1.5 + r() * 4 : width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, py);
      let prev = NaN;
      for (let s = 0; s < steps; s++) {
        let a = n(px * scale, py * scale) * Math.PI * turn;
        if (mood.water) a = a * 0.35;
        // On her subject, the brush follows her lines (along the edge of the halo), like tracing a form.
        if (k > 0.25) {
          const gx = near(px + 3, py) - near(px - 3, py), gy = near(px, py + 3) - near(px, py - 3);
          if (Math.abs(gx) + Math.abs(gy) > 0.02) {
            let t = Math.atan2(gx, -gy);
            if (!Number.isNaN(prev) && Math.cos(t - prev) < 0) t += Math.PI;
            a = t;
          }
        }
        prev = a;
        const nx = px + Math.cos(a) * (k > 0.25 ? 2 : 3), ny = py + Math.sin(a) * (k > 0.25 ? 2 : 3);
        // Colour inside a shape stays inside it.
        if (shape && regionAt(nx, ny) !== shape) break;
        px = nx; py = ny;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    });
  }

  const finish = () => {
    // 4. Her subject glows: a soft halo of her lines, then the lines themselves in light.
    if (sk) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.55;
      ctx.drawImage(tint(softened(sk, 8), pal.light), 0, 0);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(tint(sk, mix(pal.light, pal.accent, 0.25)), 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // 5. Specks of light (stars at night).
    for (let i = 0; i < (mood.night ? 260 : 90); i++) {
      const x = r() * ART_W, y = r() * ART_H * (mood.night ? 0.7 : 1);
      ctx.fillStyle = css(pal.light, 0.15 + r() * 0.5);
      ctx.beginPath(); ctx.arc(x, y, r() * (mood.night ? 1.4 : 1.8), 0, Math.PI * 2); ctx.fill();
    }
    // 6. Mist low down, a bloom over everything, a vignette, and grain.
    const fog = ctx.createLinearGradient(0, ART_H * 0.45, 0, ART_H);
    fog.addColorStop(0, css(pal.light, 0)); fog.addColorStop(0.7, css(mix(pal.light, pal.mids[0], 0.5), mood.mist * 0.35)); fog.addColorStop(1, css(pal.deep, 0.3));
    ctx.fillStyle = fog; ctx.fillRect(0, 0, ART_W, ART_H);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.28;
    ctx.drawImage(softened(canvas, 14), 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const v = ctx.createRadialGradient(ART_W / 2, ART_H / 2, ART_H * 0.35, ART_W / 2, ART_H / 2, ART_W * 0.7);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, css(pal.deep, 0.75));
    ctx.fillStyle = v; ctx.fillRect(0, 0, ART_W, ART_H);
    grain(ctx, r);
    o.onDone?.();
  };

  if (!o.animate) {
    for (const s of strokes) s();
    finish();
    return;
  }
  // Painted in front of you: a few hundred strokes a frame, about two seconds in all.
  await new Promise<void>(resolve => {
    let i = 0;
    const frame = () => {
      if (o.signal?.aborted) return resolve();
      const end = Math.min(strokes.length, i + 90);
      for (; i < end; i++) strokes[i]();
      if (i < strokes.length) requestAnimationFrame(frame);
      else { finish(); resolve(); }
    };
    requestAnimationFrame(frame);
  });
}

/** A layer's shapes, recoloured in one colour (keeping their alpha). */
function tint(src: HTMLCanvasElement, c: RGB) {
  const out = document.createElement('canvas');
  out.width = src.width; out.height = src.height;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = css(c);
  ctx.fillRect(0, 0, out.width, out.height);
  return out;
}

/** Fine film grain over the whole piece. */
function grain(ctx: CanvasRenderingContext2D, r: () => number) {
  const t = document.createElement('canvas');
  t.width = t.height = 128;
  const tc = t.getContext('2d')!;
  const img = tc.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + r() * 145;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 22;
  }
  tc.putImageData(img, 0, 0);
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(t, 'repeat')!;
  ctx.fillRect(0, 0, ART_W, ART_H);
  ctx.globalCompositeOperation = 'source-over';
}

const done = new Map<string, string>();
/** A finished piece as an image, painted once per seed and kept for this visit. */
export async function irisArtUrl(input: { sketch: string; seed: string; brief?: string }): Promise<string> {
  const key = irisArtKey(input);
  const hit = done.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  await paintIris(c, input);
  const url = c.toDataURL('image/jpeg', 0.9);
  done.set(key, url);
  return url;
}
export const irisArtKey = (input: { sketch: string; seed: string; brief?: string }) => `${input.seed}|${hashText(input.brief ?? '')}|${hashText(input.sketch)}`;
export const irisArtCached = (input: { sketch: string; seed: string; brief?: string }) => done.get(irisArtKey(input)) ?? null;
export const rememberIrisArt = (input: { sketch: string; seed: string; brief?: string }, url: string) => { done.set(irisArtKey(input), url); };
