// Auto personalities and auto host names (docs/PLAN.md, "Speakers" and "Real people").
// Pure keyword rules, no model call, so the server and the Create screen always agree.
import { JOBS, PERSONAS } from './constants';
import type { Audience, PersonaKey, SpeakerDraft, SpeakerId, Speakers } from './schemas';

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
): Speakers {
  const names = autoNames(topic, audience);
  const personas = autoPersonas(topic, audience);
  const one = (id: SpeakerId, i: number) => {
    const d = drafts[id];
    const persona = d.autoPersona ? personas[i] : d.persona;
    const name = d.autoName || !d.name.trim() ? names[i] : d.name.trim();
    const lens = persona === 'custom' ? d.lens.trim() || 'A voice of their own' : PERSONAS[persona].lens;
    return { id, name, autoName: d.autoName, persona, autoPersona: d.autoPersona, lens, modelId: models[id] };
  };
  return { A: one('A', 0), B: one('B', 1) };
}

export const speakerFor = (seq: number): SpeakerId => (seq % 2 === 1 ? 'A' : 'B');
export const jobFor = (seq: number) => JOBS[seq - 1] ?? 'Continue';
export const personaLabel = (s: { persona: PersonaKey; lens: string }) =>
  s.persona === 'custom' ? s.lens : PERSONAS[s.persona].label;
export const initials = (name: string) =>
  name.replace(/^(Dr\.|Prof\.)\s+/, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
export const episodeLabel = (n: number) => `Ep. ${String(n).padStart(2, '0')}`;
