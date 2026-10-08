// Today tray rules, shared so the screen and Autopilot always agree on the top pick.
import { SENSITIVE_CATS } from './constants';
import type { Audience, ScoutPrefs, ScoutTopic } from './schemas';

export const DEFAULT_SCOUT_PREFS: ScoutPrefs = {
  cats: ['tech', 'economy', 'business', 'global', 'science', 'sports', 'culture', 'society'],
  regions: ['local', 'na', 'world'],
  rank: 'split',
  place: '',
  autopilot: false,
};

export const isSensitive = (t: Pick<ScoutTopic, 'category'>) => (SENSITIVE_CATS as readonly string[]).includes(t.category);

/** The topics to show, in order: your topics and regions; politics and scandals never for Kids. */
export function scoutPicks(topics: ScoutTopic[], prefs: ScoutPrefs, audience: Audience = 'general') {
  return topics
    .filter(t => prefs.cats.includes(t.category) && prefs.regions.includes(t.region) && !(audience === 'kids' && isSensitive(t)))
    .sort((a, b) => (prefs.rank === 'buzz' ? b.buzz - a.buzz : a.split - b.split));
}

export const splitLabel = (split: number) => (split <= 56 ? 'Sharply divided' : split <= 62 ? 'Divided' : 'Leaning one way');
