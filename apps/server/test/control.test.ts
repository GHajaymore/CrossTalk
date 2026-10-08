import { describe, expect, it } from 'vitest';
import { DEFAULT_SCOUT_PREFS, scoutPicks, type Rules } from '@crosstalk/shared';
import { buildApp } from '../src/app';
import { loadConfig, mockConfig } from '../src/config';
import { draft, INSTANT } from './helpers';

const rules = (r: Partial<Rules>): Rules => ({ blocked: [], allowMature: true, allowHeated: true, allowPolitics: false, cueLimit: 3, ...r });
const local = () => buildApp(mockConfig({ dbPath: ':memory:' }), { timing: INSTANT });

async function pausedAt(app: ReturnType<typeof local>, seq: number) {
  const id = (await app.app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id as string;
  const off = app.controller.subscribe(id, e => { if (e.type === 'turn-end' && e.seq === seq) { off(); app.controller.pause(id); } });
  await app.controller.start(id); await app.controller.settled(id);
  return id;
}

describe('Control room: rules on the server', () => {
  it('a blocked topic can never go live, even if it was made before the rule', async () => {
    const t = local();
    try {
      const made = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id;
      await t.app.inject({ method: 'PUT', url: '/api/admin/rules', payload: rules({ blocked: ['Workweek'] }) });
      const start = await t.app.inject({ method: 'POST', url: `/api/conversations/${made}/start` });
      expect(start.statusCode).toBe(409);
      expect(start.json().error).toMatch(/"Workweek" is on the Control room's blocked list/);
      expect((await t.app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).statusCode).toBe(400);
      expect((await t.app.inject({ method: 'POST', url: '/api/conversations', payload: draft('Should cities ban cars?') })).statusCode).toBe(201);
    } finally { await t.app.close(); }
  });

  it('switches for Mature, Heated and the cue limit are enforced', async () => {
    const t = local();
    try {
      await t.app.inject({ method: 'PUT', url: '/api/admin/rules', payload: rules({ allowMature: false, allowHeated: false, cueLimit: 1 }) });
      expect((await t.app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft(), audience: 'mature' } })).json().error).toMatch(/Mature audience is switched off/);
      expect((await t.app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft(), temperature: 'heated' } })).json().error).toMatch(/Heated is switched off/);
      const id = await pausedAt(t, 2);
      expect(() => t.controller.addCue(id, { kind: 'temp', direction: 'up' })).toThrow(/Heated is switched off/);
      t.controller.addCue(id, { kind: 'challenge', text: 'one' });
      expect(() => t.controller.addCue(id, { kind: 'challenge', text: 'two' })).toThrow(/all 1 cues/);
      await t.app.inject({ method: 'PUT', url: '/api/admin/rules', payload: rules({ cueLimit: 0 }) });
      const fresh = await pausedAt(t, 1);
      expect(() => t.controller.addCue(fresh, { kind: 'challenge', text: 'x' })).toThrow(/switched off/);
    } finally { await t.app.close(); }
  });

  it('the Scout drops stories with blocked words, and hidden or disallowed topics never reach a tray', async () => {
    const t = local();
    try {
      await t.app.inject({ method: 'PUT', url: '/api/admin/rules', payload: rules({ blocked: ['tipping'] }) });
      await t.scout.run();
      const tray = t.scout.tray();
      expect(tray.some(x => /tipping/i.test(x.question))).toBe(false);
      const [first, second] = scoutPicks(tray, DEFAULT_SCOUT_PREFS);
      await t.app.inject({ method: 'POST', url: `/api/admin/topics/${first.id}`, payload: { hidden: true } });
      await t.app.inject({ method: 'POST', url: `/api/admin/topics/${tray.at(-1)!.id}`, payload: { pinned: true } });
      const picks = scoutPicks(t.scout.tray(), DEFAULT_SCOUT_PREFS);
      expect(picks.map(p => p.id)).not.toContain(first.id);
      expect(picks[0].id).toBe(tray.at(-1)!.id);
      expect(picks).toContainEqual(expect.objectContaining({ id: second.id }));
      expect((await t.app.inject({ method: 'POST', url: '/api/conversations', payload: { ...draft(first.question), scoutTopicId: first.id } })).json().error).toMatch(/hidden/);
    } finally { await t.app.close(); }
  });
});

