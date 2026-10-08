import { describe, expect, it } from 'vitest';
import { Iris, mockArtist, type ArtistBackend } from '../src/artist/iris';
import { mockSketch } from '../src/artist/mockSketches';
import { buildIrisPrompt } from '../src/artist/prompt';
import { safeSvg } from '../src/artist/svgSafety';
import { buildApp } from '../src/app';
import { mockConfig } from '../src/config';
import { draft, setup } from './helpers';

const svg = (inner: string, attrs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360"${attrs}>${inner}</svg>`;

describe("Iris's sketch safety check", () => {
  it('accepts plain line art in her palette', () => {
    expect(safeSvg(svg('<g fill="none" stroke-width="2.6"><path d="M10 10 L50 50" stroke="#E8A55A"/><circle cx="20" cy="20" r="5" stroke="#5FB8B0"/></g>')).ok).toBe(true);
    for (const t of ['four-day week', 'golf', 'restaurant', 'cities and cars', 'AI for shops', 'anything']) expect(safeSvg(mockSketch(t).svg).ok, t).toBe(true);
  });

  it.each([
    ['a script', svg('<script>alert(1)</script>')],
    ['an event handler', svg('<path d="M0 0" onload="alert(1)"/>')],
    ['a link', svg('<a href="https://example.com"><path d="M0 0"/></a>')],
    ['an embedded image', svg('<image href="x.png"/>')],
    ['foreign HTML', svg('<foreignObject><div>hi</div></foreignObject>')],
    ['text', svg('<path d="M0 0"/>Hello')],
    ['a text element', svg('<text x="1" y="1">Hi</text>')],
    ['a style attribute', svg('<path d="M0 0" style="stroke:red"/>')],
    ['a colour outside the palette', svg('<path d="M0 0" stroke="#ff0000"/>')],
    ['a url() reference', svg('<path d="M0 0" fill="url(#g)"/>')],
    ['an entity', svg('<path d="M0 0"/>&lt;')],
    ['a doctype', '<!DOCTYPE svg>' + svg('<path d="M0 0"/>')],
    ['content outside svg', svg('<path d="M0 0"/>') + '<path d="M0 0"/>'],
    ['unclosed tags', '<svg xmlns="http://www.w3.org/2000/svg"><g><path d="M0 0"/>'],
    ['a javascript: value', svg('<path d="javascript:alert(1)"/>')],
    ['something huge', svg('<path d="M0 0"/>'.repeat(2000))],
  ])('rejects %s', (_label, bad) => {
    expect(safeSvg(bad).ok).toBe(false);
  });
});

async function finishedEpisode() {
  const s = setup();
  const c = s.controller.create(draft());
  await s.controller.start(c.id);
  await s.controller.settled(c.id);
  return { ...s, id: c.id };
}

describe('Iris, the Artist', () => {
  it('listens once after a completed episode and saves a titled, checked sketch', async () => {
    const { repo, controller, id } = await finishedEpisode();
    let requests = 0, changes = 0;
    const iris = new Iris(repo, mockArtist, { canRequest: () => true, countRequest: () => { requests++; }, onChange: () => { changes++; } });
    await iris.listen(id);
    await iris.listen(id); // a second call does nothing: once per completed run
    const a = repo.view(id)!.artist!;
    expect(a).toMatchObject({ state: 'done', modelId: 'mock/iris-v1', artTitle: 'The Empty Friday', artStyle: 'sketch', version: 1, error: null });
    expect(a.sketchSvg).toMatch(/^<svg /);
    expect(a.caption.split(/\s+/).length).toBeLessThanOrEqual(21);
    expect(repo.listTurns(id).find(t => t.seq === a.momentSeq)).toBeTruthy();
    expect(requests).toBe(1);
    expect(changes).toBe(2); // listening, then done
    expect(repo.view(id)!.run?.state).toBe(controller ? 'completed' : '');
  });

  it('never listens to an episode that is not complete', async () => {
    const { repo, controller } = setup();
    const c = controller.create(draft());
    const iris = new Iris(repo, mockArtist, { canRequest: () => true, countRequest: () => {}, onChange: () => {} });
    await iris.listen(c.id);
    expect(repo.getArtist(c.id)).toBeNull();
  });

  it('a failure leaves the discussion untouched and offers Try again', async () => {
    const { repo, id } = await finishedEpisode();
    const before = JSON.stringify(repo.listTurns(id));
    const broken: ArtistBackend = { modelId: 'm/iris', draw: async () => { throw new Error('model unavailable'); } };
    await new Iris(repo, broken, { canRequest: () => true, countRequest: () => {}, onChange: () => {} }).listen(id);
    expect(repo.getArtist(id)).toMatchObject({ state: 'failed', error: expect.stringMatching(/model unavailable/) });
    expect(JSON.stringify(repo.listTurns(id))).toBe(before);
    expect(repo.view(id)!.run?.state).toBe('completed');
  });

  it('shows her perspective alone when her drawing fails the safety check', async () => {
    const { repo, id } = await finishedEpisode();
    const sneaky: ArtistBackend = { modelId: 'm/iris', draw: async () => JSON.stringify({ perspective: 'What stayed with me was the honesty in the middle of it.', momentSeq: 5, caption: 'not in the turn at all', artTitle: '"Night Shift"', sketchSvg: svg('<script>x</script>'), imagePrompt: 'p' }) };
    await new Iris(repo, sneaky, { canRequest: () => true, countRequest: () => {}, onChange: () => {} }).listen(id);
    const a = repo.getArtist(id)!;
    expect(a).toMatchObject({ state: 'done', sketchSvg: null, artTitle: 'Night Shift', momentSeq: 5 });
    expect(a.error).toMatch(/safety check/);
    // The made-up caption is replaced by a real quote from turn 5.
    expect(repo.listTurns(id).find(t => t.seq === 5)!.text.startsWith(a.caption.replace(/…$/, ''))).toBe(true);
  });

  it('respects the daily limit without making a request', async () => {
    const { repo, id } = await finishedEpisode();
    let requests = 0;
    await new Iris(repo, mockArtist, { canRequest: () => false, countRequest: () => { requests++; }, onChange: () => {} }).listen(id);
    expect(repo.getArtist(id)).toMatchObject({ state: 'failed', error: expect.stringMatching(/Daily request limit/) });
    expect(requests).toBe(0);
  });

  it('learns: the listener\'s notes go into her next request', async () => {
    const { repo, id } = await finishedEpisode();
    repo.addFeedback({ id: 'f1', conversationId: id, rating: 'down', note: 'Draw people, not objects', artTitle: 'The Empty Friday', createdAt: new Date().toISOString() });
    repo.addFeedback({ id: 'f2', conversationId: id, rating: 'up', note: 'Loved the warm colours', artTitle: null, createdAt: new Date().toISOString() });
    const { user } = buildIrisPrompt(repo.view(id)!, repo.listFeedback());
    expect(user).toContain('<listener_notes>');
    expect(user).toContain('Wants something different (about "The Empty Friday"): Draw people, not objects');
    expect(user).toContain('Liked: Loved the warm colours');
    // Mock Iris shows she read the latest note.
    await new Iris(repo, mockArtist, { canRequest: () => true, countRequest: () => {}, onChange: () => {} }).listen(id);
    expect(repo.getArtist(id)!.perspective).toMatch(/Loved the warm colours|Draw people, not objects/);
  });
});

describe('Iris through the app', () => {
  it('draws automatically when an episode completes, and Ask Iris again makes version 2', async () => {
    const { app, controller, iris } = buildApp(mockConfig({ dbPath: ':memory:' }), { timing: { thinkMs: () => 0, wordMs: () => 0 } });
    try {
      const id = (await app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id;
      await app.inject({ method: 'POST', url: `/api/conversations/${id}/start` });
      await controller.settled(id);
      await new Promise(r => setTimeout(r, 5));
      await iris.settled(id);
      expect((await app.inject({ url: `/api/conversations/${id}` })).json().artist).toMatchObject({ state: 'done', version: 1 });

      await app.inject({ method: 'POST', url: `/api/conversations/${id}/artist` });
      await iris.settled(id);
      expect((await app.inject({ url: `/api/conversations/${id}` })).json().artist.version).toBe(2);

      const fb = await app.inject({ method: 'POST', url: '/api/iris/feedback', payload: { conversationId: id, rating: 'down', note: 'More people, fewer objects' } });
      expect(fb.statusCode).toBe(201);
      expect(fb.json()[0]).toMatchObject({ rating: 'down', note: 'More people, fewer objects', artTitle: 'The Empty Friday' });
    } finally { await app.close(); }
  });
});
