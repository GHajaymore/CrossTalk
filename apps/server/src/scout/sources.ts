// Where the Scout looks (docs/PLAN.md, "Sources and access"). Titles, summaries and counts only:
// no article page is ever scraped. Every source sits behind one TopicSource interface. All free,
// no accounts or keys. Social posts are what people are saying, never facts.
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { ScoutCountry, ScoutRegion, ScoutSourceKey } from '@crosstalk/shared';

/** One story the Scout read, with the signals it uses to rank. */
export type Candidate = {
  /** Stable within a run, e.g. "hn:123". The ranker must cite these; it never invents a link. */
  id: string;
  source: string;
  title: string;
  url: string;
  excerpt: string;
  /** Hacker News points / comments, Wikipedia views. */
  points?: number;
  comments?: number;
  views?: number;
  /** Social posts are opinions; the ranker never turns them into facts. */
  kind?: 'news' | 'social' | 'search' | 'reference';
  /** Where the outlet is based, so a brief can draw on more than one part of the world. */
  home?: ScoutRegion;
};

export interface TopicSource {
  /** Which Scout source setting switches it on and off. */
  readonly key: ScoutSourceKey;
  readonly name: string;
  gather(signal: AbortSignal): Promise<Candidate[]>;
}

type Fetch = typeof fetch;
// Wikimedia asks every client to say who it is.
const HEADERS = { 'User-Agent': 'CrossTalk/0.1 (personal prototype; topic suggestions)', Accept: 'application/json' };

async function getJson<T>(f: Fetch, url: string, signal: AbortSignal): Promise<T> {
  const res = await f(url, { headers: HEADERS, signal });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return await res.json() as T;
}

/** Hacker News top stories (official API, no key). */
export class HackerNewsSource implements TopicSource {
  readonly key = 'hn';
  readonly name = 'Hacker News';
  constructor(private f: Fetch, private limit = 20) {}
  async gather(signal: AbortSignal) {
    const ids = (await getJson<number[]>(this.f, 'https://hacker-news.firebaseio.com/v0/topstories.json', signal)).slice(0, this.limit);
    type Item = { id: number; title?: string; url?: string; score?: number; descendants?: number; type?: string; dead?: boolean; deleted?: boolean };
    const items = await Promise.allSettled(ids.map(id => getJson<Item>(this.f, `https://hacker-news.firebaseio.com/v0/item/${id}.json`, signal)));
    return items.flatMap(r => {
      const it = r.status === 'fulfilled' ? r.value : null;
      if (!it?.title || it.type !== 'story' || it.dead || it.deleted) return [];
      const discussion = `https://news.ycombinator.com/item?id=${it.id}`;
      return [{
        id: `hn:${it.id}`, source: this.name, title: it.title, url: it.url ?? discussion,
        excerpt: `${it.score ?? 0} points, ${it.descendants ?? 0} comments on Hacker News.`,
        points: it.score ?? 0, comments: it.descendants ?? 0,
      }];
    });
  }
}

/** Wikipedia's most-read articles (Wikimedia REST API, no key): yesterday's list, from today's feed. */
export class WikipediaSource implements TopicSource {
  readonly key = 'wikipedia';
  readonly name = 'Wikipedia most-read';
  constructor(private f: Fetch, private day: () => Date, private limit = 15) {}
  async gather(signal: AbortSignal) {
    type Feed = { mostread?: { articles?: { titles?: { normalized?: string }; extract?: string; views?: number; content_urls?: { desktop?: { page?: string } } }[] } };
    const path = (d: Date) => `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
    // Today's feed lists yesterday's most-read; early in the (UTC) day it may not be ready, so fall back a day.
    const today = this.day();
    let feed = await getJson<Feed>(this.f, `https://en.wikipedia.org/api/rest_v1/feed/featured/${path(today)}`, signal).catch(() => ({} as Feed));
    if (!feed.mostread?.articles?.length) {
      feed = await getJson<Feed>(this.f, `https://en.wikipedia.org/api/rest_v1/feed/featured/${path(new Date(today.getTime() - 24 * 3600_000))}`, signal);
    }
    return (feed.mostread?.articles ?? []).slice(0, this.limit).flatMap(a => {
      const title = a.titles?.normalized, url = a.content_urls?.desktop?.page;
      if (!title || !url) return [];
      return [{ id: `wp:${title}`, source: this.name, title, url, excerpt: (a.extract ?? '').slice(0, 400), views: a.views ?? 0, kind: 'reference' as const }];
    });
  }
}

