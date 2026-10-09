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
    expect(p).toMatch(/^Two empty chairs in lamplight/);
    expect(p).not.toContain('<');
    expect(p).toContain('East Asian ink-wash');
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
      expect(pics[0]).toContain('Latin American folk art');
      expect(pics[0]).not.toContain(t.repo.view(id)!.speakers.A.name);
      await t.app.inject({ url });
      expect(asked.filter(u => u.includes('width=1024'))).toHaveLength(1);
      // Only real drawings: a made-up episode or version, or a bad id, never reaches the service.
      for (const bad of [`/api/iris/picture/${id}/99.jpg`, '/api/iris/picture/not-an-id/1.jpg', `/api/iris/picture/${id}/0.jpg`]) expect((await t.app.inject({ url: bad })).statusCode, bad).toBe(404);
      expect(asked.filter(u => u.includes('width=1024'))).toHaveLength(1);
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
