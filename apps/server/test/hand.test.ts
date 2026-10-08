import { HAND_RAISED } from '@crosstalk/shared';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { mockConfig } from '../src/config';
import { draft, INSTANT } from './helpers';

const app = () => buildApp(mockConfig({ dbPath: ':memory:', dailyLimit: 500 }), { timing: INSTANT });

describe('raise your hand', () => {
  it('the host on air finishes their line, then the show pauses for you; you speak and the next host answers you', async () => {
    const t = app();
    try {
      const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id as string;
      // Raise a hand while turn 3 is being written.
      const off = t.controller.subscribe(id, e => { if (e.type === 'turn-start' && e.seq === 3) { off(); t.controller.raiseHand(id); } });
      await t.controller.start(id); await t.controller.settled(id);
      let v = t.repo.view(id)!;
      expect(v.run).toMatchObject({ state: 'paused', stopReason: HAND_RAISED });
      expect(v.turns).toHaveLength(3);
      // You speak; the next host (turn 4) answers you, and the show carries on.
      await t.app.inject({ method: 'POST', url: `/api/conversations/${id}/cues`, payload: { kind: 'guest', text: 'I teach nurses on night shifts.' } });
      await t.app.inject({ method: 'POST', url: `/api/conversations/${id}/start` });
      await t.controller.settled(id);
      v = t.repo.view(id)!;
      expect(v.run?.state).toBe('completed');
      expect(v.turns[3].text).toContain('I teach nurses on night shifts.');
    } finally { await t.app.close(); }
  });

  it('raised while paused, the pause becomes an invitation; Pause on its own is still just a pause', async () => {
    const t = app();
    try {
      const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id as string;
      const off = t.controller.subscribe(id, e => { if (e.type === 'turn-end' && e.seq === 2) { off(); t.controller.pause(id); } });
      await t.controller.start(id); await t.controller.settled(id);
      expect(t.repo.view(id)!.run).toMatchObject({ state: 'paused', stopReason: 'by you' });
      const r = await t.app.inject({ method: 'POST', url: `/api/conversations/${id}/hand` });
      expect(r.statusCode).toBe(200);
      expect(r.json().run).toMatchObject({ state: 'paused', stopReason: HAND_RAISED });
      // Never mind: carry on, and it finishes normally.
      await t.app.inject({ method: 'POST', url: `/api/conversations/${id}/start` });
      await t.controller.settled(id);
      expect(t.repo.view(id)!.run?.state).toBe('completed');
    } finally { await t.app.close(); }
  });

  it('only while recording, with a cue left and a turn still to come', async () => {
    const t = app();
    try {
      const fresh = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id;
      expect((await t.app.inject({ method: 'POST', url: `/api/conversations/${fresh}/hand` })).json().error).toMatch(/while the episode is recording/);
      const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id as string;
      await t.controller.start(id); await t.controller.settled(id);
      expect((await t.app.inject({ method: 'POST', url: `/api/conversations/${id}/hand` })).statusCode).toBe(409);

      await t.app.inject({ method: 'PUT', url: '/api/admin/rules', payload: { blocked: [], allowMature: true, allowHeated: true, allowPolitics: false, cueLimit: 0 } });
      const none = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id as string;
      const off = t.controller.subscribe(none, e => { if (e.type === 'turn-end' && e.seq === 1) { off(); t.controller.pause(none); } });
      await t.controller.start(none); await t.controller.settled(none);
      expect((await t.app.inject({ method: 'POST', url: `/api/conversations/${none}/hand` })).json().error).toMatch(/switched off/);
    } finally { await t.app.close(); }
  });

  it('stopping the episode lowers the hand', async () => {
    const t = app();
    try {
      const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id as string;
      const off = t.controller.subscribe(id, e => { if (e.type === 'turn-start' && e.seq === 2) { off(); t.controller.raiseHand(id); t.controller.stop(id); } });
      await t.controller.start(id); await t.controller.settled(id);
      expect(t.repo.view(id)!.run).toMatchObject({ state: 'cancelled', stopReason: 'by you' });
    } finally { await t.app.close(); }
  });
});