const safeChar = (n: number) => (n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '');
const decode = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' } as Record<string, string>)[e])
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => safeChar(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => safeChar(Number(n)))
  // Feeds often escape their HTML, so tags can appear only after decoding.
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ').trim();
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))?.[1] ?? '';

/** RSS 2.0 or Atom feeds: yours from SCOUT_RSS_FEEDS, the built-in news sites, or Reddit communities. */
/** `mine` marks a site the listener added: fetched only after the public-address checks below. */
export type Feed = string | { url: string; home?: ScoutRegion; mine?: boolean };

// ---- Sites you add: only public https websites, never this server's own network ----------------
export type Lookup = (host: string) => Promise<{ address: string }[]>;
const systemLookup: Lookup = host => dnsLookup(host, { all: true });
const PRIVATE_IP = [
  /^0\./, /^10\./, /^127\./, /^169\.254\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^::1?$/, /^f[cd][0-9a-f]{2}:/i, /^fe[89ab][0-9a-f]:/i, /^::ffff:/i,
];
export const isPrivateAddress = (ip: string) => PRIVATE_IP.some(r => r.test(ip));

/** Throws unless the link is a public https website (checked by address, not just by name). */
export async function assertPublicUrl(url: string, lookup: Lookup = systemLookup) {
  let u: URL;
  try { u = new URL(url); } catch { throw new Error('That isn\'t a valid link.'); }
  if (u.protocol !== 'https:') throw new Error('Only https:// sites can be added.');
  if (u.username || u.password) throw new Error('Links with a password in them can\'t be added.');
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || /\.(localhost|local|internal|lan|home|corp)$/.test(host) || !host.includes('.') && !isIP(host)) {
    throw new Error(`${host} isn't a public website.`);
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host).catch(() => [] as { address: string }[]);
  if (!addresses.length) throw new Error(`${host} couldn't be found.`);
  if (addresses.some(a => isPrivateAddress(a.address))) throw new Error(`${host} isn't a public website.`);
}

