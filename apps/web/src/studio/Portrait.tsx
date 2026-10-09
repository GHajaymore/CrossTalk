// Living portraits for the two AI hosts: invented people, drawn in the app (no photos, no image
// model, never a real person). Each look comes from the host's name, job and seat, so the same host
// always looks the same. The mouth follows the voice level the set already writes as --lvl.

import { useEffect, useRef, useState } from 'react';
import { hostTraits, lookCode, type HairStyle, type OutfitKind } from '@crosstalk/shared';
import { usePolledImage } from '../lib/usePolledImage';
import { LAUGH_EVENT, MURMUR_EVENT } from '../speech/BrowserSpeech';

type Seat = 'A' | 'B';
type Mood = 'calm' | 'lively' | 'heated';
export type PortraitProps = { name: string; role: string; seat: Seat; mood?: Mood; home?: string };

const SKIN = ['#f3d2b8', '#e8b892', '#d29a6e', '#b57a4f', '#8d5a36', '#5e3a22'];
const SKIN_SHADE = ['#e3b99b', '#d6a07a', '#bb8358', '#9c653e', '#764828', '#4a2c18'];
// Hair colours match the shared traits: 0–5, then grey.
const HAIR = ['#1c1714', '#3b2619', '#5a3a22', '#8a5a2b', '#c9a36a', '#6b2f1f', '#a8a8a8'];
type Hair = HairStyle;

type Outfit = { kind: OutfitKind; main: string; trim: string };
/** Clothes that fit the job, in the seat's colour unless the job has its own uniform. */
function outfitColours(kind: OutfitKind, seat: Seat, h: number): Outfit {
  const seatMain = seat === 'A' ? ['#7a4a1f', '#5b3a1e', '#8a5a2b'][h % 3] : ['#1f5a55', '#244a47', '#2f6b64'][h % 3];
  const seatTrim = seat === 'A' ? '#e8a55a' : '#5fb8b0';
  if (kind === 'chef') return { kind, main: '#ece8e1', trim: seatTrim };
  if (kind === 'scrubs') return { kind, main: seat === 'A' ? '#3d6f8f' : '#3f7d6e', trim: '#d8e6ee' };
  if (kind === 'hivis') return { kind, main: '#d9e04a', trim: '#e0e0e0' };
  if (kind === 'blazer') return { kind, main: seatMain, trim: '#ece8e1' };
  return { kind, main: seatMain, trim: seatTrim };
}

export function lookFor({ name, role, seat, home }: PortraitProps) {
  const t = hostTraits({ name, role, seat, home });
  return { h: t.h, skin: SKIN[t.skin], shade: SKIN_SHADE[t.skin], style: t.style, hair: HAIR[t.hair], glasses: t.glasses, outfit: outfitColours(t.outfit, seat, t.h), blink: 3.2 + ((t.h >>> 13) % 30) / 10, age: t.age ?? 4, room: t.room ?? 0, code: lookCode(t) };
}

function HairBack({ style, color }: { style: Hair; color: string }) {
  if (style === 'long') return <path d="M52 92 C48 40 152 40 148 92 L154 168 C130 178 70 178 46 168 Z" fill={color} />;
  if (style === 'wavy') return <path d="M54 92 C50 40 150 40 146 92 C156 118 150 140 156 158 C126 170 74 170 44 158 C50 140 44 118 54 92 Z" fill={color} />;
  if (style === 'bob') return <path d="M54 94 C50 42 150 42 146 94 L150 132 C128 140 72 140 50 132 Z" fill={color} />;
  if (style === 'bun') return <circle cx="100" cy="30" r="16" fill={color} />;
  return null;
}

function HairFront({ style, color }: { style: Hair; color: string }) {
  switch (style) {
    case 'buzz': return <path d="M58 84 C52 24 148 24 142 84 C136 62 64 62 58 84 Z" fill={color} opacity="0.88" />;
    case 'curly': return (
      <g fill={color}>
        {[[62, 70], [72, 54], [88, 46], [104, 44], [120, 48], [134, 58], [140, 74], [58, 86], [142, 88]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="13" />)}
      </g>
    );
    case 'bun': case 'bob': return <path d="M55 96 C46 20 154 20 145 96 C140 72 124 62 100 64 C78 62 62 72 55 96 Z" fill={color} />;
    case 'long': case 'wavy': return <path d="M54 102 C43 18 157 18 146 102 C138 72 120 60 98 62 C78 64 62 76 54 102 Z" fill={color} />;
    default: return <path d="M55 92 C46 22 154 22 145 92 C140 70 126 60 112 62 C100 52 80 56 70 66 C62 74 57 82 55 92 Z" fill={color} />;
  }
}

