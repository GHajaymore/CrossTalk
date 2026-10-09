// A host's look, as fixed traits: the drawn portrait and the photo portrait are both built from these,
// so a host looks like the same invented person either way. Only these traits (never a name, a job
// title or anything typed) ever describe a host to an image service.

export type Seat = 'A' | 'B';
export const HAIR_STYLES = ['short', 'long', 'curly', 'bun', 'buzz', 'wavy', 'bob'] as const;
export const OUTFITS = ['blazer', 'sweater', 'chef', 'scrubs', 'hivis', 'shirt'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
export type OutfitKind = (typeof OUTFITS)[number];
/** Skin tones 0–5, light to deep. Hair colours 0–5, plus 6 for grey. */
export type HostTraits = { seat: Seat; skin: number; style: HairStyle; hair: number; glasses: boolean; outfit: OutfitKind; h: number };

const SKIN_WORDS = ['very fair', 'fair', 'light olive', 'medium brown', 'brown', 'deep brown'];
const HAIR_WORDS = ['black', 'dark brown', 'brown', 'light brown', 'blonde', 'auburn', 'grey'];
const STYLE_WORDS: Record<HairStyle, string> = {
  short: 'short neat hair', long: 'long straight hair', curly: 'short curly hair', bun: 'hair tied back in a bun',
  buzz: 'very short buzz-cut hair', wavy: 'shoulder-length wavy hair', bob: 'a chin-length bob',
};
const OUTFIT_WORDS: Record<OutfitKind, (seatTone: string) => string> = {
  blazer: t => `a ${t} blazer over a light shirt`, sweater: t => `a ${t} crew-neck sweater`, chef: () => 'white chef\'s whites',
  scrubs: () => 'medical scrubs', hivis: () => 'a high-visibility work vest over a t-shirt', shirt: t => `a ${t} button-up shirt`,
};

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function outfitFor(role: string, h: number): OutfitKind {
  const r = role.toLowerCase();
  if (/\bchef|\bcook\b|baker|kitchen/.test(r)) return 'chef';
  if (/nurse|doctor|clinic|dentist|hospital|medic|paramedic|surgeon/.test(r)) return 'scrubs';
  if (/construct|builder|site|engineer on|plumb|electric|road|crew|warehouse|driver/.test(r)) return 'hivis';
  if (/lawyer|banker|director|manager|executive|owner|founder|policy|planner|official|economist|accountant/.test(r)) return 'blazer';
  if (/teacher|professor|research|scien|writer|librar|historian|analyst|student/.test(r)) return 'sweater';
  return h % 2 ? 'shirt' : 'sweater';
}

/** A host's look, stable for the same name, job and seat. */
export function hostTraits({ name, role, seat }: { name: string; role: string; seat: Seat }): HostTraits {
  const h = hash(`${seat}:${name}:${role}`);
  const older = /retired|veteran|senior|grand/i.test(role);
  return {
    seat, h,
    skin: h % 6,
    style: HAIR_STYLES[(h >>> 3) % HAIR_STYLES.length],
    hair: older ? 6 : (h >>> 7) % 6,
    glasses: /research|scien|professor|analyst|librar|account|economist|data|engineer|historian|writer/i.test(role) || (h >>> 11) % 5 === 0,
    outfit: outfitFor(role, h),
  };
}

/** A short code for a look, e.g. "A-3-curly-2-1-blazer": the photo's file name and cache key. */
export const lookCode = (t: HostTraits) => `${t.seat}-${t.skin}-${t.style}-${t.hair}-${t.glasses ? 1 : 0}-${t.outfit}`;

/** Reads a look code back, or null if it isn't one. The server accepts nothing else. */
export function parseLookCode(code: string): Omit<HostTraits, 'h'> | null {
  const m = /^([AB])-([0-5])-([a-z]+)-([0-6])-([01])-([a-z]+)$/.exec(code);
  if (!m || !(HAIR_STYLES as readonly string[]).includes(m[3]) || !(OUTFITS as readonly string[]).includes(m[6])) return null;
  return { seat: m[1] as Seat, skin: Number(m[2]), style: m[3] as HairStyle, hair: Number(m[4]), glasses: m[5] === '1', outfit: m[6] as OutfitKind };
}

/** The photo brief for an invented person, from the look's traits only. */
export function portraitPrompt(t: Omit<HostTraits, 'h'>) {
  const tone = t.seat === 'A' ? 'warm rust-brown' : 'deep teal';
  return [
    'Photorealistic head-and-shoulders portrait of a fictional podcast host, an invented person, not a celebrity',
    `${SKIN_WORDS[t.skin]} skin, ${HAIR_WORDS[t.hair]} hair, ${STYLE_WORDS[t.style]}${t.glasses ? ', wearing glasses' : ''}`,
    `wearing ${OUTFIT_WORDS[t.outfit](tone)}`,
    'friendly natural expression, looking slightly off camera, sitting in a cosy podcast studio with warm lamps, dark background, soft light, 85mm lens, shallow depth of field',
    'no text, no logo, no microphone in front of the face',
  ].join(', ');
}
