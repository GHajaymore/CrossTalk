// How big a picture prints well, from its real pixel size: 300 dpi is print-shop sharp, 200 dpi still
// looks very good at arm's length. Anything bigger is enlarged and starts to look soft.
export type PrintSize = { px: string; sharp: string; good: string };

const inch = (px: number, dpi: number) => px / dpi;
const fmt = (w: number, h: number, dpi: number) => {
  const wi = inch(w, dpi), hi = inch(h, dpi);
  const r = (n: number) => (n >= 10 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, ''));
  return `${r(wi)} × ${r(hi)} in (${r(wi * 2.54)} × ${r(hi * 2.54)} cm)`;
};

export function printSize(w: number, h: number): PrintSize {
  return { px: `${w} × ${h} px`, sharp: fmt(w, h, 300), good: fmt(w, h, 200) };
}

/** One line for under a picture. Vector art (her line styles) has no pixel limit. */
export function printSizeLine(size: { w: number; h: number } | 'vector'): string {
  if (size === 'vector') return 'Vector art: prints sharp at any size.';
  const p = printSize(size.w, size.h);
  return `${p.px} · prints sharp up to ${p.sharp}, very good up to ${p.good}`;
}
