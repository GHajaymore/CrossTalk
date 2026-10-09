import { artworkSvg, defaultPaintStyle, paintSvg, type ConversationView } from '@crosstalk/shared';
import { describe, expect, it } from 'vitest';
import { favouriteStyle, Iris, type ArtistBackend } from '../src/artist/iris';
import { mockSketch } from '../src/artist/mockSketches';
import { buildIrisPrompt } from '../src/artist/prompt';
import { buildApp } from '../src/app';
import { mockConfig } from '../src/config';
import { draft, setup } from './helpers';

const sketch = mockSketch('four-day workweek').svg;

describe('Iris paints her sketch', () => {
  it('leaves a sketch as it is, and paints the same lines for Painting and Dreamscape', () => {
    expect(paintSvg(sketch, 'sketch', 'ep')).toBe(sketch);
    const lines = sketch.match(/<g [\s\S]*<\/g>/)![0];
    for (const style of ['painting', 'dreamscape'] as const) {
      const out = paintSvg(sketch, style, 'ep');
      expect(out.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360">')).toBe(true);
      expect(out).toContain(lines);
      expect(out).toContain('<filter');
      // Nothing that could run or fetch anything: no scripts, links, images or outside references.
      expect(out).not.toMatch(/<script|href|<image|<foreignObject|url\((?!#)|javascript:|on\w+=/i);
    }
  });

  it('paints the same picture every time for an episode, and a different one for another', () => {
    expect(paintSvg(sketch, 'painting', 'ep-1')).toBe(paintSvg(sketch, 'painting', 'ep-1'));
    expect(paintSvg(sketch, 'dreamscape', 'ep-1')).not.toBe(paintSvg(sketch, 'dreamscape', 'ep-2'));
  });

  it('keeps line settings from her outer <svg> and drops her own background', () => {
    const own = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" fill="none" stroke-width="3"><rect x="0" y="0" width="300" height="200" fill="#0F1013"/><path d="M1 1 L9 9" stroke="#E8A55A"/></svg>';
    const out = paintSvg(own, 'painting', 'x');
    expect(out).toContain('viewBox="0 0 300 200"');
    expect(out).toContain('<g fill="none" stroke-width="3"><path d="M1 1 L9 9" stroke="#E8A55A"/></g>');
    // Only the one background she gets painted on.
    expect(out.match(/fill="#0F1013"/g)).toHaveLength(1);
  });

  it('shows saved art in its style, and "picture" (not available yet) as a sketch', () => {
    const notes = { sketchSvg: sketch, conversationId: 'ep', artStyle: 'painting' };
    expect(artworkSvg(notes)).toBe(paintSvg(sketch, 'painting', 'ep'));
    expect(artworkSvg({ ...notes, artStyle: 'picture' })).toBe(sketch);
    expect(artworkSvg({ ...notes, sketchSvg: null })).toBeNull();
  });

  it("picks a style from how the episode felt", () => {
    expect(defaultPaintStyle({ mode: 'explore', temperature: 'calm' })).toBe('sketch');
    expect(defaultPaintStyle({ mode: 'explore', temperature: 'lively' })).toBe('dreamscape');
    expect(defaultPaintStyle({ mode: 'debate', temperature: 'heated' })).toBe('painting');
    expect(defaultPaintStyle({ mode: 'hotseat', temperature: 'lively' })).toBe('painting');
  });

  it("learns the listener's favourite once they've chosen it twice lately", () => {
    expect(favouriteStyle([])).toBeNull();
    expect(favouriteStyle(['painting'])).toBeNull();
    expect(favouriteStyle(['painting', 'sketch', 'painting'])).toBe('painting');
    expect(favouriteStyle(['sketch', 'sketch', 'dreamscape', 'dreamscape', 'dreamscape'])).toBe('dreamscape');
  });
});

async function finished(s = setup(), d = draft()) {
  const c = s.controller.create(d);
  await s.controller.start(c.id);
  await s.controller.settled(c.id);
  return c.id;
}

const replyWith = (artStyle: unknown): ArtistBackend => ({
  modelId: 'test/iris',
  async draw(_p, c) { return JSON.stringify({ perspective: 'A thoughtful listener note that is long enough.', momentSeq: 3, caption: '', artTitle: 'Test', sketchSvg: sketch, imagePrompt: '', artStyle }); },
});

describe("Iris's style choice", () => {
  it("uses the style a model picks, and falls back to the episode's feel when it picks something unknown", async () => {
    const s = setup();
    const opts = { canRequest: () => true, countRequest: () => {}, onChange: () => {} };
    const a = await finished(s);
    await new Iris(s.repo, replyWith('painting'), opts).listen(a);
    expect(s.repo.getArtist(a)!.artStyle).toBe('painting');
    const b = await finished(s);
    await new Iris(s.repo, replyWith('oil on canvas'), opts).listen(b);
    expect(s.repo.getArtist(b)!.artStyle).toBe('dreamscape');
  });

  it("tells a real model the listener's taste, and asks for a style", () => {
    const view = { topic: 't', mode: 'explore', speakers: { A: { name: 'A' }, B: { name: 'B' } }, turns: [], interventions: [] } as unknown as ConversationView;
    expect(buildIrisPrompt(view, []).system).toContain('"artStyle"');
    expect(buildIrisPrompt(view, []).system).not.toContain('has been choosing');
    expect(buildIrisPrompt(view, [], 'painting').system).toContain('The listener has been choosing "painting"');
  });
});

describe('restyling through the app', () => {
  it('saves the listener\'s pick, refuses bad styles, and Iris leans their way next time', async () => {
    const { app, controller, iris, repo } = buildApp(mockConfig({ dbPath: ':memory:', dailyLimit: 200 }), { timing: { thinkMs: () => 0, wordMs: () => 0 } });
    const episode = async () => {
      const id = (await app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id;
      await app.inject({ method: 'POST', url: `/api/conversations/${id}/start` });
      await controller.settled(id);
      await new Promise(r => setTimeout(r, 5));
      await iris.settled(id);
      return id as string;
    };
    const style = (id: string, s: unknown) => app.inject({ method: 'PUT', url: `/api/conversations/${id}/artist/style`, payload: { style: s } });
    try {
      const draftOnly = (await app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id;
      expect((await style(draftOnly, 'painting')).statusCode).toBe(409);
      expect((await style('nope', 'painting')).statusCode).toBe(404);

      const a = await episode();
      expect(repo.getArtist(a)!.artStyle).toBe('dreamscape');
      expect((await style(a, 'picture')).statusCode).toBe(400);
      expect((await style(a, '<script>')).statusCode).toBe(400);
      const ok = await style(a, 'painting');
      expect(ok.statusCode).toBe(200);
      expect(ok.json().artist.artStyle).toBe('painting');

      // One pick isn't a taste yet; two is.
      const b = await episode();
      expect(repo.getArtist(b)!.artStyle).toBe('dreamscape');
      await style(b, 'painting');
      const c = await episode();
      expect(repo.getArtist(c)!.artStyle).toBe('painting');
      expect(repo.getArtist(c)!.perspective).toContain('You keep choosing paintings');

      // Asking her again is her own pick, so it no longer counts as the listener's choice.
      await app.inject({ method: 'POST', url: `/api/conversations/${a}/artist` });
      await iris.settled(a);
      expect(repo.listenerStyles()).toEqual(['painting']);
    } finally { await app.close(); }
  });
});

describe('every new version of a drawing looks new; a saved one never changes', () => {
  it('fresh brushwork per version, and version 1 keeps its old look', async () => {
    const { artSeed } = await import('@crosstalk/shared');
    expect(artSeed('ep')).toBe('ep');
    expect(artSeed('ep', 1)).toBe('ep');
    expect(artSeed('ep', 2)).toBe('ep:v2');
    const v1 = artworkSvg({ sketchSvg: sketch, conversationId: 'ep', artStyle: 'dreamscape', version: 1 });
    expect(artworkSvg({ sketchSvg: sketch, conversationId: 'ep', artStyle: 'dreamscape' })).toBe(v1);
    expect(artworkSvg({ sketchSvg: sketch, conversationId: 'ep', artStyle: 'dreamscape', version: 2 })).not.toBe(v1);
  });

  it('mock Iris reframes and recolours her scene for each new version, and it still passes the safety check', async () => {
    const { safeSvg } = await import('../src/artist/svgSafety');
    const versions = [1, 2, 3, 4, 5].map(v => mockSketch('four-day workweek', v).svg);
    expect(new Set(versions).size).toBe(5);
    expect(versions[0]).toBe(sketch);
    for (const v of versions) expect(safeSvg(v).ok).toBe(true);
  });
});
