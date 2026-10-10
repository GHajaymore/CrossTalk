import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { mockConfig } from '../src/config';
import { picturePrompt } from '../src/pictures';
import { draft, INSTANT } from './helpers';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9, 9]);
async function settle(app: { inject: (o: { url: string }) => Promise<{ statusCode: number }> }, url: string) {
  for (let i = 0; i < 300; i++) {
    const r = await app.inject({ url });
    if (r.statusCode !== 202) return r;
    await new Promise(res => setTimeout(res, 2));
  }
  throw new Error('still pending');
}

describe("Iris's real paintings", () => {
  it('her brief, the tradition of a host\'s home and firm limits; never a name', () => {
    const p = picturePrompt({ imagePrompt: 'Two empty chairs in lamplight <script>', caption: 'x' }, 'Is a four-day week practical?', ['inkwash']);
    expect(p).toMatch(/^A real-looking cinematic photograph: Two empty chairs in lamplight/);
    expect(p).not.toContain('<');
    expect(p).toContain('feel of East Asia');
    expect(p).toMatch(/^A real-looking cinematic photograph: /);
    expect(p).toContain('no children');
    expect(p).toContain('no text, no words, no letters');
    expect(p).toContain('no real or famous people');
    // No brief (an old drawing): the question and the quote stand in.
    expect(picturePrompt({ imagePrompt: '', caption: 'Yeah, good point.' }, 'Should cities ban cars?', [])).toMatch(/question "Should cities ban cars\?".*Yeah, good point/);
  });

  it('is made once per drawing from her brief, fades in on the page later, and is kept', async () => {
    const asked: string[] = [];
    const f = (async (url: string) => { asked.push(decodeURIComponent(String(url))); return new Response(jpeg, { headers: { 'content-type': 'image/jpeg' } }); }) as unknown as typeof fetch;
    const t = buildApp(mockConfig({ dbPath: ':memory:', dailyLimit: 500 }), { timing: INSTANT, fetch: f });
    try {
      const d = draft();
      const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: { ...d, length: 'short', speakers: { ...d.speakers, B: { ...d.speakers.B, home: 'MX' } } } })).json().id;
      await t.controller.start(id); await t.controller.settled(id);
      await t.iris.settled(id);
      const a = t.repo.view(id)!.artist!;
      expect(a.artStyle).toBe('picture');
      expect(a.imagePrompt.split(' ').length).toBeGreaterThan(25);
      const url = `/api/iris/picture/${id}/${a.version}.jpg`;
      expect((await t.app.inject({ url })).statusCode).toBe(202);
      const got = await settle(t.app, url) as Awaited<ReturnType<typeof t.app.inject>>;
      expect(got.statusCode).toBe(200);
      expect(got.rawPayload).toEqual(jpeg);
      const pics = asked.filter(u => u.includes('width=1024'));
      expect(pics).toHaveLength(1);
      expect(pics[0]).toContain(a.imagePrompt.slice(0, 40));
      expect(pics[0]).toContain('feel of Latin America');
      expect(pics[0]).not.toContain(t.repo.view(id)!.speakers.A.name);
      await t.app.inject({ url });
      expect(asked.filter(u => u.includes('width=1024'))).toHaveLength(1);
      // Only real drawings: a made-up episode or version, or a bad id, never reaches the service.
      for (const bad of [`/api/iris/picture/${id}/99.jpg`, '/api/iris/picture/not-an-id/1.jpg', `/api/iris/picture/${id}/0.jpg`]) expect((await t.app.inject({ url: bad })).statusCode, bad).toBe(404);
      expect(asked.filter(u => u.includes('width=1024'))).toHaveLength(1);
    } finally { await t.app.close(); }
  });

  it('also makes her Dreamscape and Sketch as AI art, each kept apart, only once she shows them in that style', async () => {
    const asked: string[] = [];
    const f = (async (url: string) => { asked.push(decodeURIComponent(String(url))); return new Response(jpeg, { headers: { 'content-type': 'image/jpeg' } }); }) as unknown as typeof fetch;
    const t = buildApp(mockConfig({ dbPath: ':memory:', dailyLimit: 500 }), { timing: INSTANT, fetch: f });
    try {
      const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft(), length: 'short' } })).json().id;
      await t.controller.start(id); await t.controller.settled(id); await t.iris.settled(id);
      const v = t.repo.view(id)!.artist!.version;
      const dream = `/api/iris/picture/${id}/${v}.jpg?style=dreamscape`;
      // Not shown as a dreamscape yet: nothing is asked for.
      expect((await t.app.inject({ url: dream })).statusCode).toBe(404);
      expect((await t.app.inject({ method: 'PUT', url: `/api/conversations/${id}/artist/style`, payload: { style: 'dreamscape' } })).statusCode).toBe(200);
      expect((await t.app.inject({ url: dream })).statusCode).toBe(202);
      expect(((await settle(t.app, dream)) as Awaited<ReturnType<typeof t.app.inject>>).statusCode).toBe(200);
      const prompt = asked.find(u => u.includes('surreal, dreamlike'))!;
      expect(prompt).toBeTruthy();
      // Camera words from her photo brief don't belong in a dream.
      expect(prompt.split('?')[0]).not.toMatch(/\b35mm\b|shallow depth of field/);
      expect(prompt).toContain('no children');
      // The sketch is its own picture.
      await t.app.inject({ method: 'PUT', url: `/api/conversations/${id}/artist/style`, payload: { style: 'sketch' } });
      const sketch = `/api/iris/picture/${id}/${v}.jpg?style=sketch`;
      expect(((await settle(t.app, sketch)) as Awaited<ReturnType<typeof t.app.inject>>).statusCode).toBe(200);
      expect(asked.some(u => u.includes('graphite pencil sketch'))).toBe(true);
      expect(t.repo.getPicture(id, v, 'dreamscape')).not.toBeNull();
      expect(t.repo.getPicture(id, v, 'sketch')).not.toBeNull();
      // A style that isn't AI art is never asked for.
      expect((await t.app.inject({ url: `/api/iris/picture/${id}/${v}.jpg?style=painting` })).statusCode).toBe(404);
    } finally { await t.app.close(); }
  });

  it('IRIS_PICTURES=off: no Picture style, nothing sent, and the restyle refuses it', async () => {
    const asked: string[] = [];
    const f = (async (url: string) => { asked.push(String(url)); return new Response(jpeg, { headers: { 'content-type': 'image/jpeg' } }); }) as unknown as typeof fetch;
    const t = buildApp(mockConfig({ dbPath: ':memory:', dailyLimit: 500, irisPictures: false }), { timing: INSTANT, fetch: f });
    try {
      const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft(), length: 'short' } })).json().id;
      await t.controller.start(id); await t.controller.settled(id); await t.iris.settled(id);
      expect(t.repo.view(id)!.artist!.artStyle).not.toBe('picture');
      expect((await t.app.inject({ url: `/api/iris/picture/${id}/1.jpg` })).statusCode).toBe(404);
      expect((await t.app.inject({ method: 'PUT', url: `/api/conversations/${id}/artist/style`, payload: { style: 'picture' } })).statusCode).toBe(400);
      expect((await t.app.inject({ url: '/api/config' })).json().irisPictures).toBe(false);
      expect(asked.filter(u => u.includes('pollinations'))).toHaveLength(0);
    } finally { await t.app.close(); }
  });
});

