// Where the Scout looks (docs/PLAN.md, "Sources and access"). Titles, summaries and counts only:
// no article page is ever scraped. Every source sits behind one TopicSource interface.

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
};

export interface TopicSource {
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

/** Wikipedia's most-read articles for yesterday (Wikimedia REST API, no key). */
export class WikipediaSource implements TopicSource {
  readonly name = 'Wikipedia most-read';
  constructor(private f: Fetch, private day: () => Date, private limit = 15) {}
  async gather(signal: AbortSignal) {
    const d = new Date(this.day().getTime() - 24 * 3600_000);
    const path = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
    type Feed = { mostread?: { articles?: { titles?: { normalized?: string }; extract?: string; views?: number; content_urls?: { desktop?: { page?: string } } }[] } };
    const feed = await getJson<Feed>(this.f, `https://en.wikipedia.org/api/rest_v1/feed/featured/${path}`, signal);
    return (feed.mostread?.articles ?? []).slice(0, this.limit).flatMap(a => {
      const title = a.titles?.normalized, url = a.content_urls?.desktop?.page;
      if (!title || !url) return [];
      return [{ id: `wp:${title}`, source: this.name, title, url, excerpt: (a.extract ?? '').slice(0, 400), views: a.views ?? 0 }];
    });
  }
}

const decode = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' } as Record<string, string>)[e])
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  // Feeds often escape their HTML, so tags can appear only after decoding.
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ').trim();
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'))?.[1] ?? '';

/** RSS 2.0 or Atom feeds you choose in SCOUT_RSS_FEEDS. */
export class RssSource implements TopicSource {
  readonly name = 'RSS';
  constructor(private f: Fetch, private feeds: string[], private perFeed = 10) {}
  async gather(signal: AbortSignal) {
    const results = await Promise.allSettled(this.feeds.map(async feed => {
      const res = await this.f(feed, { headers: { ...HEADERS, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' }, signal });
      if (!res.ok) throw new Error(`${new URL(feed).host} answered ${res.status}`);
      const xml = await res.text();
      const name = decode(tag(xml, 'title')) || new URL(feed).host;
      const entries = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
      return entries.slice(0, this.perFeed).flatMap((e, i) => {
        const title = decode(tag(e, 'title'));
        const link = decode(tag(e, 'link')) || (e.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? '');
        if (!title || !/^https?:\/\//.test(link)) return [];
        return [{ id: `rss:${new URL(feed).host}:${i}`, source: `RSS: ${name}`, title, url: link, excerpt: decode(tag(e, 'description') || tag(e, 'summary')).slice(0, 400) }];
      });
    }));
    const ok = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
    if (!ok.length && results.some(r => r.status === 'rejected')) throw new Error((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason?.message ?? 'No feed could be read.');
    return ok;
  }
}

/** Saved sample data, for mock mode and tests. Never touches the network. */
export class SampleSource implements TopicSource {
  constructor(readonly name: string, private items: Candidate[], private fail = false) {}
  async gather() {
    if (this.fail) throw new Error(`${this.name} is unreachable (simulated).`);
    return this.items;
  }
}
