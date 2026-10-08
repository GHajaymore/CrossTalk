import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { mockConfig } from '../src/config';
import { exportHtml } from '../src/episodePage';
import { exportJson, exportMarkdown } from '../src/export';
import { draft, INSTANT } from './helpers';

const app = () => buildApp(mockConfig({ dbPath: ':memory:' }), { timing: INSTANT });
const put = (t: ReturnType<typeof app>, id: string, body: unknown) => t.app.inject({ method: 'PUT', url: `/api/conversations/${id}/you`, payload: body as object });

describe('where do you stand', () => {
  it('asks before you listen, and where you landed once the episode is finished', async () => {
    const t = app();
    try {
      const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id as string;
      expect((await put(t, id, { end: 60 })).statusCode).toBe(409);
      const before = await put(t, id, { start: 40 });
      expect(before.statusCode).toBe(200);
      expect(before.json()).toMatchObject({ youStart: 40, youEnd: null });
      // Not finished yet: "after" has to wait.
      expect((await put(t, id, { end: 60 })).json().error).toMatch(/once the episode has finished/);

      await t.controller.start(id); await t.controller.settled(id);
      const after = await put(t, id, { end: 55 });
      expect(after.json()).toMatchObject({ youStart: 40, youEnd: 55 });
      // It's saved with the episode.
      expect((await t.app.inject({ url: `/api/conversations/${id}` })).json()).toMatchObject({ youStart: 40, youEnd: 55 });
      // Clearing "before" clears nothing else by accident, but "after" can't outlive it.
      expect((await put(t, id, { start: null })).statusCode).toBe(409);
      expect((await put(t, id, { start: null, end: null })).json()).toMatchObject({ youStart: null, youEnd: null });
    } finally { await t.app.close(); }
  });

  it('takes only whole numbers from 0 to 100', async () => {
    const t = app();
    try {
      const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id as string;
      for (const bad of [-1, 101, 40.5, '50', true, {}]) expect((await put(t, id, { start: bad })).statusCode, String(bad)).toBe(400);
      expect((await put(t, 'nope', { start: 50 })).statusCode).toBe(404);
      expect((await put(t, id, { start: 0 })).json().youStart).toBe(0);
      expect((await put(t, id, { start: 100 })).json().youStart).toBe(100);
    } finally { await t.app.close(); }
  });

  it('a branch keeps where you stood before and asks again where you landed', async () => {
    const t = app();
    try {
      const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id as string;
      await put(t, id, { start: 30 });
      await t.controller.start(id); await t.controller.settled(id);
      await put(t, id, { end: 70 });
      const branch = await t.app.inject({ method: 'POST', url: `/api/conversations/${id}/branch`, payload: { fromSeq: 4, direction: 'What if it were a nine-day fortnight?' } });
      expect(branch.json()).toMatchObject({ youStart: 30, youEnd: null });
    } finally { await t.app.close(); }
  });

  it('shows up in the JSON, the Markdown script and the episode page', async () => {
    const t = app();
    try {
      const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: draft() })).json().id as string;
      await put(t, id, { start: 40 });
      await t.controller.start(id); await t.controller.settled(id);
      await put(t, id, { end: 65 });
      const v = t.repo.view(id)!;
      expect(exportJson(v, []).conversation.listenerStance).toEqual({ start: 40, end: 65 });
      expect(exportMarkdown(v)).toContain('- You: 40% on yes → 65%');
      const html = exportHtml(v);
      expect(html).toContain('<b>You</b>');
      expect(html).toContain('You: 40% on yes at the start, 65% at the end');
      expect(html).toContain('moved 25 toward yes');
    } finally { await t.app.close(); }
  });
});
