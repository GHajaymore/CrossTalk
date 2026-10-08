// Iris's sketches for mock mode, ported from docs/prototype.html. Real mode asks a model to draw.
import { IRIS_PALETTE as P } from './svgSafety';

type Ink = keyof typeof P;
const s = (c: Ink, extra = '') => `stroke="${P[c]}"${extra}`;
const o = (v: number) => ` opacity="${v}"`;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

const SCENES: Record<string, { title: string; draw: () => string }> = {
  week: { title: 'The Empty Friday', draw: () => `
    <rect x="120" y="70" width="360" height="230" rx="10" ${s('ink', o(0.7))}/>
    <line x1="120" y1="110" x2="480" y2="110" ${s('ink', o(0.5))}/>
    <circle cx="160" cy="58" r="6" ${s('ink')}/><circle cx="440" cy="58" r="6" ${s('ink')}/>
    ${range(4).map(i => `<rect x="${136 + i * 66}" y="128" width="54" height="152" rx="6" ${s(i % 2 ? 'teal' : 'amber', o(0.85))}/>${range(5).map(j => `<line x1="${146 + i * 66}" y1="${150 + j * 24}" x2="${180 + i * 66 - (j % 2) * 10}" y2="${150 + j * 24}" ${s(i % 2 ? 'teal' : 'amber', o(0.6))}/>`).join('')}`).join('')}
    <rect x="400" y="128" width="64" height="152" rx="6" ${s('gold', ' stroke-dasharray="5 6"')}/>
    <circle cx="432" cy="190" r="16" ${s('gold')}/>
    ${[0, 45, 90, 135, 180, 225, 270, 315].map(a => { const r = (a * Math.PI) / 180; return `<line x1="${(432 + Math.cos(r) * 22).toFixed(1)}" y1="${(190 + Math.sin(r) * 22).toFixed(1)}" x2="${(432 + Math.cos(r) * 30).toFixed(1)}" y2="${(190 + Math.sin(r) * 30).toFixed(1)}" ${s('gold')}/>`; }).join('')}
    <path d="M414 244 q18 14 36 0" ${s('lavender')}/>` },
  golf: { title: 'Long Ball, Short Course', draw: () => `
    <path d="M40 300 C160 230 300 250 380 270 S520 300 560 290" ${s('teal')}/>
    <path d="M60 318 C200 280 380 300 560 312" ${s('teal', o(0.5))}/>
    <line x1="430" y1="272" x2="430" y2="120" ${s('ink')}/>
    <path d="M430 120 L486 138 L430 156" ${s('amber')}/>
    <ellipse cx="430" cy="276" rx="14" ry="4" ${s('ink', o(0.6))}/>
    <path d="M110 286 Q260 40 520 160" ${s('gold', ' stroke-dasharray="3 9"')}/>
    <circle cx="110" cy="280" r="7" ${s('ink')}/>
    <path d="M520 160 l18 -6 M520 160 l12 14" ${s('lavender')}/>` },
  city: { title: 'Room to Walk', draw: () => `
    <path d="M300 90 L80 320 M300 90 L520 320" ${s('ink', o(0.6))}/>
    <path d="M300 120 L300 150 M300 180 L300 220 M300 250 L300 300" ${s('gold')}/>
    <rect x="190" y="230" width="70" height="38" rx="10" ${s('amber', o(0.55))}/>
    <circle cx="205" cy="270" r="7" ${s('amber', o(0.55))}/><circle cx="246" cy="270" r="7" ${s('amber', o(0.55))}/>
    ${[[360, 210], [392, 240], [426, 200]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" ${s('teal')}/><path d="M${x} ${y + 8} v26 m0 -16 l-12 8 m12 -8 l12 8 m-12 16 l-10 18 m10 -18 l10 18" ${s('teal')}/>`).join('')}
    <path d="M60 140 q20 -40 40 0 z M80 140 v40 M500 130 q22 -44 44 0 z M522 130 v44" ${s('lavender')}/>` },
  food: { title: 'The Fee on the Table', draw: () => `
    <ellipse cx="300" cy="240" rx="230" ry="46" ${s('ink', o(0.5))}/>
    <ellipse cx="260" cy="214" rx="86" ry="26" ${s('ink')}/>
    <ellipse cx="260" cy="210" rx="52" ry="14" ${s('amber')}/>
    <path d="M150 196 v40 M142 196 v14 q8 8 16 0 v-14 M370 196 v40 M370 196 q14 10 0 24" ${s('ink', o(0.8))}/>
    <rect x="410" y="120" width="70" height="100" rx="4" ${s('teal')}/>
    ${range(4).map(j => `<line x1="422" y1="${140 + j * 16}" x2="${466 - (j % 2) * 14}" y2="${140 + j * 16}" ${s('teal', o(0.7))}/>`).join('')}
    <path d="M422 204 h44" ${s('gold')}/><circle cx="476" cy="96" r="12" ${s('gold')}/><path d="M476 90 v12 M470 96 h12" ${s('gold')}/>` },
  shop: { title: 'Open Sign', draw: () => `
    <rect x="140" y="130" width="320" height="170" ${s('ink', o(0.7))}/>
    <path d="M130 130 L470 130 L450 90 L150 90 Z" ${s('amber')}/>
    ${range(7).map(i => `<line x1="${170 + i * 44}" y1="90" x2="${165 + i * 44}" y2="130" ${s('amber', o(0.6))}/>`).join('')}
    <rect x="180" y="170" width="120" height="80" ${s('teal')}/><rect x="340" y="170" width="70" height="130" ${s('ink', o(0.7))}/>
    <circle cx="398" cy="238" r="4" ${s('ink')}/>
    <path d="M200 230 l20 -24 l18 16 l26 -34" ${s('gold')}/>
    <path d="M480 70 l8 16 l16 4 l-16 4 l-8 16 l-8 -16 l-16 -4 l16 -4 z" ${s('lavender')}/>` },
  table: { title: 'Two Chairs, One Question', draw: () => `
    <ellipse cx="300" cy="230" rx="150" ry="34" ${s('ink', o(0.7))}/>
    <path d="M300 264 v50 M260 318 h80" ${s('ink', o(0.6))}/>
    <path d="M100 150 v130 M100 210 h60 v70" ${s('amber')}/><path d="M500 150 v130 M500 210 h-60 v70" ${s('teal')}/>
    <path d="M150 140 q40 -40 90 -20" ${s('amber')}/><path d="M450 140 q-40 -40 -90 -20" ${s('teal')}/>
    <path d="M300 120 l7 14 l14 4 l-14 4 l-7 14 l-7 -14 l-14 -4 l14 -4 z" ${s('gold')}/>` },
};

export function sceneFor(topic: string) {
  const t = topic.toLowerCase();
  if (/golf/.test(t)) return 'golf';
  if (/restaurant|tip|service fee|food|retail/.test(t)) return 'food';
  if (/work ?week|four-day|workday/.test(t)) return 'week';
  if (/\bcars?\b|pedestrian|downtown|street|cit(y|ies)/.test(t)) return 'city';
  if (/business|shop|store|\bai\b/.test(t)) return 'shop';
  return 'table';
}

export function mockSketch(topic: string): { title: string; svg: string } {
  const sc = SCENES[sceneFor(topic)];
  const body = sc.draw().replace(/\s+/g, ' ').trim();
  return {
    title: sc.title,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360"><rect x="0" y="0" width="600" height="360" fill="${P.ground}" stroke="none"/><g fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`,
  };
}