/** Fetches a site you added: every hop of a redirect is checked again, and at most 1.5 MB is read. */
async function fetchPublic(f: Fetch, url: string, init: RequestInit, lookup: Lookup): Promise<string> {
  let current = url;
  for (let hop = 0; hop <= 3; hop++) {
    await assertPublicUrl(current, lookup);
    const res = await f(current, { ...init, redirect: 'manual' });
    const next = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && next) { current = new URL(next, current).toString(); continue; }
    if (!res.ok) throw new Error(`${new URL(current).host} answered ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) return '';
    const parts: Uint8Array[] = [];
    let size = 0;
    for (let r = await reader.read(); !r.done; r = await reader.read()) {
      parts.push(r.value); size += r.value.length;
      if (size > 1_500_000) { await reader.cancel(); break; }
    }
    return new TextDecoder().decode(Buffer.concat(parts));
  }
  throw new Error('That site redirects too many times.');
}
export class RssSource implements TopicSource {
  constructor(
    private f: Fetch,
    private feeds: Feed[] | (() => Feed[]),
    private perFeed = 10,
    readonly name = 'RSS',
    readonly key: ScoutSourceKey = 'news',
    private kind: Candidate['kind'] = 'news',
    private prefix = 'rss',
    private lookup: Lookup = systemLookup,
  ) {}
  async gather(signal: AbortSignal) {
    const feeds = (typeof this.feeds === 'function' ? this.feeds() : this.feeds).map(x => (typeof x === 'string' ? { url: x } : x));
    const results = await Promise.allSettled(feeds.map(async ({ url: feed, home, mine }, f) => {
      const init = { headers: { ...HEADERS, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' }, signal };
      let xml: string;
      if (mine) xml = await fetchPublic(this.f, feed, init, this.lookup);
      else {
        const res = await this.f(feed, init);
        if (!res.ok) throw new Error(`${new URL(feed).host} answered ${res.status}`);
        xml = await res.text();
      }
      const name = decode(tag(xml, 'title')) || new URL(feed).host;
      const entries = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
      return entries.slice(0, this.perFeed).flatMap((e, i) => {
        const title = decode(tag(e, 'title'));
        const link = decode(tag(e, 'link')) || (e.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? '');
        if (!title || !/^https?:\/\//.test(link)) return [];
        // The feed's position keeps ids unique even when two feeds share a site.
        const excerpt = decode(tag(e, 'description') || tag(e, 'summary') || tag(e, 'content')).slice(0, 400);
        return [{ id: `${this.prefix}:${f}:${i}`, source: this.prefix === 'rss' ? `RSS: ${name}` : name, title, url: link, excerpt, kind: this.kind, ...(home ? { home } : {}) }];
      });
    }));
    // One story from each outlet in turn, so no single outlet sets the agenda.
    const lists = results.map(r => (r.status === 'fulfilled' ? r.value : []));
    const ok: Candidate[] = [];
    for (let i = 0; lists.some(l => i < l.length); i++) for (const l of lists) if (i < l.length) ok.push(l[i]);
    if (!ok.length && results.some(r => r.status === 'rejected')) throw new Error((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason?.message ?? 'No feed could be read.');
    return ok;
  }
}

// ---- Built-in free sources -------------------------------------------------------------------

/**
 * Public RSS from news outlets, several per region on purpose: outlets that lean different ways
 * (noted beside each) and are based in different places, so no single viewpoint sets the agenda.
 * World news always mixes three regions. Leanings are rough guides for balance, never shown as labels.
 */
type Outlet = { url: string; home: ScoutRegion };
const o = (url: string, home: ScoutRegion): Outlet => ({ url, home });
export const NEWS_FEEDS: Record<ScoutRegion, Outlet[]> = {
  world: [
    o('https://feeds.bbci.co.uk/news/world/rss.xml', 'europe'),         // public broadcaster, centre
    o('https://www.aljazeera.com/xml/rss/all.xml', 'mideast'),          // Qatar-funded, Global South focus
    o('https://rss.dw.com/rdf/rss-en-all', 'europe'),                   // German public broadcaster, centre
  ],
  na: [
    o('https://feeds.npr.org/1001/rss.xml', 'na'),                      // centre-left
    o('https://moxie.foxnews.com/google-publisher/latest.xml', 'na'),   // right
    o('https://thehill.com/feed/', 'na'),                               // centre
    o('https://www.cbc.ca/webfeed/rss/rss-topstories', 'na'),           // Canada, public broadcaster
  ],
  latam: [
    o('https://en.mercopress.com/rss', 'latam'),                        // South Atlantic news agency
    o('https://mexiconewsdaily.com/feed/', 'latam'),                    // Mexico
  ],
  europe: [
    o('https://www.theguardian.com/world/europe-news/rss', 'europe'),   // centre-left
    o('https://www.telegraph.co.uk/rss.xml', 'europe'),                 // centre-right
    o('https://www.france24.com/en/rss', 'europe'),                     // French public broadcaster
  ],
  mideast: [
    o('https://www.timesofisrael.com/feed/', 'mideast'),                // Israel
    o('https://www.arabnews.com/rss.xml', 'mideast'),                   // Saudi Arabia
  ],
  africa: [
    o('https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf', 'africa'), // pan-African aggregator
    o('https://feeds.bbci.co.uk/news/world/africa/rss.xml', 'africa'),
  ],
  asia: [
    o('https://timesofindia.indiatimes.com/rssfeedstopstories.cms', 'asia'), // India
    o('https://www.scmp.com/rss/91/feed', 'asia'),                      // Hong Kong
    o('https://www.japantimes.co.jp/feed/', 'asia'),                    // Japan
  ],
  oceania: [
    o('https://www.abc.net.au/news/feed/51120/rss.xml', 'oceania'),     // Australian public broadcaster
    o('https://www.rnz.co.nz/rss/national.xml', 'oceania'),             // New Zealand public broadcaster
  ],
  local: [],
};
const TOPIC_FEEDS: Outlet[] = [o('https://feeds.bbci.co.uk/news/technology/rss.xml', 'europe'), o('https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', 'europe')];

/** Where each followable country's news comes from. */
export const COUNTRY_REGION: Record<ScoutCountry, ScoutRegion> = {
  US: 'na', CA: 'na', MX: 'latam', BR: 'latam', AR: 'latam', CO: 'latam',
  GB: 'europe', IE: 'europe', FR: 'europe', DE: 'europe', ES: 'europe', IT: 'europe', NL: 'europe', PL: 'europe', UA: 'europe',
  TR: 'mideast', IL: 'mideast', SA: 'mideast', AE: 'mideast', EG: 'mideast',
  NG: 'africa', KE: 'africa', ZA: 'africa',
  IN: 'asia', PK: 'asia', BD: 'asia', JP: 'asia', KR: 'asia', SG: 'asia', PH: 'asia', ID: 'asia',
  AU: 'oceania', NZ: 'oceania',
};

/** The outlets to read: world news, your regions (and your countries' regions), science and tech, then your own sites. */
export function newsFeedsFor(regions: ScoutRegion[], countries: ScoutCountry[] = [], mine: string[] = []): Feed[] {
  const wanted = [...new Set([...regions, ...countries.map(c => COUNTRY_REGION[c])])];
  const all: { url: string; home?: ScoutRegion; mine?: boolean }[] = [...NEWS_FEEDS.world, ...wanted.flatMap(r => NEWS_FEEDS[r]), ...TOPIC_FEEDS, ...mine.map(url => ({ url, mine: true }))];
  const seen = new Set<string>();
  return all.filter(x => !seen.has(x.url) && !!seen.add(x.url));
}
export const newsSource = (f: Fetch, prefs: () => { regions: ScoutRegion[]; countries: ScoutCountry[]; feeds: string[] }, lookup: Lookup = systemLookup) =>
  new RssSource(f, () => { const p = prefs(); return newsFeedsFor(p.regions, p.countries, p.feeds); }, 5, 'News sites', 'news', 'news', 'news', lookup);

/** Debate-friendly Reddit communities, from their public RSS. Posts are opinions. */
export const REDDIT_FEEDS = ['changemyview', 'unpopularopinion', 'TrueAskReddit'].map(r => `https://www.reddit.com/r/${r}/top/.rss?t=day`);
export const redditSource = (f: Fetch) => new RssSource(f, REDDIT_FEEDS, 8, 'Reddit', 'reddit', 'social', 'reddit');

const TRENDS_GEO: Partial<Record<ScoutRegion, string>> = { na: 'US', world: 'US', latam: 'BR', europe: 'GB', mideast: 'AE', africa: 'NG', asia: 'IN', oceania: 'AU' };
/** What people are searching for today (Google Trends' free daily RSS): your countries, or one per region. */
export class GoogleTrendsSource implements TopicSource {
  readonly key = 'trends';
  readonly name = 'Google Trends';
  constructor(private f: Fetch, private prefs: () => { regions: ScoutRegion[]; countries: ScoutCountry[] }, private perGeo = 8) {}
  async gather(signal: AbortSignal) {
    const p = this.prefs();
    const geos = (p.countries.length ? [...p.countries] : [...new Set(p.regions.map(r => TRENDS_GEO[r]).filter((g): g is string => !!g))]).slice(0, 6);
    const results = await Promise.allSettled((geos.length ? geos : ['US']).map(async geo => {
      const res = await this.f(`https://trends.google.com/trending/rss?geo=${geo}`, { headers: { ...HEADERS, Accept: 'application/rss+xml, application/xml' }, signal });
      if (!res.ok) throw new Error(`Google Trends answered ${res.status}`);
      const items = (await res.text()).match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
      return items.slice(0, this.perGeo).flatMap((e, i) => {
        const term = decode(tag(e, 'title'));
        const newsTitle = decode(tag(e, 'ht:news_item_title'));
        const url = decode(tag(e, 'ht:news_item_url')) || `https://trends.google.com/trending?geo=${geo}`;
        if (!term || !/^https?:\/\//.test(url)) return [];
        const traffic = Number(decode(tag(e, 'ht:approx_traffic')).replace(/[^\d]/g, '')) || 0;
        return [{ id: `trends:${geo}:${i}`, source: `Google Trends (${geo})`, title: `People are searching for "${term}"`, url,
          excerpt: newsTitle ? `In the news: ${newsTitle}` : '', views: traffic, kind: 'search' as const }];
      });
    }));
    const ok = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
    if (!ok.length && results.some(r => r.status === 'rejected')) throw new Error('Google Trends could not be read.');
    return ok;
  }
}

/** Trending topics on Bluesky and links people share on Mastodon (both free public APIs). Opinions, not facts. */
export class OpenSocialSource implements TopicSource {
  readonly key = 'social';
  readonly name = 'Bluesky & Mastodon';
  constructor(private f: Fetch, private limit = 10) {}
  async gather(signal: AbortSignal) {
    type Bsky = { topics?: { topic?: string; displayName?: string; link?: string }[] };
    type Masto = { url?: string; title?: string; description?: string; history?: { uses?: string }[] }[];
    const [bsky, masto] = await Promise.allSettled([
      getJson<Bsky>(this.f, 'https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrendingTopics', signal),
      getJson<Masto>(this.f, 'https://mastodon.social/api/v1/trends/links', signal),
    ]);
    const fromBsky: Candidate[] = bsky.status === 'fulfilled' ? (bsky.value.topics ?? []).slice(0, this.limit).flatMap((t, i) => {
      const title = t.displayName || t.topic;
      if (!title) return [];
      return [{ id: `bsky:${i}`, source: 'Bluesky trending', title: `Trending on Bluesky: ${title}`, url: t.link?.startsWith('/') ? `https://bsky.app${t.link}` : 'https://bsky.app', excerpt: 'What people are posting about; opinions, not facts.', kind: 'social' as const }];
    }) : [];
    const fromMasto: Candidate[] = masto.status === 'fulfilled' && Array.isArray(masto.value) ? masto.value.slice(0, this.limit).flatMap((l, i) => {
      if (!l.title || !l.url || !/^https?:\/\//.test(l.url)) return [];
      const uses = (l.history ?? []).reduce((n, h) => n + (Number(h.uses) || 0), 0);
      return [{ id: `masto:${i}`, source: 'Mastodon trending link', title: l.title, url: l.url, excerpt: `${(l.description ?? '').slice(0, 300)} (shared ${uses} times on Mastodon)`, comments: uses, kind: 'social' as const }];
    }) : [];
    if (!fromBsky.length && !fromMasto.length && (bsky.status === 'rejected' || masto.status === 'rejected')) throw new Error('Bluesky and Mastodon could not be read.');
    return [...fromBsky, ...fromMasto];
  }
}

/** Saved sample data, for mock mode and tests. Never touches the network. */
export class SampleSource implements TopicSource {
  constructor(readonly name: string, private items: Candidate[], private fail = false, readonly key: ScoutSourceKey = 'hn') {}
  async gather() {
    if (this.fail) throw new Error(`${this.name} is unreachable (simulated).`);
    return this.items;
  }
}
