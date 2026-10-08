import { describe, expect, it } from 'vitest';
import { DEFAULT_SCOUT_PREFS } from '@crosstalk/shared';
import { openDb, Repo } from '../src/db/repo';
import { buildRankPrompt } from '../src/scout/rank';
import { Scout, ScoutError } from '../src/scout/scout';
import { GoogleTrendsSource, newsFeedsFor, OpenSocialSource, redditSource, SampleSource, type Candidate } from '../src/scout/sources';

const signal = () => new AbortController().signal;
const route = (map: Record<string, () => Response>) =>
  (async (url: string) => { const k = Object.keys(map).find(x => String(url).includes(x)); return k ? map[k]() : new Response('nope', { status: 404 }); }) as unknown as typeof fetch;

describe('the new free sources read their real formats', () => {
  it('Google Trends: what people search, with the headline they are reading, by country', async () => {
    const rss = `<rss><channel><title>Daily Search Trends</title>
      <item><title>return to office</title><ht:approx_traffic>200,000+</ht:approx_traffic>
        <ht:news_item><ht:news_item_title>Big employers ask staff back &amp; more</ht:news_item_title><ht:news_item_url>https://news.example/rto</ht:news_item_url></ht:news_item></item>
      <item><title></title></item></channel></rss>`;
    const asked: string[] = [];
    const f = (async (url: string) => { asked.push(String(url)); return new Response(rss); }) as unknown as typeof fetch;
    const items = await new GoogleTrendsSource(f, () => ({ regions: ['na', 'europe', 'local'], countries: [] })).gather(signal());
    expect(asked.map(u => new URL(u).searchParams.get('geo')).sort()).toEqual(['GB', 'US']);
    expect(items[0]).toMatchObject({ source: 'Google Trends (US)', title: 'People are searching for "return to office"', url: 'https://news.example/rto',
      excerpt: 'In the news: Big employers ask staff back & more', views: 200000, kind: 'search' });
  });

  it('Reddit: debate communities as opinions', async () => {
    const atom = `<feed><title>top scoring links : changemyview</title><entry><title>CMV: Tipping has gone too far</title><link href="https://www.reddit.com/r/changemyview/comments/abc/"/><content type="html">&lt;p&gt;Hear me out&lt;/p&gt;</content></entry></feed>`;
    const items = await redditSource(route({ 'reddit.com': () => new Response(atom) })).gather(signal());
    expect(items[0]).toMatchObject({ id: 'reddit:0:0', title: 'CMV: Tipping has gone too far', url: 'https://www.reddit.com/r/changemyview/comments/abc/', excerpt: 'Hear me out', kind: 'social', source: 'top scoring links : changemyview' });
  });

  it('Bluesky and Mastodon: trending, and one being down never stops the other', async () => {
    const bsky = { topics: [{ topic: 'fourdayweek', displayName: 'Four-day week', link: '/profile/trending.bsky.app/feed/1' }] };
    const masto = [{ url: 'https://news.example/a', title: 'Cities test car-free Sundays', description: 'A trial…', history: [{ uses: '40' }, { uses: '12' }] }, { url: 'javascript:x', title: 'bad' }];
    const both = await new OpenSocialSource(route({ 'bsky.app': () => Response.json(bsky), 'mastodon.social': () => Response.json(masto) })).gather(signal());
    expect(both.map(c => [c.title, c.url, c.kind])).toEqual([
      ['Trending on Bluesky: Four-day week', 'https://bsky.app/profile/trending.bsky.app/feed/1', 'social'],
      ['Cities test car-free Sundays', 'https://news.example/a', 'social'],
    ]);
    expect(both[1].comments).toBe(52);
    const half = await new OpenSocialSource(route({ 'mastodon.social': () => Response.json(masto) })).gather(signal());
    expect(half).toHaveLength(1);
    await expect(new OpenSocialSource(route({})).gather(signal())).rejects.toThrow(/could not be read/);
  });

  it('News sites follow the regions you choose, with world news always', () => {
    const urls = (r: Parameters<typeof newsFeedsFor>[0], c: Parameters<typeof newsFeedsFor>[1] = []) => newsFeedsFor(r, c).map(x => (typeof x === 'string' ? x : x.url));
    expect(urls(['europe']).some(u => u.includes('bbci.co.uk/news/world/rss.xml'))).toBe(true);
    expect(urls(['europe']).some(u => u.includes('europe'))).toBe(true);
    expect(urls(['europe']).some(u => u.includes('npr.org'))).toBe(false);
    expect(urls(['na']).some(u => u.includes('npr.org'))).toBe(true);
    // Following a country brings in its region's outlets.
    expect(urls([], ['IN']).some(u => u.includes('timesofindia'))).toBe(true);
  });
});

