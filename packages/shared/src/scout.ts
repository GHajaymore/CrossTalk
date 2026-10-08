// Today tray rules, shared so the screen and Autopilot always agree on the top pick.
import { SENSITIVE_CATS } from './constants';
import type { Audience, Rules, ScoutPrefs, ScoutTopic } from './schemas';

export const DEFAULT_RULES: Rules = { blocked: [], allowMature: true, allowHeated: true, allowPolitics: false, cueLimit: 3 };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** The first blocked word or phrase in a text, matched as whole words, ignoring case. */
export function blockedHit(text: string, blocked: string[]): string | null {
  for (const w of blocked) {
    const t = w.trim();
    if (t && new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(t)}($|[^\\p{L}\\p{N}])`, 'iu').test(text)) return t;
  }
  return null;
}

export const DEFAULT_SCOUT_PREFS: ScoutPrefs = {
  cats: ['tech', 'economy', 'business', 'global', 'science', 'sports', 'culture', 'society'],
  regions: ['local', 'na', 'world'],
  rank: 'split',
  place: '',
  autopilot: false,
  sources: ['news', 'trends', 'reddit', 'social', 'hn', 'wikipedia'],
};

export const isSensitive = (t: Pick<ScoutTopic, 'category'>) => (SENSITIVE_CATS as readonly string[]).includes(t.category);

/**
 * The topics to show, in order: your topics and regions, never hidden or blocked ones; politics and
 * scandals only when the Control room allows them, and never for Kids. Pinned topics come first.
 */
export function scoutPicks(topics: ScoutTopic[], prefs: ScoutPrefs, audience: Audience = 'general', rules: Rules = DEFAULT_RULES) {
  return topics
    .filter(t => !t.hidden && prefs.cats.includes(t.category) && prefs.regions.includes(t.region)
      && !(isSensitive(t) && (audience === 'kids' || !rules.allowPolitics))
      && !blockedHit(`${t.question} ${t.bullets.map(b => b.text).join(' ')}`, rules.blocked))
    .sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (prefs.rank === 'buzz' ? b.buzz - a.buzz : a.split - b.split));
}

export const splitLabel = (split: number) => (split <= 56 ? 'Sharply divided' : split <= 62 ? 'Divided' : 'Leaning one way');
