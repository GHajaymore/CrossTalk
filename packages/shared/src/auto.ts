// Auto personalities and auto host names (docs/PLAN.md, "Speakers" and "Real people").
// Pure keyword rules, no model call, so the server and the Create screen always agree.
import { BRANCH_JOBS, BRANCH_TURNS, JOBS, MAX_TURNS, PERSONAS, STANCE_END_JOBS, STANCE_START_JOBS } from './constants';
import type { Audience, PersonaKey, SpeakerDraft, SpeakerId, Speakers, Temperature } from './schemas';

type Pair = [PersonaKey, PersonaKey];

export function autoPersonas(topic: string, audience: Audience): Pair {
  const t = topic.toLowerCase();
  let pair: Pair = ['optimist', 'skeptic'];
  if (/\bai\b|tech|software|coding|\bapps?\b|robot|business|startup|market|money|price/.test(t)) pair = ['optimist', 'skeptic'];
  else if (/food|restaurant|chef|\btip|golf|sport|game|music|movie|travel|hobby|\bpets?\b/.test(t)) pair = ['storyteller', 'comedian'];
  else if (/should|city|cities|\blaw|rule|\bban\b|work|school|vote|fair|right|tax|pedestrian|\bcars?\b/.test(t)) pair = ['pragmatist', 'philosopher'];
  else if (/science|health|space|climate|brain|sleep|study|evidence/.test(t)) pair = ['professor', 'skeptic'];

  const swaps: Partial<Record<Audience, Partial<Record<PersonaKey, PersonaKey>>>> = {
    kids: { skeptic: 'professor', contrarian: 'storyteller', philosopher: 'storyteller', pragmatist: 'professor' },
    teens: { philosopher: 'comedian' },
    expert: { comedian: 'professor', storyteller: 'pragmatist', optimist: 'pragmatist' },
  };
  const adjust = swaps[audience] ?? {};
  pair = pair.map(p => adjust[p] ?? p) as Pair;
  if (pair[0] === pair[1]) pair[1] = pair[0] === 'skeptic' ? 'optimist' : 'skeptic';
  return pair;
}

export type Region = 'local' | 'na' | 'europe' | 'asia' | 'world';

const NAME_POOLS: Record<Region, string[]> = {
  na: ['Wren', 'Hale', 'Maya', 'Theo', 'Juniper', 'Rowan', 'Ava', 'Elias', 'Nora', 'Miles', 'Quinn', 'Sage', 'Della', 'Grant'],
  local: ['Wren', 'Hale', 'June', 'Beau', 'Hazel', 'Cole', 'Ruby', 'Silas', 'Opal', 'Reid'],
  europe: ['Elena', 'Luca', 'Ingrid', 'Mateo', 'Clara', 'Henrik', 'Sofia', 'Émile', 'Freya', 'Nico', 'Margot', 'Anders'],
  asia: ['Aiko', 'Ravi', 'Mei', 'Kenji', 'Priya', 'Arjun', 'Hana', 'Jin', 'Sana', 'Kai', 'Lin', 'Dev'],
  world: ['Amara', 'Leo', 'Zara', 'Kofi', 'Lina', 'Mateo', 'Yuki', 'Omar', 'Isla', 'Ravi', 'Ines', 'Tariq'],
};
const NAME_KIDS = ['Pip', 'Juno', 'Ziggy', 'Bea', 'Milo', 'Poppy', 'Otto', 'Luna', 'Taffy', 'Moss'];
const NAME_TEENS = ['Jax', 'Riley', 'Nova', 'Ezra', 'Zoe', 'Kai', 'Remy', 'Sky', 'Indie', 'Bo'];
const SURNAMES = ['Vance', 'Okafor', 'Lindqvist', 'Moreau', 'Tanaka', 'Rao', 'Calder', 'Ashby', 'Ferreira', 'Kent'];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Same topic, audience and region always give the same pair. The two hosts never share a first letter. */
export function autoNames(topic: string, audience: Audience, region: Region = 'na'): [string, string] {
  const h = hash(topic.trim().toLowerCase() + audience + region);
  const pool = audience === 'kids' ? NAME_KIDS : audience === 'teens' ? NAME_TEENS : NAME_POOLS[region];
  const a = pool[h % pool.length];
  let i = (h >>> 5) % pool.length;
  while (pool[i][0] === a[0]) i = (i + 1) % pool.length;
  const b = pool[i];
  if (audience !== 'expert') return [a, b];
  const s1 = h % SURNAMES.length;
  let s2 = (h >>> 3) % SURNAMES.length;
  if (s2 === s1) s2 = (s2 + 1) % SURNAMES.length;
  return [`Dr. ${a} ${SURNAMES[s1]}`, `Prof. ${b} ${SURNAMES[s2]}`];
}

export const SPEAKER_IDS: SpeakerId[] = ['A', 'B'];

/** Fill in Auto names and personalities. Seats the listener set by hand are left alone. */
export function resolveSpeakers(
  topic: string,
  audience: Audience,
  drafts: { A: SpeakerDraft; B: SpeakerDraft },
  models: { A: string; B: string },
  /** Roles written for this topic by a model; the keyword rule is used when absent. */
  roles?: [string, string],
): Speakers {
  const names = autoNames(topic, audience);
  const personas = autoPersonas(topic, audience);
  const fitted = roles ?? autoRoles(topic);
  const one = (id: SpeakerId, i: number) => {
    const d = drafts[id];
    const persona = d.autoPersona ? personas[i] : d.persona;
    const name = d.autoName || !d.name.trim() ? names[i] : d.name.trim();
    const lens = persona === 'custom' ? d.lens.trim() || 'A voice of their own' : PERSONAS[persona].lens;
    const autoRole = d.autoRole ?? true;
    const role = autoRole || !d.role?.trim() ? fitted[i] : d.role.trim();
    return { id, name, autoName: d.autoName, persona, autoPersona: d.autoPersona, lens, role, autoRole, modelId: models[id] };
  };
  return { A: one('A', 0), B: one('B', 1) };
}