function Torso({ o, skin }: { o: Outfit; skin: string }) {
  const body = 'M30 200 C34 160 60 146 100 146 C140 146 166 160 170 200 Z';
  return (
    <g className="p-torso">
      <path d={body} fill={o.main} />
      {o.kind === 'blazer' && <>
        <path d="M86 148 L100 182 L114 148 Z" fill={o.trim} />
        <path d="M86 148 L72 200 M114 148 L128 200" stroke="rgba(0,0,0,.25)" strokeWidth="3" />
      </>}
      {o.kind === 'chef' && <>
        <path d="M84 148 C90 160 110 160 116 148" fill="none" stroke="#cfc9c0" strokeWidth="4" />
        {[164, 180].flatMap(y => [88, 112].map(x => <circle key={`${x}${y}`} cx={x} cy={y} r="3" fill="#bdb6ac" />))}
      </>}
      {o.kind === 'scrubs' && <path d="M84 148 L100 168 L116 148" fill="none" stroke={o.trim} strokeWidth="3" />}
      {o.kind === 'hivis' && <>
        <path d="M66 156 L74 200 M134 156 L126 200" stroke="#e8e8e8" strokeWidth="7" />
        <path d="M88 148 C92 158 108 158 112 148" fill={skin} />
      </>}
      {o.kind === 'sweater' && <path d="M84 148 C90 158 110 158 116 148" fill="none" stroke={o.trim} strokeWidth="4" />}
      {o.kind === 'shirt' && <path d="M88 148 L100 160 L112 148 L106 170 L100 162 L94 170 Z" fill={o.trim} opacity="0.9" />}
    </g>
  );
}

const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const between = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Small, never-repeating movements: every 1 to 3.5 seconds the host picks a new pose (a tilt, a nod,
 * a glance, raised brows, a smile or a frown). Speaking hosts move and emote more; listeners look
 * toward the speaker and nod along. Heated talk frowns more, calm talk smiles more. Off for
 * reduced motion.
 */
/** Fired on the window when the listener taps a reaction; the hosts respond. */
export const REACT_EVENT = 'crosstalk:react';

