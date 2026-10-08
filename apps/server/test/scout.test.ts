import { describe, expect, it } from 'vitest';
import { SCOUT_NOTICE } from '@crosstalk/shared';
import { buildApp } from '../src/app';
import { mockConfig } from '../src/config';
import { openDb, Repo } from '../src/db/repo';
import { buildPrompt } from '../src/prompts/buildPrompt';
import { isNoGo } from '../src/scout/filter';
import { parseRanking } from '../src/scout/rank';
import { SAMPLE_HN, SAMPLE_RSS, SAMPLE_WIKIPEDIA } from '../src/scout/samples';
import { Scout } from '../src/scout/scout';
import { HackerNewsSource, RssSource, SampleSource, WikipediaSource, type Candidate } from '../src/scout/sources';
import { draft, INSTANT } from './helpers';

const at = (iso: string) => () => new Date(iso);
const meta = { runId: 'r', date: '2026-10-08', at: '' };

describe('Topic Scout: filtering and sourcing', () => {
  it('no-go stories (tragedy, crime, health scares, private lives) never reach the tray', async () => {
    const { app, scout } = buildApp(mockConfig({ dbPath: ':memory:' }), { timing: INSTANT });
    try {
      await scout.run();
      const topics = scout.tray();
      expect(topics.length).toBeGreaterThanOrEqual(3);
      const everything = JSON.stringify(topics);
      for (const word of ['killed', 'crash', 'Death', 'died', 'Measles', 'outbreak']) expect(everything).not.toContain(word);
      expect(isNoGo('Three killed as drone crashes into crowd')).toBe(true);
      expect(isNoGo('Should downtowns go car-free on weekends?')).toBe(false);
    } finally { await app.close(); }
  });

  it('rejects a brief bullet that cites no source the Scout read, and drops a topic left with fewer than 2', () => {
    const cands: Candidate[] = [{ id: 'hn:1', source: 'Hacker News', title: 'T', url: 'https://example.com/a', excerpt: '' }];
    const reply = JSON.stringify({ topics: [
      { question: 'Keep me?', category: 'tech', region: 'world', arguability: 80, bullets: [
        { text: 'Real one.', sourceId: 'hn:1' }, { text: 'Also real.', sourceId: 'hn:1' }, { text: 'Made up.', sourceId: 'hn:999' }] },
      { question: 'Drop me?', category: 'tech', region: 'world', arguability: 80, bullets: [
        { text: 'Real.', sourceId: 'hn:1' }, { text: 'Invented.', sourceId: 'nowhere' }] },
      { question: 'Was it murder?', category: 'tech', region: 'world', arguability: 99, bullets: [
        { text: 'a', sourceId: 'hn:1' }, { text: 'b', sourceId: 'hn:1' }] },
      { question: 'Bad tags?', category: 'gossip', region: 'mars', arguability: 50, bullets: [
        { text: 'a', sourceId: 'hn:1' }, { text: 'b', sourceId: 'hn:1' }] },
    ] });
    const topics = parseRanking(reply, cands, meta);
    expect(topics.map(t => t.question)).toEqual(['Keep me?']);
    expect(topics[0].bullets).toEqual([
      { text: 'Real one.', url: 'https://example.com/a', source: 'Hacker News' },
      { text: 'Also real.', url: 'https://example.com/a', source: 'Hacker News' },
    ]);
    expect(() => parseRanking('not json', cands, meta)).toThrow(/valid JSON/);
  });

  it('every link in the tray comes from a source, never from the model', async () => {
    const { app, scout } = buildApp(mockConfig({ dbPath: ':memory:' }), { timing: INSTANT });
    try {
      await scout.run();
      const known = new Set([...SAMPLE_HN, ...SAMPLE_WIKIPEDIA, ...SAMPLE_RSS].map(c => c.url));
      for (const t of scout.tray()) for (const b of t.bullets) expect(known.has(b.url)).toBe(true);
      // The sample ranking cites an invented source for one rail bullet: it is gone, the topic stays with 2.
      expect(scout.tray().find(t => t.question.startsWith('Are high-speed trains'))!.bullets).toHaveLength(2);
    } finally { await app.close(); }
  });
});

