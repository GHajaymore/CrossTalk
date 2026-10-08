import { cleanStyles, defaultPaintStyle, type ConversationView } from '@crosstalk/shared';
import { describe, expect, it } from 'vitest';
import { buildIrisPrompt } from '../src/artist/prompt';
import { buildApp } from '../src/app';
import { mockConfig } from '../src/config';
import { draft, INSTANT } from './helpers';

const app = () => buildApp(mockConfig({ dbPath: ':memory:', dailyLimit: 500 }), { timing: INSTANT });

async function episode(t: ReturnType<typeof app>, d = draft()) {
  const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: d })).json().id as string;
  await t.app.inject({ method: 'POST', url: `/api/conversations/${id}/start` });
  await t.controller.settled(id);
  await new Promise(r => setTimeout(r, 5));
  await t.iris.settled(id);
  return id;
}

describe("Iris's gallery keeps every version", () => {
  it('saves each drawing, each "ask again", and each style you choose, once', async () => {
    const t = app();
    try {
      const id = await episode(t);
      const gal = async () => (await t.app.inject({ url: '/api/iris/gallery' })).json();
      expect((await gal())[0]).toMatchObject({ conversationId: id, current: { version: 1, style: 'dreamscape' } });
      expect((await gal())[0].artworks.map((a: { version: number; style: string }) => `${a.version}:${a.style}`)).toEqual(['1:dreamscape']);

      await t.app.inject({ method: 'PUT', url: `/api/conversations/${id}/artist/style`, payload: { style: 'painting' } });
      await t.app.inject({ method: 'PUT', url: `/api/conversations/${id}/artist/style`, payload: { style: 'dreamscape' } });
      await t.app.inject({ method: 'PUT', url: `/api/conversations/${id}/artist/style`, payload: { style: 'painting' } });
      await t.app.inject({ method: 'POST', url: `/api/conversations/${id}/artist` });
      await t.iris.settled(id);

      const g = (await gal())[0];
      expect(g.artworks.map((a: { version: number; style: string }) => `${a.version}:${a.style}`).sort()).toEqual(['1:dreamscape', '1:painting', `2:${g.current.style}`]);
      expect(g.current.version).toBe(2);
      expect(g.artworks[0].svg).toMatch(/^<svg /);
    } finally { await t.app.close(); }
  });

  it('goes when the episode is deleted', async () => {
    const t = app();
    try {
      const id = await episode(t);
      expect(await (await t.app.inject({ url: '/api/iris/gallery' })).json()).toHaveLength(1);
      await t.app.inject({ method: 'DELETE', url: `/api/conversations/${id}` });
      expect(await (await t.app.inject({ url: '/api/iris/gallery' })).json()).toEqual([]);
    } finally { await t.app.close(); }
  });
});

describe('the styles you tick', () => {
  it('starts with all three, and refuses none or unknown styles', async () => {
    const t = app();
    try {
      expect((await t.app.inject({ url: '/api/iris/styles' })).json()).toEqual({ styles: ['sketch', 'painting', 'dreamscape'] });
      for (const bad of [[], ['picture'], ['sketch', 'oil'], 'sketch', null]) {
        expect((await t.app.inject({ method: 'PUT', url: '/api/iris/styles', payload: { styles: bad } })).statusCode, JSON.stringify(bad)).toBe(400);
      }
      expect((await t.app.inject({ method: 'PUT', url: '/api/iris/styles', payload: { styles: ['dreamscape', 'sketch'] } })).json()).toEqual({ styles: ['sketch', 'dreamscape'] });
    } finally { await t.app.close(); }
  });

  it('Iris only uses ticked styles, even over your learned taste', async () => {
    const t = app();
    try {
      await t.app.inject({ method: 'PUT', url: '/api/iris/styles', payload: { styles: ['painting'] } });
      // An Explore episode would be a dreamscape; with only Painting ticked it's a painting.
      const id = await episode(t);
      expect(t.repo.getArtist(id)!.artStyle).toBe('painting');

      // You keep picking Sketch, then untick it: she doesn't use it.
      await t.app.inject({ method: 'PUT', url: '/api/iris/styles', payload: { styles: ['sketch', 'painting', 'dreamscape'] } });
      for (let i = 0; i < 2; i++) await t.app.inject({ method: 'PUT', url: `/api/conversations/${await episode(t)}/artist/style`, payload: { style: 'sketch' } });
      expect(t.repo.getArtist(await episode(t))!.artStyle).toBe('sketch');
      await t.app.inject({ method: 'PUT', url: '/api/iris/styles', payload: { styles: ['painting', 'dreamscape'] } });
      expect(t.repo.getArtist(await episode(t))!.artStyle).toBe('dreamscape');
    } finally { await t.app.close(); }
  });

  it('picks the closest ticked style to the episode’s feel, and tells a real model only the ticked ones', () => {
    expect(defaultPaintStyle({ mode: 'explore', temperature: 'lively' }, ['sketch', 'painting'])).toBe('painting');
    expect(defaultPaintStyle({ mode: 'debate', temperature: 'calm' }, ['dreamscape'])).toBe('dreamscape');
    expect(cleanStyles(['dreamscape', 'x', 'sketch'])).toEqual(['sketch', 'dreamscape']);
    expect(cleanStyles([])).toEqual(['sketch', 'painting', 'dreamscape']);
    const view = { topic: 't', mode: 'explore', round: 1, speakers: { A: { name: 'A' }, B: { name: 'B' } }, turns: [], interventions: [] } as unknown as ConversationView;
    expect(buildIrisPrompt(view, [], null, ['painting']).system).toContain('- artStyle: always "painting"');
    const two = buildIrisPrompt(view, [], null, ['sketch', 'dreamscape']).system;
    expect(two).toContain('"sketch"');
    expect(two).not.toContain('"painting" (');
    expect(two).toContain('Compose it like an illustrator');
  });
});