export const speakerFor = (seq: number): SpeakerId => (seq % 2 === 1 ? 'A' : 'B');
export const jobFor = (seq: number) => JOBS[seq - 1] ?? 'Continue';
/** How many turns this conversation has when finished: 16, or a branch point plus its 4 new turns. */
export const turnTotal = (c: { branchSeq: number | null }) => (c.branchSeq ? c.branchSeq + BRANCH_TURNS : MAX_TURNS);
/** A turn's job: the episode's 16 jobs, or the branch jobs after a branch point. */
export const jobIn = (c: { branchSeq: number | null }, seq: number) =>
  c.branchSeq && seq > c.branchSeq ? BRANCH_JOBS[seq - c.branchSeq - 1] ?? 'Continue' : jobFor(seq);
const TEMP_ORDER: Temperature[] = ['calm', 'lively', 'heated'];
/** One step up or down the Temperature dial. Kids stop at Lively. Null at either end. */
export function stepTemperature(t: Temperature, direction: 'up' | 'down', audience: Audience): Temperature | null {
  const next = TEMP_ORDER[TEMP_ORDER.indexOf(t) + (direction === 'up' ? 1 : -1)];
  if (!next || (audience === 'kids' && next === 'heated')) return null;
  return next;
}
export const personaLabel = (s: { persona: PersonaKey; lens: string }) =>
  s.persona === 'custom' ? s.lens : PERSONAS[s.persona].label;
/** What the name bar shows under a host's name: their role, else their personality. */
export const hostSubtitle = (s: { persona: PersonaKey; lens: string; role?: string }) => s.role || personaLabel(s);
export const initials = (name: string) =>
  name.replace(/^(Dr\.|Prof\.)\s+/, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
export const episodeLabel = (n: number) => `Ep. ${String(n).padStart(2, '0')}`;

/**
 * Host roles that fit the topic: two complementary, invented job profiles.
 * A keyword rule covers common subjects (and mock mode); in real mode the server asks a free
 * model to write roles for any topic and falls back to this.
 */
const ROLE_RULES: [RegExp, [string, string]][] = [
  [/work ?week|four-day|workday|office|remote work|employ|hiring|job/, ['Owner of a 20-person design studio', 'Researcher who studies how people work']],
  [/golf/, ['Head pro at a public golf club', 'Golf-course designer']],
  [/restaurant|chef|menu|food|cook|tipping|\btip/, ['Chef who runs a neighbourhood restaurant', 'Food writer who reviews restaurants']],
  [/pedestrian|\bcars?\b|street|traffic|cities|city|transit|transport|bike|parking/, ['City transport planner', 'Shop owner on a busy high street']],
  [/\bai\b|artificial intelligence|automation|independent business|small business|\bshops?\b|retail/, ['Owner of a small bakery and café', 'Consultant who sets up digital tools for small firms']],
  [/school|homework|teacher|education|student|exam/, ['Secondary-school teacher', 'Parent who sits on a school board']],
  [/health|sleep|doctor|medical|diet|fitness/, ['Family doctor', 'Researcher who studies everyday health habits']],
  [/climate|energy|environment|carbon|solar|electric/, ['Energy engineer', 'Researcher who studies climate policy']],
  [/money|price|tax|econom|rent|housing|interest rate|inflation/, ['Small-business accountant', 'Economist who studies household budgets']],
  [/software|coding|developer|\bapps?\b|tech|robot|startup/, ['Software engineer at a startup', 'Technology journalist']],
  [/sport|football|soccer|tennis|basketball|olympic/, ['Coach at a community sports club', 'Sports journalist']],
  [/music|film|movie|art|book|game/, ['Working musician and teacher', 'Culture critic']],
  [/travel|tourism|holiday|flight|airline/, ['Owner of a small travel agency', 'Travel writer']],
];

export function autoRoles(topic: string): [string, string] {
  const t = topic.toLowerCase();
  return ROLE_RULES.find(([re]) => re.test(t))?.[1] ?? ['Someone who deals with this every day at work', 'Researcher who studies this question'];
}

/** The hidden tag a host adds after saying how sure they are: "[stance: 70]". */
const STANCE_TAG = /\[\s*stance\s*:?\s*(\d{1,3})\s*%?\s*\]/gi;
/** Takes the stance tag out of a line: the words to keep, and the number (0–100), if there was one. */
export function extractStance(text: string): { text: string; stance: number | null } {
  let stance: number | null = null;
  const clean = text.replace(STANCE_TAG, (_, n: string) => { stance = Math.min(100, Number(n)); return ''; }).replace(/[ \t]+$/gm, '').trim();
  return { text: clean, stance };
}
/** While a line streams in, hide a stance tag that's still being written. */
export const hideStanceTag = (live: string) =>
  extractStance(live).text.replace(/\[(\s*s(t(a(n(c(e[\s:]*\d{0,3}%?\s*)?)?)?)?)?)?$/i, '').trimEnd();

/** Where each host started and ended on the Mind-change meter, from their stance lines. */
export function mindChange(turns: { seq: number; speakerId: SpeakerId; objective: string; stance?: number | null }[]) {
  const pick = (id: SpeakerId, jobs: readonly string[]) => turns.find(t => t.speakerId === id && jobs.includes(t.objective) && t.stance != null)?.stance ?? null;
  const row = (id: SpeakerId) => ({ start: pick(id, STANCE_START_JOBS), end: pick(id, STANCE_END_JOBS) });
  return { A: row('A'), B: row('B') };
}