describe('painting guards from review', () => {
  it('only paints drawings shown as a Picture, prefers a real brief, and never picks a style that isn\'t allowed', async () => {
    const { defaultPaintStyle } = await import('@crosstalk/shared');
    expect(defaultPaintStyle({ mode: 'explore', temperature: 'calm' }, [])).toBe('painting');
    const asked: string[] = [];
    const f = (async (url: string) => { asked.push(decodeURIComponent(String(url))); return new Response(jpeg, { headers: { 'content-type': 'image/jpeg' } }); }) as unknown as typeof fetch;
    const t = buildApp(mockConfig({ dbPath: ':memory:', dailyLimit: 500 }), { timing: INSTANT, fetch: f });
    try {
      // A drawing she showed as a Sketch is never painted, even if someone asks for it.
      await t.app.inject({ method: 'PUT', url: '/api/iris/styles', payload: { styles: ['sketch'] } });
      const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft(), length: 'short' } })).json().id;
      await t.controller.start(id); await t.controller.settled(id); await t.iris.settled(id);
      expect(t.repo.view(id)!.artist!.artStyle).toBe('sketch');
      expect((await t.app.inject({ url: `/api/iris/picture/${id}/1.jpg` })).statusCode).toBe(404);
      expect(asked.filter(u => u.includes('width=1024'))).toHaveLength(0);
      // Switched to Picture: now it's painted, from her brief (an older empty row doesn't win).
      t.repo.db.prepare("UPDATE artworks SET image_prompt = '' WHERE conversation_id = ?").run(id);
      await t.app.inject({ method: 'PUT', url: `/api/conversations/${id}/artist/style`, payload: { style: 'picture' } });
      expect((await settle(t.app, `/api/iris/picture/${id}/1.jpg`)).statusCode).toBe(200);
      expect(asked.find(u => u.includes('width=1024'))).toContain(t.repo.view(id)!.artist!.imagePrompt.slice(0, 40));
    } finally { await t.app.close(); }
  });

  it('Picture as the only tick, with paintings off: her line styles stand in', async () => {
    const t = buildApp(mockConfig({ dbPath: ':memory:', dailyLimit: 500, irisPictures: false }), { timing: INSTANT });
    try {
      await t.app.inject({ method: 'PUT', url: '/api/iris/styles', payload: { styles: ['picture'] } });
      const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft(), length: 'short' } })).json().id;
      await t.controller.start(id); await t.controller.settled(id); await t.iris.settled(id);
      expect(['sketch', 'painting', 'dreamscape']).toContain(t.repo.view(id)!.artist!.artStyle);
    } finally { await t.app.close(); }
  });
});

