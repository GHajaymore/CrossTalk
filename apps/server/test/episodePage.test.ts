import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { mockConfig } from '../src/config';
import { exportHtml } from '../src/episodePage';
import { exportMarkdown } from '../src/export';
import { draft, INSTANT } from './helpers';

const sneaky = 'Is <script>alert(1)</script> "fair" & </script><img src=x onerror=alert(2)>?';

/** A finished episode with a producer note, a listener challenge and Iris's art. */
async function episode(topic = 'Is a four-day workweek practical?') {
  const t = buildApp(mockConfig({ dbPath: ':memory:' }), { timing: INSTANT });
  const id = (await t.app.inject({ method: 'POST', url: '/api/conversations', payload: draft(topic) })).json().id as string;
  const off = t.controller.subscribe(id, e => { if (e.type === 'turn-end' && e.seq === 2) { off(); t.controller.pause(id); } });
  await t.controller.start(id); await t.controller.settled(id);
  t.controller.addNote(id, 'PRIVATE producer instruction');
  t.controller.addCue(id, { kind: 'challenge', text: 'What about <b>nurses</b>?' });
  await t.controller.start(id); await t.controller.settled(id);
  await new Promise(r => setTimeout(r, 5));
  await t.iris.settled(id);
  return { ...t, id, view: t.repo.view(id)! };
}

describe('the episode page', () => {
  it('holds the whole episode: topic, hosts, every turn, the listener’s cue, Iris and her art', async () => {
    const { app, view } = await episode();
    try {
      const html = exportHtml(view);
      expect(html.startsWith('<!doctype html>')).toBe(true);
      expect(html).toContain('<h1>Is a four-day workweek practical?</h1>');
      for (const t of view.turns) expect(html).toContain(`id="t${t.seq}"`);
      expect(html).toContain("Listener's challenge</b> What about &lt;b&gt;nurses&lt;/b&gt;?");
      expect(html).toContain('From the booth');
      expect(html).toContain('<img src="data:image/svg+xml;charset=utf-8,');
      expect(html).toContain(`drew this`);
    } finally { await app.close(); }
  });

  it('keeps producer notes out: they are private instructions to the hosts', async () => {
    const { app, view } = await episode();
    try {
      expect(view.interventions.some(x => x.kind === 'note' && x.status === 'applied')).toBe(true);
      expect(exportHtml(view)).not.toContain('PRIVATE producer instruction');
    } finally { await app.close(); }
  });

  it('works offline and can never load or send anything', async () => {
    const { app, view } = await episode();
    try {
      const html = exportHtml(view);
      expect(html).toContain(`content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'"`);
      // No outside files: every src is inline data.
      for (const m of html.matchAll(/\ssrc="([^"]*)"/g)) expect(m[1].startsWith('data:')).toBe(true);
      expect(html).not.toMatch(/<link\b|@import|fetch\(|XMLHttpRequest|sendBeacon|WebSocket/);
    } finally { await app.close(); }
  });

  it('escapes every piece of text, even inside the data the Play button reads', async () => {
    const { app, view } = await episode(sneaky);
    try {
      const html = exportHtml(view);
      // Exactly two script blocks (the data and the player), so nothing in the topic opened one.
      expect(html.match(/<script\b/g)).toHaveLength(2);
      expect(html.match(/<\/script>/g)).toHaveLength(2);
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &quot;fair&quot; &amp;');
      const data = html.match(/<script type="application\/json" id="episode">([\s\S]*?)<\/script>/)![1];
      expect(data).not.toMatch(/[<>]/);
      expect(JSON.parse(data).turns).toHaveLength(view.turns.length);
    } finally { await app.close(); }
  });

  it('downloads from the export route with a readable file name', async () => {
    const { app, id } = await episode();
    try {
      const r = await app.inject({ url: `/api/conversations/${id}/export.html` });
      expect(r.statusCode).toBe(200);
      expect(r.headers['content-type']).toMatch(/^text\/html/);
      expect(r.headers['content-disposition']).toBe('attachment; filename="crosstalk-ep01-is-a-four-day-workweek-practical.html"');
      expect(r.body).toContain('<h1>Is a four-day workweek practical?</h1>');
    } finally { await app.close(); }
  });

  it('the Markdown script also handles an episode with a producer note', async () => {
    const { app, view } = await episode();
    try {
      expect(exportMarkdown(view)).toContain("**Producer's note:** PRIVATE producer instruction");
    } finally { await app.close(); }
  });
});