describe('Topic Scout: sources, schedule and Autopilot', () => {
  it('a failing source does not stop the others; all failing is reported plainly', async () => {
    const ok = new SampleSource('Hacker News', SAMPLE_HN), down = new SampleSource('RSS', SAMPLE_RSS, true);
    const { app, scout } = buildApp(mockConfig({ dbPath: ':memory:' }), { timing: INSTANT, scoutSources: [ok, down] });
    try {
      await scout.run();
      expect(scout.status().lastRun).toMatchObject({ state: 'ok', sourcesOk: ['Hacker News'], sourcesFailed: ['RSS'] });
      expect(scout.tray().length).toBeGreaterThan(0);
    } finally { await app.close(); }

    const none = buildApp(mockConfig({ dbPath: ':memory:' }), { timing: INSTANT, scoutSources: [down] });
    try {
      await none.scout.run();
      expect(none.scout.status().lastRun).toMatchObject({ state: 'failed', error: expect.stringMatching(/No source could be read/) });
      expect(none.scout.tray()).toEqual([]);
    } finally { await none.app.close(); }
  });

  it('runs once a day after SCOUT_TIME, and catches up once when the app starts late', async () => {
    let now = new Date(2026, 9, 8, 6, 30);
    const { app, scout } = buildApp(mockConfig({ dbPath: ':memory:', scoutTime: '07:00' }), { timing: INSTANT, now: () => now });
    try {
      scout.tick();
      await scout.settled();
      expect(scout.status().lastRun).toBeNull();
      now = new Date(2026, 9, 8, 9, 15); // started late: catch up
      scout.tick();
      await scout.settled();
      expect(scout.status().lastRun?.state).toBe('ok');
      const first = scout.status().lastRun!.id;
      scout.tick();
      await scout.settled();
      expect(scout.status().lastRun!.id).toBe(first);
    } finally { await app.close(); }
  });

  it('Autopilot makes at most one episode a day, from the top pick, with its brief', async () => {
    const { app, scout, repo, controller } = buildApp(mockConfig({ dbPath: ':memory:' }), { timing: INSTANT });
    try {
      scout.setPrefs({ ...scout.prefs(), autopilot: true });
      await scout.run();
      await scout.run();
      const runs = repo.scoutRunsOn(controller.today());
      const made = runs.map(r => r.autopilotConversationId).filter(Boolean);
      expect(made).toHaveLength(1);
      expect(repo.listConversations()).toHaveLength(1);
      const v = repo.view(made[0]!)!;
      expect(v).toMatchObject({ mode: 'debate', topic: 'Do AI coding tools make junior developers better or worse?' });
      expect(v.brief?.bullets.length).toBe(3);
      await controller.settled(v.id);
    } finally { await app.close(); }
  });

  it('Autopilot stays off by default, and skips when too few requests are left', async () => {
    const { app, scout, repo } = buildApp(mockConfig({ dbPath: ':memory:', dailyLimit: 10 }), { timing: INSTANT });
    try {
      await scout.run();
      expect(repo.listConversations()).toHaveLength(0);
      scout.setPrefs({ ...scout.prefs(), autopilot: true });
      await scout.run();
      expect(scout.status().lastRun?.autopilotNote).toMatch(/needs about 18 requests/);
      expect(repo.listConversations()).toHaveLength(0);
    } finally { await app.close(); }
  });

  it('in real mode the one ranking request counts, and the daily limit stops it', async () => {
    const repo = new Repo(openDb(':memory:'));
    let counted = 0;
    const make = (left: number) => new Scout(repo, {
      sources: [new SampleSource('Hacker News', SAMPLE_HN)], rank: async () => '{"topics": []}', counts: true,
      requestsLeft: () => left, countRequest: () => { counted++; }, autopilot: async () => 'x', onChange: () => {},
      today: () => '2026-10-08', time: '07:00',
    });
    await make(0).run();
    expect(repo.latestScoutRun()).toMatchObject({ state: 'failed', error: expect.stringMatching(/Daily request limit/) });
    expect(counted).toBe(0);
    await make(5).run();
    expect(counted).toBe(1);
  });
});