describe('when the image service fails', () => {
  it('keeps the reason, for Settings', async () => {
    const { FreeImages, SerialQueue } = await import('../src/freeImages');
    const store = new Map<string, { mime: string; data: Buffer }>();
    let answer = () => new Response('Too many requests from this IP', { status: 402, headers: { 'content-type': 'text/plain' } });
    const maker = new FreeImages({
      f: (async () => answer()) as unknown as typeof fetch, now: () => new Date('2026-10-10T10:00:00Z'), queue: new SerialQueue(), perDay: 10, maxBytes: 1_000_000,
      job: k => ({ prompt: k, width: 64, height: 64, seedText: k }), saved: k => store.get(k) ?? null, save: (k, img) => { store.set(k, img); }, madeOn: () => 0, busyWaitMs: 1,
    });
    expect(await maker.get('a')).toBeNull();
    expect(maker.health).toMatchObject({ lastOkAt: null, lastError: 'The image service answered 402: Too many requests from this IP', lastErrorAt: '2026-10-10T10:00:00.000Z' });
    answer = () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/jpeg' } });
    expect(await maker.get('b')).not.toBeNull();
    expect(maker.health.lastOkAt).toBe('2026-10-10T10:00:00.000Z');
  });
});

describe('real AI photos from Cloudflare (free account)', () => {
  it('is used only with an account, a token and the free plan confirmed', async () => {
    const { loadConfig } = await import('../src/config');
    expect(loadConfig({}).imageService).toBe('pollinations');
    expect(loadConfig({ CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_API_TOKEN: 'tok' }).imageService).toBe('blocked');
    expect(loadConfig({ CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_PLAN: 'free' }).imageService).toBe('cloudflare');
  });

  it('asks FLUX.1 schnell for the photo, with the token only in the header, and reads the picture back', async () => {
    const { cloudflare, CLOUDFLARE_MODEL } = await import('../src/freeImages');
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
    const calls: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return Response.json({ success: true, result: { image: jpeg.toString('base64') } }); }) as unknown as typeof fetch;
    const made = await cloudflare('acc123', 'cf-SECRET-token').make({ prompt: 'A rainy street at dusk', width: 1024, height: 614, seedText: 'x' }, f, new AbortController().signal);
    expect(made).toEqual({ ok: true, img: { mime: 'image/jpeg', data: jpeg } });
    expect(CLOUDFLARE_MODEL).toBe('@cf/black-forest-labs/flux-1-schnell');
    expect(calls[0].url).toBe('https://api.cloudflare.com/client/v4/accounts/acc123/ai/run/@cf/black-forest-labs/flux-1-schnell');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer cf-SECRET-token');
    expect(String(calls[0].init.body)).not.toContain('cf-SECRET-token');
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ prompt: 'A rainy street at dusk' });
  });

  it("says plainly when the free daily allowance is spent, and doesn't keep retrying", async () => {
    const { cloudflare } = await import('../src/freeImages');
    const f = (async () => Response.json({ success: false, errors: [{ message: 'you have used up your daily free allocation of 10,000 neurons' }] }, { status: 429 })) as unknown as typeof fetch;
    const made = await cloudflare('a', 't').make({ prompt: 'x', width: 1, height: 1, seedText: 'x' }, f, new AbortController().signal);
    expect(made).toMatchObject({ ok: false, busy: false, reason: expect.stringMatching(/daily allowance is used up; it resets at 00:00 UTC/) });
  });

  it('shows in Settings which service makes the pictures, and a blocked Cloudflare explains itself', async () => {
    const built = buildApp({ ...mockConfig({ dbPath: ':memory:' }), imageService: 'blocked' });
    const cfg = (await built.app.inject({ url: '/api/config' })).json();
    expect(cfg.images.service).toBe('Cloudflare Workers AI');
    await built.app.close();
  });
});