describe('Control room: producer notes and publishing', () => {
  it("producer notes land before the next turn and don't use the listener's cues", async () => {
    const t = local();
    try {
      await t.app.inject({ method: 'PUT', url: '/api/admin/rules', payload: rules({ cueLimit: 1 }) });
      const id = await pausedAt(t, 2);
      const noted = await t.app.inject({ method: 'POST', url: `/api/admin/conversations/${id}/note`, payload: { text: 'Keep it to the facts we have.' } });
      expect(noted.json().interventions).toEqual([expect.objectContaining({ kind: 'note', appliesBeforeSeq: 3, status: 'queued' })]);
      expect((await t.app.inject({ method: 'POST', url: `/api/admin/conversations/${id}/note`, payload: { text: 'again' } })).statusCode).toBe(409);
      // The listener still has their one cue.
      expect(t.controller.addCue(id, { kind: 'challenge', text: 'What about nurses?' }).appliesBeforeSeq).toBe(3);
      await t.controller.start(id); await t.controller.settled(id);
      const v = t.repo.view(id)!;
      expect(v.interventions.map(c => `${c.kind}:${c.status}`)).toEqual(['note:applied', 'challenge:applied']);
      expect(v.turns.find(x => x.seq === 3)!.text).toMatch(/^Let me keep this to what we actually know\./);
    } finally { await t.app.close(); }
  });

  it('every finished episode waits for your OK, and a held one never enters the publish queue', async () => {
    const t = local();
    try {
      const make = async () => { const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id; await t.controller.start(id); await t.controller.settled(id); return id as string; };
      const a = await make(), b = await make();
      expect(t.repo.getConversation(a)!.publish).toBe('waiting');
      await t.app.inject({ method: 'POST', url: `/api/admin/conversations/${a}/publish`, payload: { state: 'approved' } });
      await t.app.inject({ method: 'POST', url: `/api/admin/conversations/${b}/publish`, payload: { state: 'held' } });
      const queue = (await t.app.inject({ url: '/api/admin/publish-queue' })).json();
      expect(queue.map((q: { id: string }) => q.id)).toEqual([a]);
      const unfinished = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id;
      expect((await t.app.inject({ method: 'POST', url: `/api/admin/conversations/${unfinished}/publish`, payload: { state: 'approved' } })).statusCode).toBe(409);

      const o = (await t.app.inject({ url: '/api/admin/overview' })).json();
      expect(o).toMatchObject({ episodes: 3, waiting: 0, irisArtworks: 2 });
      expect(o.audit.map((x: { action: string }) => x.action)).toEqual(['held', 'approved']);
    } finally { await t.app.close(); }
  });
});

