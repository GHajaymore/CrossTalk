import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { mockConfig } from '../src/config';
import { draft, INSTANT } from './helpers';

describe('transcript export', () => {
  it('JSON (schema v1) includes models, turns, cues, Iris and branch metadata; Markdown reads as a script', async () => {
    const { app, controller, iris } = buildApp(mockConfig({ dbPath: ':memory:', apiKey: 'sk-or-v1-never-exported' }), { timing: INSTANT });
    try {
      const id = (await app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id;
      const off = controller.subscribe(id, e => { if (e.type === 'turn-end' && e.seq === 2) { off(); controller.pause(id); } });
      await controller.start(id); await controller.settled(id);
      controller.addCue(id, { kind: 'challenge', text: 'What about nurses?' });
      await controller.start(id); await controller.settled(id); await iris.settled(id);
      const branch = controller.branch(id, { fromSeq: 4, direction: 'Take the other side' });

      const res = await app.inject({ url: `/api/conversations/${id}/export.json` });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-disposition']).toMatch(/attachment; filename="crosstalk-ep01-is-a-four-day-workweek-practical\.json"/);
      const j = res.json();
      expect(j.schemaVersion).toBe(1);
      expect(j.speakers.map((s: { modelId: string }) => s.modelId)).toEqual(['mock/wren-v1', 'mock/hale-v1']);
      expect(j.turns).toHaveLength(16);
      expect(j.turns[0]).toMatchObject({ seq: 1, modelId: 'mock/wren-v1', job: 'Hello', fromOriginal: false });
      expect(j.interventions).toEqual([expect.objectContaining({ kind: 'challenge', text: 'What about nurses?', appliesBeforeSeq: 3, status: 'applied' })]);
      expect(j.artist).toMatchObject({ momentSeq: 3 });
      expect(j.branches).toEqual([{ id: branch.id, branchSeq: 4, direction: 'Take the other side' }]);
      expect(j.usage.requests).toBe(16);
      expect(res.body).not.toContain('sk-or-v1');

      const child = (await app.inject({ url: `/api/conversations/${branch.id}/export.json` })).json();
      expect(child.branch).toMatchObject({ parentId: id, branchSeq: 4, direction: 'Take the other side' });
      expect(child.turns.filter((t: { fromOriginal: boolean }) => t.fromOriginal)).toHaveLength(4);

      const md = await app.inject({ url: `/api/conversations/${id}/export.md` });
      expect(md.headers['content-type']).toContain('text/markdown');
      expect(md.body).toMatch(/^# Is a four-day workweek practical\?/);
      expect(md.body).toContain("> **Listener's challenge:** What about nurses?\n\n**");
      expect(md.body).toContain('## From the booth: Iris, the Artist');
      expect(md.body).toContain('- From turn 4: Take the other side');
      expect(md.body).toContain('AI-generated; not independently verified.');
      expect((await app.inject({ url: `/api/conversations/${id}/export.pdf` })).statusCode).toBe(404);
    } finally { await app.close(); }
  });
});
