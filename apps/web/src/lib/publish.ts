// Publish kit: ready-to-post words for each platform, written on this device from the episode itself
// (no AI call). Every text says plainly that it's AI-made, as the platforms ask.
import { ARTIST, episodeLabel, hasCrux, hostSubtitle, type ConversationView, type SpeakerId } from '@crosstalk/shared';
import { pointOf } from '../studio/DebateMap';

export type Platform = 'shorts' | 'social' | 'podcast';
export const PLATFORMS: Record<Platform, { label: string; help: string }> = {
  shorts: { label: 'YouTube Shorts', help: 'Paste the first line as the title (100 characters at most) and the rest as the description.' },
  social: { label: 'TikTok · Reels', help: 'One caption with the hashtags at the end.' },
  podcast: { label: 'Podcast', help: 'The episode description for Spotify, Apple Podcasts and the rest.' },
};

export const AI_NOTE = 'Made with AI: the two hosts and the artist are AI, and the conversation is AI-generated, not independently verified.';

const STOP = new Set('a an the and or but if of to in on for with at by from is are was were be been it its this that these those should would could can will do does did we you they our your their more most less than as about into over under how what why who when where which not no yes each every busiest biggest best worst better worse really just still ever never good bad'.split(' '));

/** Up to six hashtags: the show's own, then the topic's key words. */
export function hashtags(topic: string): string[] {
  const words = topic.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').split(/\s+/).map(w => w.replace(/^'+|'+$/g, '')).filter(w => w.length > 3 && !STOP.has(w.toLowerCase()));
  const seen = new Set<string>();
  const topical = words.sort((a, b) => b.length - a.length).filter(w => { const k = w.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 3)
    .map(w => `#${w[0].toUpperCase()}${w.slice(1).toLowerCase().replace(/[-']/g, '')}`);
  return ['#CrossTalk', '#BothSides', ...topical, '#AIpodcast'];
}

/** Where each host started and ended, as said on the show (percent "yes"). */
function landed(v: ConversationView) {
  return (['A', 'B'] as SpeakerId[]).flatMap(k => {
    const s = v.turns.filter(t => t.speakerId === k && t.stance != null).map(t => t.stance!);
    const [a, b] = [s[0], s[s.length - 1]];
    return s.length >= 2 ? [a === b ? `${v.speakers[k].name} stayed at ${a}% on yes.` : `${v.speakers[k].name} moved from ${a}% to ${b}% on yes.`] : [];
  });
}

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

/** The words to post on one platform. */
export function postText(v: ConversationView, p: Platform): string {
  const hosts = (['A', 'B'] as SpeakerId[]).map(k => `${v.speakers[k].name} (${hostSubtitle(v.speakers[k])})`).join(' and ');
  const cruxTurn = hasCrux(v.createdAt) ? v.turns.find(t => t.objective === 'Test') : undefined;
  const crux = cruxTurn ? `The crux, from ${v.speakers[cruxTurn.speakerId].name}: “${pointOf(cruxTurn.text)}”` : '';
  const art = v.artist?.state === 'done' ? `${ARTIST.name}, our AI artist, made “${v.artist.artTitle}” from the moment that stayed with her.` : '';
  const tags = hashtags(v.topic).join(' ');
  const moved = landed(v).join(' ');
  if (p === 'shorts') {
    return [
      clip(`${v.topic} · Two AI hosts, both sides`, 100),
      '',
      `${hosts} talk it through and look for the one thing that would change their minds.`,
      crux, moved, art,
      'Where do you stand? Tell us in the comments.',
      '',
      AI_NOTE,
      tags,
    ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n').trim();
  }
  if (p === 'social') {
    return [
      `${v.topic} 🤔`,
      crux || `${hosts} take both sides.`,
      moved,
      'Where do you stand? 👇',
      AI_NOTE,
      tags,
    ].filter(Boolean).join('\n\n');
  }
  return [
    `${episodeLabel(v.episode)} · ${v.topic}`,
    '',
    `Two AI hosts, ${hosts}, talk the question through from both sides, then name what would actually change their minds.`,
    crux, moved, art,
    '',
    `${v.turns.length} short turns. ${AI_NOTE}`,
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n').trim();
}