describe('Control room: the admin lock', () => {
  it('is open on your own computer', async () => {
    const t = local();
    try { expect((await t.app.inject({ url: '/api/admin/access' })).json()).toEqual({ required: false, ok: true, configured: true }); }
    finally { await t.app.close(); }
  });

  it('online: shut without a code, and opens with ADMIN_CODE (mock mode stays open to visitors)', async () => {
    const noCode = buildApp({ ...loadConfig({ HOST: '0.0.0.0' }), dbPath: ':memory:', webDir: '' }, { timing: INSTANT });
    try {
      expect((await noCode.app.inject({ url: '/api/conversations' })).statusCode).toBe(200);
      const r = await noCode.app.inject({ url: '/api/admin/rules' });
      expect(r.statusCode).toBe(403);
      expect(r.json().adminLocked).toBe(true);
      expect((await noCode.app.inject({ method: 'POST', url: '/api/admin/access', payload: { code: 'anything-at-all' } })).json().error).toMatch(/no admin code yet/);
    } finally { await noCode.app.close(); }

    const withCode = buildApp({ ...loadConfig({ HOST: '0.0.0.0', ADMIN_CODE: 'lantern-harbour-9' }), dbPath: ':memory:', webDir: '' }, { timing: INSTANT });
    try {
      expect((await withCode.app.inject({ url: '/api/admin/access' })).json()).toEqual({ required: true, ok: false, configured: true });
      expect((await withCode.app.inject({ method: 'POST', url: '/api/admin/access', payload: { code: 'wrong-code-1' } })).statusCode).toBe(401);
      const ok = await withCode.app.inject({ method: 'POST', url: '/api/admin/access', payload: { code: 'lantern-harbour-9' } });
      const cookie = String(ok.headers['set-cookie']).split(';')[0];
      expect(cookie).not.toContain('lantern');
      expect((await withCode.app.inject({ url: '/api/admin/rules', headers: { cookie } })).statusCode).toBe(200);
      expect((await withCode.app.inject({ url: '/api/config', headers: { cookie } })).json().admin).toEqual({ required: true, ok: true, configured: true });
    } finally { await withCode.app.close(); }
  });
});

describe('Control room: review fixes', () => {
  it('an encoded path can never get past either lock', async () => {
    const t = buildApp({ ...loadConfig({ HOST: '0.0.0.0', ADMIN_CODE: 'lantern-harbour-9' }), dbPath: ':memory:', webDir: '' }, { timing: INSTANT });
    try {
      for (const url of ['/api/admin/rules', '/api/%61dmin/rules', '/%61pi/admin/rules', '/api/admin%2Frules', '/api/ADMIN/rules']) {
        const r = await t.app.inject({ url });
        expect([403, 404], url).toContain(r.statusCode);
      }
      expect((await t.app.inject({ method: 'PUT', url: '/api/%61dmin/rules', payload: rules({ blocked: ['x'] }) })).statusCode).toBe(403);
    } finally { await t.app.close(); }

    const real = buildApp({ ...loadConfig({ PROVIDER_MODE: 'openrouter', HOST: '0.0.0.0', ACCESS_CODE: 'harbour-lantern-42', OPENROUTER_API_KEY: 'k', SPEAKER_A_MODEL: 'a:free', SPEAKER_B_MODEL: 'b:free' }), dbPath: ':memory:', webDir: '' }, { timing: INSTANT });
    try {
      for (const url of ['/api/conversations', '/%61pi/conversations', '/api/%63onversations']) expect((await real.app.inject({ url })).statusCode, url).toBe(401);
    } finally { await real.app.close(); }
  });

  it("a listener can't take back a producer note", async () => {
    const t = local();
    try {
      const id = await pausedAt(t, 2);
      const note = t.controller.addNote(id, 'Stay on the facts.');
      const r = await t.app.inject({ method: 'DELETE', url: `/api/conversations/${id}/cues/${note.id}` });
      expect(r.statusCode).toBe(403);
      expect(t.repo.listCues(id)[0].status).toBe('queued');
    } finally { await t.app.close(); }
  });

  it('a too-short ADMIN_CODE fails loudly; topic changes are logged exactly', async () => {
    expect(() => loadConfig({ HOST: '0.0.0.0', ADMIN_CODE: 'admin12' })).toThrow(/ADMIN_CODE must be at least 8/);
    const t = local();
    try {
      await t.scout.run();
      const topic = t.scout.tray()[0];
      expect((await t.app.inject({ method: 'POST', url: `/api/admin/topics/${topic.id}`, payload: {} })).statusCode).toBe(400);
      await t.app.inject({ method: 'POST', url: `/api/admin/topics/${topic.id}`, payload: { pinned: true, hidden: true } });
      expect(t.repo.listAudit()[0]).toMatchObject({ action: 'pinned and hid topic', detail: topic.question });
    } finally { await t.app.close(); }
  });
});
