import { describe, expect, it } from 'vitest';
import { SCOUT_COUNTRIES, SCOUT_REGIONS } from '@crosstalk/shared';
import { buildApp } from '../src/app';
import { mockConfig } from '../src/config';
import { buildRankPrompt, parseRanking } from '../src/scout/rank';
import { assertPublicUrl, COUNTRY_REGION, isPrivateAddress, NEWS_FEEDS, newsFeedsFor, RssSource, type Candidate, type Lookup } from '../src/scout/sources';

const signal = () => new AbortController().signal;
const rss = (title: string, n: number) => `<rss><channel><title>${title}</title>${Array.from({ length: n }, (_, i) => `<item><title>${title} story ${i}</title><link>https://${title.toLowerCase()}.example/${i}</link></item>`).join('')}</channel></rss>`;

describe('every side, every place', () => {
  it('each region reads more than one outlet, and World mixes several regions', () => {
    for (const [region, outlets] of Object.entries(NEWS_FEEDS)) if (region !== 'local') expect(outlets.length, region).toBeGreaterThanOrEqual(2);
    expect(new Set(NEWS_FEEDS.world.map(o => o.home)).size).toBeGreaterThanOrEqual(2);
    expect(Object.keys(SCOUT_REGIONS)).toEqual(expect.arrayContaining(['latam', 'mideast', 'africa', 'oceania']));
    for (const c of Object.keys(SCOUT_COUNTRIES)) expect(COUNTRY_REGION[c as keyof typeof COUNTRY_REGION], c).toBeTruthy();
  });

  it('takes one story from each outlet in turn, so no single outlet sets the agenda', async () => {
    const f = (async (url: string) => new Response(String(url).includes('one') ? rss('One', 6) : rss('Two', 6))) as unknown as typeof fetch;
    const items = await new RssSource(f, ['https://one.example/rss', 'https://two.example/rss']).gather(signal());
    expect(items.slice(0, 4).map(i => i.source)).toEqual(['RSS: One', 'RSS: Two', 'RSS: One', 'RSS: Two']);
  });

  it('tells the ranker to show every side from more than one outlet, and what you care about', () => {
    const p = buildRankPrompt([], '', { interests: 'golf, AI in <b>healthcare</b>', countries: ['IN', 'BR'] });
    expect(p.system).toMatch(/Balance: show every side.*at least two different outlets.*never pick a side/);
    expect(p.system).toContain('especially interested in: golf, AI in bhealthcare/b');
    expect(p.system).toContain('follows these countries: India, Brazil');
    expect(buildRankPrompt([], '').system).not.toContain('especially interested');
  });

  it('each bullet keeps where its outlet is based', () => {
    const cands: Candidate[] = [
      { id: 'news:0:0', source: 'NPR', title: 'A', url: 'https://npr.example/a', excerpt: '', home: 'na' },
      { id: 'news:1:0', source: 'DW', title: 'B', url: 'https://dw.example/b', excerpt: '', home: 'europe' },
    ];
    const reply = JSON.stringify({ topics: [{ question: 'Q?', category: 'global', region: 'world', arguability: 80, bullets: [{ text: 'one', sourceId: 'news:0:0' }, { text: 'two', sourceId: 'news:1:0' }] }] });
    const [t] = parseRanking(reply, cands, { runId: 'r', date: 'd', at: 'a' });
    expect(t.bullets.map(b => b.home)).toEqual(['na', 'europe']);
    expect(t.sources).toEqual(['NPR', 'DW']);
  });
});

describe('sites you add are public websites only', () => {
  const publicDns: Lookup = async () => [{ address: '93.184.216.34' }];
  it('refuses http, passwords, private names and private addresses', async () => {
    await expect(assertPublicUrl('https://news.example/rss', publicDns)).resolves.toBeUndefined();
    await expect(assertPublicUrl('http://news.example/rss', publicDns)).rejects.toThrow(/https/);
    await expect(assertPublicUrl('https://me:pw@news.example/rss', publicDns)).rejects.toThrow(/password/);
    for (const u of ['https://localhost/x', 'https://printer.local/x', 'https://db.internal/x', 'https://intranet/x', 'https://127.0.0.1/x', 'https://[::1]/x', 'https://169.254.169.254/latest']) {
      await expect(assertPublicUrl(u, publicDns), u).rejects.toThrow(/public website|couldn't/);
    }
    // A public-looking name that points inside the network is refused too.
    await expect(assertPublicUrl('https://sneaky.example/rss', async () => [{ address: '10.0.0.5' }])).rejects.toThrow(/public website/);
    for (const ip of ['10.1.2.3', '172.20.0.1', '192.168.1.1', '127.0.0.1', '169.254.1.1', '100.64.0.1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ['93.184.216.34', '8.8.8.8', '2606:4700::1111']) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it('checks every redirect hop, and reads at most 1.5 MB', async () => {
    const lookup: Lookup = async host => [{ address: host === 'evil.example' ? '127.0.0.1' : '93.184.216.34' }];
    const hop = (async (url: string) => String(url).includes('start')
      ? new Response(null, { status: 302, headers: { location: 'https://evil.example/admin' } })
      : new Response(rss('Fine', 2))) as unknown as typeof fetch;
    const src = (feeds: string[], f: typeof fetch) => new RssSource(f, feeds.map(url => ({ url, mine: true })), 10, 'News sites', 'news', 'news', 'news', lookup);
    await expect(src(['https://news.example/start'], hop).gather(signal())).rejects.toThrow(/public website/);
    expect(await src(['https://news.example/feed'], hop).gather(signal())).toHaveLength(2);
    const huge = (async () => new Response(`<rss><channel><title>Big</title>${'<item><title>x</title><link>https://big.example/1</link></item>'.repeat(40_000)}</channel></rss>`)) as unknown as typeof fetch;
    const items = await src(['https://big.example/rss'], huge).gather(signal());
    expect(items.length).toBeLessThanOrEqual(10);
  });

  it('the settings route refuses a private or http site, and keeps up to 5', async () => {
    const { app } = buildApp(mockConfig({ dbPath: ':memory:' }));
    try {
      const prefs = (await app.inject({ url: '/api/scout' })).json().prefs;
      const put = (feeds: string[]) => app.inject({ method: 'PUT', url: '/api/scout/prefs', payload: { ...prefs, feeds } });
      expect((await put(['http://news.example/rss'])).statusCode).toBe(400);
      expect((await put(['https://localhost/rss'])).json().error).toMatch(/public website/);
      expect((await put(['https://192.168.0.10/rss'])).statusCode).toBe(400);
      expect((await put(Array.from({ length: 6 }, (_, i) => `https://n${i}.example/rss`))).statusCode).toBe(400);
      const ok = await put(['https://news.example/rss']);
      expect(ok.statusCode).toBe(200);
      expect(ok.json().prefs.feeds).toEqual(['https://news.example/rss']);
      expect(newsFeedsFor([], [], ok.json().prefs.feeds).at(-1)).toEqual({ url: 'https://news.example/rss', mine: true });
    } finally { await app.close(); }
  });
});