function useLife(ref: React.RefObject<Element | null>, seat: Seat, mood: Mood, restart = '') {
  const moodRef = useRef(mood);
  moodRef.current = mood;
  useEffect(() => {
    const el = ref.current;
    if (!el || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    let timer = 0;
    const set = (k: string, v: number, unit = '') => (el as HTMLElement).style.setProperty(k, `${v.toFixed(2)}${unit}`);
    const step = () => {
      const tile = el.closest('.set-tile');
      const speaker = el.closest('.set')?.getAttribute('data-speaking') ?? '';
      const talking = !!tile?.classList.contains('on');
      const toward = speaker && speaker !== seat ? (seat === 'A' ? 1 : -1) : 0; // the other host (or guest) is talking
      const m = moodRef.current;
      const smiley = m === 'calm' ? 0.45 : m === 'heated' ? 0.12 : 0.28;
      const frowny = m === 'heated' ? 0.45 : m === 'calm' ? 0.05 : 0.15;
      const r = Math.random();
      set('--laugh', 0);
      // Head: a talker gestures with their head; a listener mostly holds still, turned toward the voice.
      set('--tilt', talking ? between(-5, 5) : toward * between(1, 4) + between(-1.5, 1.5), 'deg');
      set('--turn', talking ? between(-4, 4) : toward * between(2, 5), 'px');
      set('--nod', talking ? (r < 0.35 ? between(2, 4) : between(-1, 1)) : (r < 0.2 ? between(1.5, 3) : 0), 'px');
      // Eyes: glance about while talking; look at the speaker while listening.
      set('--gx', talking ? between(-1.6, 1.6) : toward ? toward * between(1, 1.8) : between(-1.2, 1.2), 'px');
      set('--gy', between(-0.8, 0.8), 'px');
      // Face: brows lift on a point, a smile comes and goes, a frown in hot moments.
      const face = Math.random();
      const smile = face < smiley ? between(0.5, 1) : 0;
      const frown = !smile && face < smiley + frowny ? between(0.5, 1) : 0;
      set('--smile', smile);
      set('--brow', talking && Math.random() < 0.4 ? -between(1.5, 3.5) : frown ? 1.2 : between(-0.6, 0.4), 'px');
      set('--furrow', frown * 9, 'deg');
      set('--dur', between(0.35, 0.9), 's');
      timer = window.setTimeout(step, between(talking ? 900 : 1400, talking ? 2600 : 3500));
    };
    // Each host starts at their own moment, so the two never move in step.
    timer = window.setTimeout(step, between(0, 1600));
    // When you react, the hosts react back: a smile, raised brows, a nod or a thoughtful tilt.
    const onReact = (e: Event) => {
      const kind = (e as CustomEvent<{ kind: string }>).detail?.kind;
      window.clearTimeout(timer);
      set('--dur', 0.35, 's');
      if (kind === 'funny' || kind === 'love') { set('--smile', 1); set('--brow', -1.5, 'px'); }
      else if (kind === 'wow') { set('--brow', -3.5, 'px'); set('--smile', 0); }
      else if (kind === 'clap') { set('--nod', 3.5, 'px'); set('--smile', 0.7); }
      else if (kind === 'hmm') { set('--tilt', seat === 'A' ? 5 : -5, 'deg'); set('--furrow', 6, 'deg'); }
      timer = window.setTimeout(step, 1400 + Math.random() * 600);
    };
    // A murmur ("mm-hm", "right") comes with a small nod and a half smile from the host who said it.
    const onMurmur = (e: Event) => {
      if ((e as CustomEvent<{ seat: string }>).detail?.seat !== seat) return;
      window.clearTimeout(timer);
      set('--dur', 0.3, 's');
      set('--nod', between(2.5, 4), 'px');
      set('--smile', between(0.3, 0.6));
      set('--brow', -between(0.5, 1.5), 'px');
      timer = window.setTimeout(step, 700 + Math.random() * 500);
    };
    // A laugh: the one who heard the joke laughs properly (a wide smile, lifted brows, the head bobbing
    // back a few times); the one who made it, or who opens with "Ha,", gives a pleased chuckle.
    const onLaugh = (e: Event) => {
      const d = (e as CustomEvent<{ seat: string; big: boolean }>).detail;
      if (d?.seat !== seat) return;
      window.clearTimeout(timer);
      set('--dur', 0.14, 's');
      set('--smile', 1);
      set('--furrow', 0, 'deg');
      set('--brow', d.big ? -2.5 : -1.2, 'px');
      set('--tilt', (seat === 'A' ? -1 : 1) * (d.big ? between(3, 5) : between(1, 2.5)), 'deg');
      if (d.big) set('--laugh', 1);
      const bob = d.big ? [-2.5, 2.5, -2, 2, -1, 0.5] : [-1.2, 1.5, 0];
      let k = 0;
      const beat = () => {
        if (k < bob.length) { set('--nod', bob[k++], 'px'); timer = window.setTimeout(beat, 150); }
        else { set('--dur', 0.6, 's'); set('--laugh', 0); timer = window.setTimeout(step, 900 + Math.random() * 500); }
      };
      beat();
    };
    window.addEventListener(REACT_EVENT, onReact);
    window.addEventListener(MURMUR_EVENT, onMurmur);
    window.addEventListener(LAUGH_EVENT, onLaugh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(REACT_EVENT, onReact); window.removeEventListener(MURMUR_EVENT, onMurmur); window.removeEventListener(LAUGH_EVENT, onLaugh);
    };
  }, [ref, seat, restart]);
}

/** A host's living portrait. Decorative: the name and job are on the name bar beside it. */
export function Portrait(props: PortraitProps) {
  const L = lookFor(props);
  const svg = useRef<SVGSVGElement>(null);
  useLife(svg, props.seat, props.mood ?? 'lively');
  const lid = { animationDuration: `${L.blink}s`, animationDelay: `${(L.h % 17) / 10}s` };
  const brow = L.hair === '#c9a36a' ? '#8a6a3a' : L.hair;
  return (
    <svg ref={svg} className={`set-portrait seat-${props.seat}`} viewBox="22 22 156 178" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <g className="p-body">
        <Torso o={L.outfit} skin={L.skin} />
        <path d="M86 128 L86 152 C92 158 108 158 114 152 L114 128 Z" fill={L.shade} />
        <g className="p-head">
          <HairBack style={L.style} color={L.hair} />
          <ellipse cx="57" cy="96" rx="7" ry="11" fill={L.shade} />
          <ellipse cx="143" cy="96" rx="7" ry="11" fill={L.shade} />
          <ellipse cx="100" cy="90" rx="42" ry="50" fill={L.skin} />
          <ellipse cx="78" cy="108" rx="9" ry="5" fill="#d9776a" opacity="0.16" />
          <ellipse cx="122" cy="108" rx="9" ry="5" fill="#d9776a" opacity="0.16" />
          {/* Lines that come with the years: faint at 50, a little more at 60. */}
          {L.age >= 5 && <g fill="none" stroke={L.shade} strokeWidth="1.4" strokeLinecap="round" opacity={L.age >= 6 ? 0.9 : 0.6}>
            <path d="M84 66 Q100 62 116 66" />{L.age >= 6 && <path d="M88 72 Q100 69 112 72" />}
            <path d="M74 112 Q76 118 80 121" /><path d="M126 112 Q124 118 120 121" />
          </g>}
          <HairFront style={L.style} color={L.hair} />
          {/* Eyes, with lids that blink at their own rhythm */}
          <g className="p-eyes">
            <ellipse cx="84" cy="92" rx="5.5" ry="4" fill="#fbf7f2" />
            <ellipse cx="116" cy="92" rx="5.5" ry="4" fill="#fbf7f2" />
            <circle className="p-iris" cx="84" cy="92" r="3" fill="#2a1d14" />
            <circle className="p-iris" cx="116" cy="92" r="3" fill="#2a1d14" />
            <circle cx="85" cy="91" r="0.9" fill="#fff" />
            <circle cx="117" cy="91" r="0.9" fill="#fff" />
            <rect className="p-lid" x="77" y="86" width="15" height="11" fill={L.skin} style={lid} />
            <rect className="p-lid" x="109" y="86" width="15" height="11" fill={L.skin} style={lid} />
          </g>
          <path className="p-brow l" d="M76 82 Q84 78 92 81" stroke={brow} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path className="p-brow r" d="M108 81 Q116 78 124 82" stroke={brow} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M100 96 Q97 108 100 110 Q103 111 105 109" stroke={L.shade} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          {/* Mouth: a resting line, and an opening that follows the voice */}
          <path className="p-rest" d="M89 121 Q100 126 111 121" stroke="#7a3b30" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path className="p-smile" d="M86 118 Q100 133 114 118" stroke="#7a3b30" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <ellipse className="p-mouth" cx="100" cy="123" rx="9" ry="6" fill="#4a1f1a" />
          {/* A real laugh: eyes creased shut and the mouth open wide */}
          <g className="p-laugh">
            <ellipse cx="84" cy="92" rx="7" ry="5.5" fill={L.skin} />
            <ellipse cx="116" cy="92" rx="7" ry="5.5" fill={L.skin} />
            <path d="M78 94 Q84 87 90 94 M110 94 Q116 87 122 94" stroke="#2a1d14" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <path d="M87 118 Q100 120 113 118 Q111 133 100 134 Q89 133 87 118 Z" fill="#4a1f1a" />
            <path d="M89 119 Q100 121 111 119 L110 122 Q100 124 90 122 Z" fill="#f4efe8" />
          </g>
          {L.glasses && (
            <g fill="none" stroke="#1d1b1a" strokeWidth="2.2">
              <rect x="74" y="84" width="20" height="15" rx="5" />
              <rect x="106" y="84" width="20" height="15" rx="5" />
              <path d="M94 90 L106 90 M74 89 L60 86 M126 89 L140 86" />
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}

/**
 * A host on the set: a photo-real portrait of the same invented person when photos are on (made once
 * from their look and kept), with the drawn portrait underneath until it loads, and instead of it if
 * it can't. The photo gets the same random life: tilts, nods, leaning toward whoever is speaking, and a
 * small lift with the voice. Its lips don't move; the drawn one's do.
 */
export function HostPortrait(props: PortraitProps & { photo?: boolean }) {
  const L = lookFor(props);
  const code = L.code;
  // Each face breathes at its own pace, so the two hosts never move together.
  const breathe = { animationDuration: `${4.2 + (L.h % 19) / 10}s`, animationDelay: `-${(L.h >>> 5) % 40 / 10}s` };
  // The server answers at once: the photo, "still being made" (ask again shortly), or none.
  // A short pause first, so typing a host's name or job on Create doesn't ask for a photo per keystroke.
  const photo = usePolledImage(props.photo ? `/api/portraits/${code}.jpg` : null, 700);
  // Shown once the image has actually drawn; a broken one falls back to the drawn host.
  const [shown, setShown] = useState<'no' | 'ok' | 'broken'>('no');
  useEffect(() => setShown('no'), [photo.src]);
  const state = photo.state === 'failed' || shown === 'broken' ? 'failed' : shown === 'ok' ? 'ok' : 'loading';
  const src = photo.src;
  const setState = (s: 'ok' | 'failed') => setShown(s === 'ok' ? 'ok' : 'broken');
  const wrap = useRef<HTMLDivElement>(null);
  // The photo's wrapper comes and goes (photos on or off, a failed photo), so its motion restarts with it.
  useLife(wrap, props.seat, props.mood ?? 'lively', `${!!props.photo}:${state === 'failed'}:${code}`);
  return (
    <>
      {/* Their own room behind the drawn portrait, matching the room in their photo. */}
      <div className={`set-room r${L.room}`} aria-hidden="true" />
      <Portrait {...props} />
      {props.photo && state !== 'failed' && (
        <div ref={wrap} className={`set-photo${state === 'ok' ? ' ok' : ''}`} aria-hidden="true">
          {src && <img src={src} alt="" style={breathe} onLoad={() => setState('ok')} onError={() => setState('failed')} />}
        </div>
      )}
    </>
  );
}
