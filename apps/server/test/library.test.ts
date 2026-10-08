import { mkdirSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app';
import { mockConfig } from '../src/config';
import { draft, INSTANT, QUICK } from './helpers';

describe('episodes library', () => {
  it('renames, counts branches, and deletes with everything that belongs to it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ct-lib-'));
    const { app, controller, repo, iris } = buildApp(mockConfig({ dbPath: join(dir, 'db.sqlite') }), { timing: INSTANT });
    try {
      const id = (await app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id;
      await controller.start(id); await controller.settled(id); await iris.settled(id);

      expect((await app.inject({ method: 'PATCH', url: `/api/conversations/${id}`, payload: { title: '   ' } })).json().error).toBe('Give it a title.');
      const renamed = await app.inject({ method: 'PATCH', url: `/api/conversations/${id}`, payload: { title: '  Four days,\n  for real?  ' } });
      expect(renamed.json().title).toBe('Four days, for real?');
      expect(renamed.json().topic).toBe('Is a four-day workweek practical?');

      const branch = controller.branch(id, { fromSeq: 3, direction: 'Schools' });
      const list = (await app.inject({ url: '/api/conversations' })).json();
      expect(list.find((c: { id: string }) => c.id === id).branchCount).toBe(1);

      const refused = await app.inject({ method: 'DELETE', url: `/api/conversations/${id}` });
      expect(refused.statusCode).toBe(409);
      expect(refused.json().error).toMatch(/1 branch that reads its turns|has 1 branch/);

      mkdirSync(join(dir, 'audio'), { recursive: true });
      writeFileSync(join(dir, 'audio', `${id}.mp3`), 'x');
      writeFileSync(join(dir, 'audio', `${id}.json`), '{}');
      const spent = repo.usageOn(controller.today()).attempts;
      expect(spent).toBeGreaterThan(0);
      expect((await app.inject({ method: 'DELETE', url: `/api/conversations/${branch.id}` })).statusCode).toBe(204);
      expect((await app.inject({ method: 'DELETE', url: `/api/conversations/${id}` })).statusCode).toBe(204);
      expect((await app.inject({ url: `/api/conversations/${id}` })).statusCode).toBe(404);
      for (const table of ['turns', 'generation_runs', 'artist_notes', 'interventions']) {
        expect((repo.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n, table).toBe(0);
      }
      // What was spent stays on record: today's usage doesn't shrink when an episode is deleted.
      expect(repo.usageOn(controller.today()).attempts).toBe(spent);
      expect(existsSync(join(dir, 'audio', `${id}.mp3`))).toBe(false);
      expect((await app.inject({ method: 'DELETE', url: `/api/conversations/${id}` })).statusCode).toBe(404);
    } finally { await app.close(); }
  });

  it('waits for Iris to finish drawing before an episode can be deleted', async () => {
    const { app, controller, iris } = buildApp(mockConfig({ dbPath: ':memory:' }), { timing: INSTANT });
    try {
      const id = (await app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id;
      await controller.start(id); await controller.settled(id); await iris.settled(id);
      // Hold her as busy while the delete arrives (the mock draws too fast to catch otherwise).
      const busy = vi.spyOn(iris, 'isWorking').mockReturnValue(true);
      const res = await app.inject({ method: 'DELETE', url: `/api/conversations/${id}` });
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toMatch(/Iris is still drawing/);
      busy.mockRestore();
      expect((await app.inject({ method: 'DELETE', url: `/api/conversations/${id}` })).statusCode).toBe(204);
    } finally { await app.close(); }
  });

  it('never deletes an episode while it is generating', async () => {
    const { app, controller } = buildApp(mockConfig({ dbPath: ':memory:' }), { timing: QUICK });
    try {
      const id = (await app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id;
      await controller.start(id);
      const res = await app.inject({ method: 'DELETE', url: `/api/conversations/${id}` });
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toBe('Stop the episode before deleting it.');
      controller.stop(id); await controller.settled(id);
    } finally { await app.close(); }
  });
});
