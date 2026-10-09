// A host's look, as fixed traits: the drawn portrait and the photo portrait are both built from these,
// so a host looks like the same invented person either way. Only these traits (never a name, a job
// title or anything typed) ever describe a host to an image service. A home country narrows the
// range of skin tones and hair a face is drawn from, and a known first name sets woman or man.
import { HOMES, homeOf, nameLook, type HomeCode } from './homes';

export type Seat = 'A' | 'B';
export const HAIR_STYLES = ['short', 'long', 'curly', 'bun', 'buzz', 'wavy', 'bob'] as const;
export const OUTFITS = ['blazer', 'sweater', 'chef', 'scrubs', 'hivis', 'shirt'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
export type OutfitKind = (typeof OUTFITS)[number];
/** Skin tones 0–5, light to deep. Hair colours 0–5, plus 6 for grey. */
/** A face's age, by decade: 2 for their 20s up to 6 for 60s and over. Always an adult. */
export type AgeDecade = 2 | 3 | 4 | 5 | 6;
export type HostTraits = {
  seat: Seat; skin: number; style: HairStyle; hair: number; glasses: boolean; outfit: OutfitKind; h: number;
  /** Fits the job: a student looks 20-something, a researcher or owner 30s to 50s, a retired chef 60s. */
  age?: AgeDecade;
  /** Which room they record in (see BACKDROPS): picked once per host, so it stays with their face. */
  room?: number;
  /** 'w' or 'm' when the name says so; left open otherwise. */
  look?: 'w' | 'm';
  home?: HomeCode;
};

/** Where each host records from: each one gets their own room. */
export const BACKDROPS = [
  'in a cosy home studio with warm lamps and a softly blurred bookshelf behind them',
  'in front of an exposed brick wall in a loft studio with a warm Edison bulb glowing behind them',
  'in a bright room with green plants and soft daylight from a window behind them',
  'in a modern podcast studio with grey acoustic foam panels and a soft blue accent light behind them',
  'in a wood-panelled radio booth with warm amber light',
  'in a calm study with a framed abstract painting and a reading lamp behind them',
  'in a small city apartment at dusk with blurred city lights through the window behind them',
  'in a sunlit café-style corner with soft out-of-focus shelves of coffee jars behind them',
] as const;
const AGE_WORDS: Record<AgeDecade, string> = {
  2: 'in their mid twenties', 3: 'in their thirties', 4: 'in their forties', 5: 'in their fifties', 6: 'in their sixties',
};
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

/** An age that fits the job title, varied a little by the host so not every researcher is 40. */
export function ageFor(role: string, h: number): AgeDecade {
  const r = role.toLowerCase();
  if (/retired|veteran|grand|elder|pensioner/.test(r)) return 6;
  if (/student|intern|apprentice|trainee|graduate|junior|rookie/.test(r)) return 2;
  if (/senior|professor|director|chief|head\b|head of|partner|judge|principal|dean|founder|owner|executive|surgeon|veteran/.test(r)) return h % 3 ? 5 : 4;
  if (/research|scien|doctor|lawyer|economist|engineer|planner|manager|accountant|analyst|historian|consultant|teacher|journalist|writer|critic|chef|nurse|coach|official|policy/.test(r)) return h % 3 === 0 ? 3 : h % 3 === 1 ? 4 : 5;
  return h % 2 ? 3 : 4;
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

/** A host's look, stable for the same name, job, seat and home. */
export function hostTraits({ name, role, seat, home }: { name: string; role: string; seat: Seat; home?: string }): HostTraits {
  const from = homeOf(home);
  const h = hash(`${seat}:${name}:${role}${from ? `:${from.code}` : ''}`);
  const age = ageFor(role, h >>> 15);
  const older = age === 6;
  const look = nameLook(name);
  const style = HAIR_STYLES[(h >>> 3) % HAIR_STYLES.length];
  return {
    seat, h,
    skin: from ? from.skins[h % from.skins.length] : h % 6,
    // A man named on the show doesn't get a bun or a bob in his photo.
    style: look === 'm' && (style === 'bun' || style === 'bob' || style === 'long') ? 'short' : style,
    // Grey at 60 and over; often going grey in the 50s.
    hair: older || (age === 5 && (h >>> 9) % 2 === 0) ? 6 : from ? from.hair[(h >>> 7) % from.hair.length] : (h >>> 7) % 6,
    glasses: /research|scien|professor|analyst|librar|account|economist|data|engineer|historian|writer/i.test(role) || (h >>> 11) % 5 === 0,
    outfit: outfitFor(role, h),
    age,
    // Even rooms for the left seat, odd for the right: the two hosts are never in the same room.
    room: ((h >>> 19) % (BACKDROPS.length / 2)) * 2 + (seat === 'A' ? 0 : 1),
    ...(look ? { look } : {}),
    ...(from ? { home: from.code } : {}),
  };
}

/** A short code for a look, e.g. "A-3-curly-2-1-blazer-a4-b2-w-KE": the photo's file name and cache key. */
export const lookCode = (t: HostTraits) =>
  `${t.seat}-${t.skin}-${t.style}-${t.hair}-${t.glasses ? 1 : 0}-${t.outfit}${t.age ? `-a${t.age}` : ''}${t.room != null ? `-b${t.room}` : ''}${t.look ? `-${t.look}` : ''}${t.home ? `-${t.home}` : ''}`;

/** Reads a look code back, or null if it isn't one. The server accepts nothing else. */
export function parseLookCode(code: string): Omit<HostTraits, 'h'> | null {
  const m = /^([AB])-([0-5])-([a-z]+)-([0-6])-([01])-([a-z]+)(?:-a([2-6]))?(?:-b([0-7]))?(?:-([wm]))?(?:-([A-Z]{2}))?$/.exec(code);
  if (!m || !(HAIR_STYLES as readonly string[]).includes(m[3]) || !(OUTFITS as readonly string[]).includes(m[6])) return null;
  if (m[10] && !(m[10] in HOMES)) return null;
  return {
    seat: m[1] as Seat, skin: Number(m[2]), style: m[3] as HairStyle, hair: Number(m[4]), glasses: m[5] === '1', outfit: m[6] as OutfitKind,
    ...(m[7] ? { age: Number(m[7]) as AgeDecade } : {}), ...(m[8] ? { room: Number(m[8]) } : {}),
    ...(m[9] ? { look: m[9] as 'w' | 'm' } : {}), ...(m[10] ? { home: m[10] as HomeCode } : {}),
  };
}

/** The photo brief for an invented person, from the look's traits only. */
export function portraitPrompt(t: Omit<HostTraits, 'h'>) {
  const tone = t.seat === 'A' ? 'warm rust-brown' : 'deep teal';
  return [
    `Photorealistic head-and-shoulders portrait of a fictional podcast host, an invented ${t.look === 'w' ? 'woman' : t.look === 'm' ? 'man' : 'person'}${t.home ? ` from ${homeOf(t.home)!.country}` : ''}, not a celebrity`,
    // Always a grown-up, looking their age: a researcher is never drawn as a teenager.
    `a mature adult ${AGE_WORDS[t.age ?? 4]}, with a face that looks their age and natural skin texture`,
    `${SKIN_WORDS[t.skin]} skin, ${HAIR_WORDS[t.hair]} hair, ${STYLE_WORDS[t.style]}${t.glasses ? ', wearing glasses' : ''}`,
    `wearing ${OUTFIT_WORDS[t.outfit](tone)}`,
    `friendly natural expression, looking slightly off camera, sitting ${BACKDROPS[t.room ?? 0]}, soft light, 85mm lens, shallow depth of field`,
    'no text, no logo, no microphone in front of the face',
  ].join(', ');
}
