import { createElement, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ConversationView } from '@crosstalk/shared';
import type { Playback } from '../speech/usePlayback';

// Rebuilt from Iris's already-checked SVG one shape at a time: only these elements and attributes,
// never raw markup, so even a drawing that slipped past the server check can't run anything.
const ELEMENTS = new Set(['svg', 'g', 'path', 'line', 'polyline', 'polygon', 'rect', 'circle', 'ellipse']);
const ATTRS: Record<string, string> = {
  viewBox: 'viewBox', d: 'd', x: 'x', y: 'y', x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2', cx: 'cx', cy: 'cy', r: 'r', rx: 'rx', ry: 'ry',
  points: 'points', fill: 'fill', stroke: 'stroke', 'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin', opacity: 'opacity', 'fill-opacity': 'fillOpacity', 'stroke-opacity': 'strokeOpacity', transform: 'transform',
};
const SAFE_VALUE = /^[\w\s.,#%()+-]*$/;

type Shape = { tag: string; props: Record<string, string>; children: Shape[] };

function parse(svg: string): Shape | null {
  if (typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.nodeName !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
  const walk = (el: Element): Shape | null => {
    if (!ELEMENTS.has(el.nodeName)) return null;
    const props: Record<string, string> = {};
    for (const a of Array.from(el.attributes)) {
      const key = ATTRS[a.name];
      if (key && SAFE_VALUE.test(a.value)) props[key] = a.value;
    }
    return { tag: el.nodeName, props, children: Array.from(el.children).map(walk).filter((s): s is Shape => !!s) };
  };
  return walk(root);
}

type Props = {
  svg: string;
  /** 0 = nothing drawn, 1 = the whole drawing. */
  progress: number;
  label: string;
  className?: string;
  /** A faint outline of the finished drawing underneath, for her lines to trace over. */
  ghost?: boolean;
};

/**
 * Iris's sketch, drawing itself. Each shape's line is revealed in turn (stroke-dash with pathLength 1),
 * so at progress 1 the drawing is complete. Reduced motion always shows it whole.
 */
export function LivingSketch({ svg, progress, label, className, ghost }: Props) {
  const tree = useMemo(() => parse(svg), [svg]);
  const total = useMemo(() => { let n = 0; const count = (s: Shape) => { if (s.tag !== 'svg' && s.tag !== 'g') n++; s.children.forEach(count); }; if (tree) count(tree); return n; }, [tree]);
  if (!tree) return null;
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const p = still ? 1 : Math.max(0, Math.min(1, progress));
  let i = 0;
  const render = (s: Shape, key: string): ReactNode => {
    if (s.tag === 'svg' || s.tag === 'g') {
      const extra = s.tag === 'svg' ? { role: 'img', 'aria-label': label, className } : {};
      return createElement(s.tag, { key, ...s.props, ...extra }, s.children.map((c, j) => render(c, `${key}.${j}`)));
    }
    const done = Math.max(0, Math.min(1, p * total - i++));
    return createElement(s.tag, { key, ...s.props, pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - done, fillOpacity: done, className: 'stroke' });
  };
  const drawing = render(tree, 's');
  if (!ghost) return <>{drawing}</>;
  // Shown as an image (never live markup), like everywhere else her finished sketch appears.
  return (
    <span className="living-ghost">
      <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt="" aria-hidden="true" />
      {drawing}
    </span>
  );
}

/**
 * How much of Iris's drawing to show while an episode plays: it completes as the turn she drew is
 * spoken. Not playing: the whole drawing.
 */
export function sketchProgress(view: ConversationView, play: Playback): number {
  const moment = view.artist?.momentSeq ?? 0;
  if (play.state === 'idle' || !moment) return 1;
  if (play.clock) {
    const end = view.audio?.timings.find(t => t.seq === moment)?.end ?? play.clock.duration;
    return play.clock.position / Math.max(1, end);
  }
  // Device voices give no clock: the drawing advances turn by turn and finishes after the chosen turn.
  return Math.max(0, (play.seq ?? 1) - 1) / moment;
}

/** A replay: the drawing from blank to whole over a few seconds, for "Watch her draw". */
export function useDrawReplay(ms = 6000) {
  const [p, setP] = useState<number | null>(null);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const start = () => {
    const t0 = performance.now();
    const step = (t: number) => { const v = (t - t0) / ms; setP(Math.min(1, v)); if (v < 1) raf.current = requestAnimationFrame(step); else setP(null); };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
  };
  const stop = () => { cancelAnimationFrame(raf.current); setP(null); };
  return { progress: p, playing: p !== null, start, stop };
}
