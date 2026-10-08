// Safety check for Iris's sketches (docs/PLAN.md, The Artist). Strict allowlist: shapes and paths
// only, no text, no scripts, links, embedded images, styles or entities. Anything else is rejected.

/** Iris's palette: the studio tokens, as plain colours (SVG shown as an image can't read CSS variables). */
export const IRIS_PALETTE = {
  amber: '#E8A55A', teal: '#5FB8B0', gold: '#E9D36A', lavender: '#B9A4E6', ink: '#ECE8E1', ground: '#0F1013',
} as const;

const ELEMENTS = new Set(['svg', 'g', 'path', 'line', 'polyline', 'polygon', 'rect', 'circle', 'ellipse']);
const ATTRIBUTES = new Set([
  'xmlns', 'viewBox', 'width', 'height', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'points',
  'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity',
  'fill-opacity', 'stroke-opacity', 'transform',
]);
const COLOURS = new Set(['none', ...Object.values(IRIS_PALETTE).map(c => c.toLowerCase())]);
const MAX_LENGTH = 16_000;
const MAX_ELEMENTS = 300;

export type SvgCheck = { ok: true; svg: string } | { ok: false; reason: string };

export function checkSvg(input: string): SvgCheck {
  const svg = input.trim();
  if (!svg) return { ok: false, reason: 'empty' };
  if (svg.length > MAX_LENGTH) return { ok: false, reason: 'too long' };
  if (/[&]|<!|<\?|url\s*\(|javascript:|data:/i.test(svg)) return { ok: false, reason: 'contains entities, declarations or links' };

  const tagRe = /<\s*(\/?)\s*([a-zA-Z][\w:-]*)([^<>]*?)(\/?)\s*>/g;
  const stack: string[] = [];
  let last = 0, count = 0, sawRoot = false;
  for (let m; (m = tagRe.exec(svg)); ) {
    // Only whitespace may sit between tags: no text.
    if (svg.slice(last, m.index).trim()) return { ok: false, reason: 'contains text' };
    last = tagRe.lastIndex;
    const [, closing, rawName, attrs, selfClose] = m;
    const name = rawName.toLowerCase();
    if (!ELEMENTS.has(name)) return { ok: false, reason: `element <${rawName}> not allowed` };
    if (closing) {
      if (stack.pop() !== name) return { ok: false, reason: 'tags not nested properly' };
      continue;
    }
    if (++count > MAX_ELEMENTS) return { ok: false, reason: 'too many shapes' };
    if (!sawRoot) { if (name !== 'svg') return { ok: false, reason: 'must start with <svg>' }; sawRoot = true; }
    else if (stack.length === 0) return { ok: false, reason: 'content outside <svg>' };

    // Attributes: name="value" pairs only, each on the allowlist.
    const rest = attrs.replace(/([\w:-]+)\s*=\s*"([^"]*)"/g, (_, a: string, v: string) => {
      if (!ATTRIBUTES.has(a)) throw new SvgReject(`attribute ${a} not allowed`);
      if ((a === 'fill' || a === 'stroke') && !COLOURS.has(v.trim().toLowerCase())) throw new SvgReject(`colour ${v} not in Iris's palette`);
      if (a === 'xmlns' && v !== 'http://www.w3.org/2000/svg') throw new SvgReject('unexpected namespace');
      if (a !== 'xmlns' && /[^\w\s.,#%()+-]/.test(v)) throw new SvgReject(`unexpected characters in ${a}`);
      return '';
    });
    if (rest.trim()) return { ok: false, reason: 'malformed attributes' };
    if (!selfClose) stack.push(name);
  }
  if (svg.slice(last).trim()) return { ok: false, reason: 'contains text' };
  if (!sawRoot) return { ok: false, reason: 'no <svg> element' };
  if (stack.length) return { ok: false, reason: 'unclosed tags' };
  return { ok: true, svg };
}

class SvgReject extends Error {}

/** Same as checkSvg, but turns attribute errors into a failed result instead of throwing. */
export function safeSvg(input: string): SvgCheck {
  try { return checkSvg(input); } catch (e) { return { ok: false, reason: e instanceof SvgReject ? e.message : 'unreadable' }; }
}