describe('a mistyped Cloudflare Account ID', () => {
  it('is said plainly in Settings, not as a confusing 404', async () => {
    const built = buildApp({ ...mockConfig({ dbPath: ':memory:' }), imageService: 'cloudflare', cloudflare: { accountId: '5ca55034550e551f75539e8694f78b6', token: 't' } });
    // Ask for a host photo: it fails at once, with the reason.
    const code = 'A-2-short-1-0-shirt-a3-b1';
    expect((await built.app.inject({ url: `/api/portraits/${code}.jpg` })).statusCode).toBe(202);
    await new Promise(r => setTimeout(r, 20));
    const cfg = (await built.app.inject({ url: '/api/config' })).json();
    expect(cfg.images.portraits.lastError).toMatch(/CLOUDFLARE_ACCOUNT_ID should be 32 letters and numbers, but it has 31/);
    await built.app.close();
  });
});

describe('try the camera', () => {
  it('makes one picture from your words, with the usual limits, never kept, at most 10 a day', async () => {
    const asked: string[] = [];
    const f = (async (url: string) => { asked.push(decodeURIComponent(String(url))); return new Response(jpeg, { headers: { 'content-type': 'image/jpeg' } }); }) as unknown as typeof fetch;
    const t = buildApp(mockConfig({ dbPath: ':memory:' }), { fetch: f });
    try {
      const res = await t.app.inject({ method: 'POST', url: '/api/images/try', payload: { prompt: 'A wooden door open onto snowy mountains <b>' } });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('image/jpeg');
      expect(res.rawPayload).toEqual(jpeg);
      expect(asked[0]).toContain('A wooden door open onto snowy mountains');
      expect(asked[0]).not.toContain('<b>');
      expect(asked[0]).toContain('no real or famous people');
      expect((await t.app.inject({ method: 'POST', url: '/api/images/try', payload: { prompt: '' } })).statusCode).toBe(400);
      for (let i = 0; i < 9; i++) await t.app.inject({ method: 'POST', url: '/api/images/try', payload: { prompt: `try ${i}` } });
      const over = await t.app.inject({ method: 'POST', url: '/api/images/try', payload: { prompt: 'one more' } });
      expect(over.statusCode).toBe(429);
      expect(over.json().error).toMatch(/today's 10 tries/);
    } finally { await t.app.close(); }
  });
});