describe('Topic Scout: the brief on air', () => {
  it('the hosts get the brief as their only facts, and the export lists its sources', async () => {
    const { app, scout, controller } = buildApp(mockConfig({ dbPath: ':memory:' }), { timing: INSTANT });
    try {
      await scout.run();
      const topic = scout.tray()[0];
      const created = await app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft(topic.question), scoutTopicId: topic.id } });
      const v = created.json();
      expect(v.brief.id).toBe(topic.id);
      const req = { conversation: v, seq: 1, speaker: v.speakers.A, objective: 'Hello', history: [], brief: v.brief };
      const p = buildPrompt(req);
      expect(p.user).toContain(`<brief>\n- ${topic.bullets[0].text} (Hacker News)`);
      expect(p.system).toMatch(/only facts you know about what happened/);

      await controller.start(v.id); await controller.settled(v.id);
      const j = (await app.inject({ url: `/api/conversations/${v.id}/export.json` })).json();
      expect(j.notice).toBe(SCOUT_NOTICE);
      expect(j.sources).toEqual([{ name: 'Hacker News', url: topic.bullets[0].url }]);
      const md = (await app.inject({ url: `/api/conversations/${v.id}/export.md` })).body;
      expect(md).toContain("**Today's brief**");
      expect((await app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft(), scoutTopicId: 'nope' } })).statusCode).toBe(400);
    } finally { await app.close(); }
  });

  it('routes: read the tray, save preferences, run now', async () => {
    const { app } = buildApp(mockConfig({ dbPath: ':memory:' }), { timing: INSTANT });
    try {
      expect((await app.inject({ url: '/api/scout' })).json()).toMatchObject({ topics: [], prefs: { rank: 'split', autopilot: false }, status: { time: '07:00' } });
      const bad = await app.inject({ method: 'PUT', url: '/api/scout/prefs', payload: { cats: ['gossip'] } });
      expect(bad.statusCode).toBe(400);
      const prefs = { cats: ['tech'], regions: ['world'], rank: 'buzz', place: 'Columbus', autopilot: false };
      expect((await app.inject({ method: 'PUT', url: '/api/scout/prefs', payload: prefs })).json().prefs).toEqual(prefs);
      const ran = (await app.inject({ method: 'POST', url: '/api/scout/run' })).json();
      expect(ran.status.lastRun.state).toBe('ok');
      expect(ran.topics.length).toBeGreaterThan(0);
    } finally { await app.close(); }
  });
});