const ranking = (id: string) => JSON.stringify({ topics: [{ question: 'Q?', category: 'tech', region: 'world', arguability: 80, bullets: [{ text: 'a', sourceId: id }, { text: 'b', sourceId: id }] }] });
const cand = (id: string, extra: Partial<Candidate> = {}): Candidate => ({ id, source: id, title: `Story ${id}`, url: `https://example.com/${id}`, excerpt: '', ...extra });

describe('the Scout uses them fairly', () => {
  it('reads only the sources you switch on, and takes from each in turn', async () => {
    const repo = new Repo(openDb(':memory:'));
    let seen = '';
    const loud = Array.from({ length: 40 }, (_, i) => cand(`hn:${i}`, { points: 1000 - i, comments: 500 }));
    const scout = new Scout(repo, {
      sources: [new SampleSource('Hacker News', loud), new SampleSource('News sites', [cand('news:0:0'), cand('news:0:1')], false, 'news'), new SampleSource('Reddit', [cand('reddit:0:0', { kind: 'social' })], false, 'reddit')],
      rank: async p => { seen = p.user; return ranking('news:0:0'); }, counts: false, requestsLeft: () => 10, countRequest: () => {},
      autopilot: async () => 'x', today: () => '2026-10-08', time: '07:00',
    });
    await scout.run();
    // Thirty slots, but news isn't crowded out by Hacker News' big numbers.
    expect(seen).toContain('news:0:0');
    expect(seen).toContain('news:0:1');
    expect(seen).toContain('reddit:0:0 | [social]');
    scout.setPrefs({ ...DEFAULT_SCOUT_PREFS, sources: ['news'] });
    await scout.run();
    expect(seen).toContain('news:0:0');
    expect(seen).not.toContain('hn:');
    expect(seen).not.toContain('reddit:');
    expect(repo.latestScoutRun()!.sourcesOk).toEqual(['News sites']);
  });

  it('in real mode, Refresh waits 30 minutes after one that worked; scheduled runs and failed ones never wait', async () => {
    const repo = new Repo(openDb(':memory:'));
    let now = new Date('2026-10-08T12:00:00Z');
    let reply = ranking('news:0:0');
    const scout = new Scout(repo, {
      sources: [new SampleSource('News sites', [cand('news:0:0')], false, 'news')], rank: async () => reply, counts: true,
      requestsLeft: () => 10, countRequest: () => {}, autopilot: async () => 'x', today: () => '2026-10-08', time: '07:00', now: () => now,
    });
    await scout.run();
    expect(scout.status().refreshAfter).toBe('2026-10-08T12:30:00.000Z');
    expect(() => scout.run()).toThrow(ScoutError);
    try { scout.run(); } catch (e) { expect((e as ScoutError).message).toMatch(/refresh again in 30 min.*Show more is free/); expect((e as ScoutError).status).toBe(429); }
    await scout.run(true); // the daily schedule isn't held up
    now = new Date('2026-10-08T12:31:00Z');
    reply = 'not json';
    await scout.run(); // fails…
    expect(scout.status().refreshAfter).toBeNull(); // …so it can be retried straight away
  });

  it('tells the ranker that social posts and searches are never facts', () => {
    const p = buildRankPrompt([cand('reddit:0:0', { kind: 'social', source: 'Reddit' }), cand('news:0:0', { kind: 'news', source: 'BBC' })], '');
    expect(p.system).toMatch(/\[social\].*never state their claims as facts/);
    expect(p.user).toContain('reddit:0:0 | [social] Reddit |');
    expect(p.user).toContain('news:0:0 | [news] BBC |');
  });
});
