// Where the Scout looks (docs/PLAN.md, "Sources and access"). Titles, summaries and counts only:
// no article page is ever scraped. Every source sits behind one TopicSource interface. All free,
// no accounts or keys. Social posts are what people are saying, never facts.
import type { ScoutRegion, ScoutSourceKey } from '@crosstalk/shared';

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
export class RssSource implements TopicSource {
  constructor(
    private f: Fetch,
    private feeds: string[] | (() => string[]),
    private perFeed = 10,
    readonly name = 'RSS',
    readonly key: ScoutSourceKey = 'news',
    private kind: Candidate['kind'] = 'news',
    private prefix = 'rss',
  ) {}
  async gather(signal: AbortSignal) {
    const feeds = typeof this.feeds === 'function' ? this.feeds() : this.feeds;
    const results = await Promise.allSettled(feeds.map(async (feed, f) => {
      const res = await this.f(feed, { headers: { ...HEADERS, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' }, signal });
      if (!res.ok) throw new Error(`${new URL(feed).host} answered ${res.status}`);
      const xml = await res.text();
      const name = decode(tag(xml, 'title')) || new URL(feed).host;
      const entries = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
      return entries.slice(0, this.perFeed).flatMap((e, i) => {
        const title = decode(tag(e, 'title'));
        const link = decode(tag(e, 'link')) || (e.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? '');
        if (!title || !/^https?:\/\//.test(link)) return [];
        // The feed's position keeps ids unique even when two feeds share a site.
        const excerpt = decode(tag(e, 'description') || tag(e, 'summary') || tag(e, 'content')).slice(0, 400);
        return [{ id: `${this.prefix}:${f}:${i}`, source: this.prefix === 'rss' ? `RSS: ${name}` : name, title, url: link, excerpt, kind: this.kind }];
      });
    }));
    const ok = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
    if (!ok.length && results.some(r => r.status === 'rejected')) throw new Error((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason?.message ?? 'No feed could be read.');
    return ok;
  }
}

// ---- Built-in free sources -------------------------------------------------------------------

/** Public RSS from well-known news sites, by the regions the listener follows (world news always). */
export const NEWS_FEEDS: Record<ScoutRegion, string[]> = {
  world: ['https://feeds.bbci.co.uk/news/world/rss.xml', 'https://www.theguardian.com/world/rss', 'https://www.aljazeera.com/xml/rss/all.xml'],
  na: ['https://feeds.npr.org/1001/rss.xml', 'https://www.cbc.ca/webfeed/rss/rss-topstories'],
  europe: ['https://feeds.bbci.co.uk/news/world/europe/rss.xml', 'https://www.theguardian.com/world/europe-news/rss'],
  asia: ['https://feeds.bbci.co.uk/news/world/asia/rss.xml'],
  local: [],
};
const TOPIC_FEEDS = ['https://feeds.bbci.co.uk/news/technology/rss.xml', 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml'];
export const newsFeedsFor = (regions: ScoutRegion[]) => [...new Set([...NEWS_FEEDS.world, ...regions.flatMap(r => NEWS_FEEDS[r]), ...TOPIC_FEEDS])];
export const newsSource = (f: Fetch, regions: () => ScoutRegion[]) => new RssSource(f, () => newsFeedsFor(regions()), 6, 'News sites', 'news', 'news', 'news');

/** Debate-friendly Reddit communities, from their public RSS. Posts are opinions. */
export const REDDIT_FEEDS = ['changemyview', 'unpopularopinion', 'TrueAskReddit'].map(r => `https://www.reddit.com/r/${r}/top/.rss?t=day`);
export const redditSource = (f: Fetch) => new RssSource(f, REDDIT_FEEDS, 8, 'Reddit', 'reddit', 'social', 'reddit');

const TRENDS_GEO: Partial<Record<ScoutRegion, string>> = { na: 'US', world: 'US', europe: 'GB', asia: 'IN' };
/** What people are searching for today (Google Trends' free daily RSS), by country. */
export class GoogleTrendsSource implements TopicSource {
  readonly key = 'trends';
  readonly name = 'Google Trends';
  constructor(private f: Fetch, private regions: () => ScoutRegion[], private perGeo = 10) {}
  async gather(signal: AbortSignal) {
    const geos = [...new Set(this.regions().map(r => TRENDS_GEO[r]).filter((g): g is string => !!g))];
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