describe('live sources read the real formats', () => {
  const fake = (routes: Record<string, unknown>) => (async (url: string | URL) => {
    const key = String(url);
    const hit = Object.entries(routes).find(([k]) => key.includes(k));
    if (!hit) return new Response('nope', { status: 404 });
    return typeof hit[1] === 'string' ? new Response(hit[1]) : new Response(JSON.stringify(hit[1]));
  }) as typeof fetch;

  it('Hacker News', async () => {
    const f = fake({ 'topstories': [1, 2, 3], 'item/1.json': { id: 1, type: 'story', title: 'One', url: 'https://a.example/1', score: 10, descendants: 20 },
      'item/2.json': { id: 2, type: 'job', title: 'Hiring' }, 'item/3.json': { id: 3, type: 'story', title: 'Ask HN: three?', score: 5, descendants: 1 } });
    const items = await new HackerNewsSource(f).gather(new AbortController().signal);
    expect(items.map(i => [i.id, i.url, i.comments])).toEqual([['hn:1', 'https://a.example/1', 20], ['hn:3', 'https://news.ycombinator.com/item?id=3', 1]]);
  });

  it('Wikipedia most-read (yesterday)', async () => {
    const f = fake({ 'feed/featured/2026/10/07': { mostread: { articles: [
      { titles: { normalized: 'High-speed rail' }, extract: 'Trains.', views: 1000, content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/High-speed_rail' } } },
      { titles: {}, extract: 'no title' }] } } });
    const items = await new WikipediaSource(f, () => new Date('2026-10-08T12:00:00Z')).gather(new AbortController().signal);
    expect(items).toEqual([{ id: 'wp:High-speed rail', source: 'Wikipedia most-read', title: 'High-speed rail', url: 'https://en.wikipedia.org/wiki/High-speed_rail', excerpt: 'Trains.', views: 1000 }]);
  });

  it('RSS and Atom, with entities and CDATA', async () => {
    const rss = `<rss><channel><title>City Desk</title><item><title><![CDATA[Bike lanes &amp; parking]]></title><link>https://news.example/bikes</link><description>&lt;p&gt;A vote.&lt;/p&gt;</description></item></channel></rss>`;
    const atom = `<feed><title>Tech</title><entry><title>Chips</title><link href="https://tech.example/chips"/><summary>Fast.</summary></entry></feed>`;
    const items = await new RssSource(fake({ 'news.example/feed': rss, 'tech.example/atom': atom }), ['https://news.example/feed', 'https://tech.example/atom', 'https://down.example/x']).gather(new AbortController().signal);
    expect(items.map(i => [i.source, i.title, i.url, i.excerpt])).toEqual([
      ['RSS: City Desk', 'Bike lanes & parking', 'https://news.example/bikes', 'A vote.'],
      ['RSS: Tech', 'Chips', 'https://tech.example/chips', 'Fast.'],
    ]);
  });
});

describe('Topic Scout: review fixes', () => {
  it("a failed run never hides the last good topics", async () => {
    const good = new SampleSource('Hacker News', SAMPLE_HN);
    let fail = false;
    const flaky = { name: 'Hacker News', gather: async () => { if (fail) throw new Error('down'); return good.gather(); } };
    const { app, scout } = buildApp(mockConfig({ dbPath: ':memory:' }), { timing: INSTANT, scoutSources: [flaky] });
    try {
      await scout.run();
      const before = scout.tray().map(t => t.id);
      fail = true;
      await scout.run();
      expect(scout.status().lastRun?.state).toBe('failed');
      expect(scout.tray().map(t => t.id)).toEqual(before);
    } finally { await app.close(); }
  });

  it('two feeds on one site keep separate ids', async () => {
    const xml = (t: string) => `<rss><channel><title>${t}</title><item><title>${t} story</title><link>https://same.example/${t}</link></item></channel></rss>`;
    const f = (async (url: string) => new Response(xml(String(url).endsWith('world') ? 'World' : 'Tech'))) as unknown as typeof fetch;
    const items = await new RssSource(f, ['https://same.example/world', 'https://same.example/tech']).gather(new AbortController().signal);
    expect(new Set(items.map(i => i.id)).size).toBe(2);
  });

  it('one malformed topic never sinks the whole ranking', () => {
    const cands: Candidate[] = [{ id: 'hn:1', source: 'Hacker News', title: 'T', url: 'https://example.com/a', excerpt: '' }];
    const ok = { question: 'Fine?', category: 'tech', region: 'world', arguability: 'high', bullets: [{ text: 'a', sourceId: 'hn:1' }, { text: 'b', sourceId: 'hn:1' }] };
    const topics = parseRanking(JSON.stringify({ topics: [{ nonsense: true }, ok, ...Array(12).fill(ok)] }), cands, meta);
    expect(topics[0]).toMatchObject({ question: 'Fine?', split: 75 });
    expect(topics).toHaveLength(5);
  });

  it('politics and scandals are refused for Kids on the server too', async () => {
    const { app, repo } = buildApp(mockConfig({ dbPath: ':memory:' }), { timing: INSTANT });
    try {
      repo.insertScoutRun('r1', '2026-10-08', '', false);
      repo.insertTopics([{ id: 'pol', runId: 'r1', date: '2026-10-08', question: 'Should voting be mandatory?', category: 'politics', region: 'na', split: 52, buzz: 80, bullets: [{ text: 'x', url: 'https://example.com', source: 'RSS' }], sources: ['RSS'], createdAt: '' }]);
      const kids = await app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft('Should voting be mandatory?'), audience: 'kids', scoutTopicId: 'pol' } });
      expect(kids.statusCode).toBe(400);
      expect(kids.json().error).toMatch(/aren't used for Kids/);
      expect((await app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft('Should voting be mandatory?'), scoutTopicId: 'pol' } })).statusCode).toBe(201);
    } finally { await app.close(); }
  });
});
