import { expect, test } from '@playwright/test';
import { fastMock, finishedEpisode } from './helpers';

test.beforeEach(async ({ request }) => { await fastMock(request); });

test('create → run → stop → refresh keeps every finished turn', async ({ page }) => {
  await page.goto('/#/create');
  await page.getByRole('button', { name: /Start recording/ }).click();
  await expect(page).toHaveURL(/#\/studio\//);
  await expect.poll(() => page.locator('.pip.done').count()).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('.status-line')).toContainText(/Stopped after turn \d+/);
  const stopped = Number((await page.locator('.status-line b').innerText()).match(/turn (\d+)/)![1]);
  expect(stopped).toBeLessThan(16);

  await page.reload();
  await expect(page.locator('.status-line')).toContainText(`Stopped after turn ${stopped}`);
  await expect(page.locator('.pip.done')).toHaveCount(stopped);
  await page.getByRole('link', { name: /Read/ }).first().click();
  await expect(page.locator('.turn')).toHaveCount(stopped);
});

test('a challenge lands on the next turn as a cue card', async ({ page, request }) => {
  await page.goto('/#/create');
  await page.getByRole('button', { name: /Start recording/ }).click();
  await expect.poll(() => page.locator('.pip.done').count()).toBeGreaterThanOrEqual(1);
  await page.getByRole('button', { name: 'Pause after this turn' }).click();
  await expect(page.locator('.status-line')).toContainText('Paused after turn');
  const paused = Number((await page.locator('.status-line b').innerText()).match(/turn (\d+)/)![1]);

  await page.getByPlaceholder("e.g. Doesn't this only work for office jobs?").fill('What about nurses on night shifts?');
  await page.getByRole('button', { name: 'Queue challenge' }).click();
  await expect(page.locator('.cue-status')).toContainText(`lands before turn ${paused + 1}`);
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.locator('.status-line')).toContainText('Complete', { timeout: 60_000 });

  const id = page.url().split('/studio/')[1].split('/')[0];
  const v = await (await request.get(`/api/conversations/${id}`)).json();
  expect(v.interventions[0]).toMatchObject({ kind: 'challenge', status: 'applied', appliesBeforeSeq: paused + 1 });
  expect(v.turns.find((t: { seq: number }) => t.seq === paused + 1).text).toContain('What about nurses on night shifts?');
  await page.getByRole('link', { name: /Read/ }).first().click();
  await expect(page.locator('.cue.challenge')).toContainText('landed before turn');
});

test('branch from turn 4 leaves the original untouched', async ({ page, request }) => {
  const id = await finishedEpisode(request);
  await page.goto(`/#/studio/${id}/read`);
  await page.getByRole('button', { name: 'Actions for turn 4' }).click();
  await page.getByRole('menuitem', { name: /Branch from here/ }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('What if it were a nine-day fortnight?');
  await page.getByRole('button', { name: 'Create branch' }).click();
  await expect(page.locator('.branch-banner')).toContainText('Branch from turn 4');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('.status-line')).toContainText('Complete', { timeout: 60_000 });
  await expect(page.locator('.pip')).toHaveCount(8);

  await page.getByRole('link', { name: /Back to the original/ }).click();
  await expect(page.locator('.splice')).toContainText('nine-day fortnight');
  const parent = await (await request.get(`/api/conversations/${id}`)).json();
  expect(parent.turns).toHaveLength(16);
  expect(parent.branches).toHaveLength(1);
});

test("Iris's card shows her sketch, perspective, and learns from feedback", async ({ page, request }) => {
  const id = await finishedEpisode(request);
  await page.goto(`/#/studio/${id}/read`);
  const card = page.getByRole('region', { name: "Iris's perspective" });
  // She picks a style (her own, or the taste she has learned); the card shows it, and the listener can switch it.
  const picked = (await (await request.get(`/api/conversations/${id}`)).json()).artist.artStyle as string;
  const name = picked[0].toUpperCase() + picked.slice(1);
  await expect(card.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByRole('img', { name: new RegExp(`Iris's ${picked}`) })).toBeVisible();
  await card.getByRole('button', { name: 'Painting', exact: true }).click();
  await expect(card.getByRole('img', { name: /Iris's painting/ })).toBeVisible();
  await expect(card.getByRole('button', { name: /Watch her paint/ })).toBeVisible();
  expect((await (await request.get(`/api/conversations/${id}`)).json()).artist.artStyle).toBe('painting');
  await card.getByRole('button', { name: 'Sketch', exact: true }).click();
  await expect(card.getByRole('img', { name: /Iris's sketch/ })).toBeVisible();
  await card.getByRole('button', { name: /Watch her draw/ }).click();
  await expect(card.getByRole('button', { name: /Drawing/ })).toBeDisabled();
  await expect(card.locator('.persp')).not.toBeEmpty();
  await card.getByRole('button', { name: /Got it right/ }).click();
  await card.getByRole('textbox').fill('Love the warm colours');
  await card.getByRole('button', { name: 'Tell Iris' }).click();
  await expect(card).toContainText('Thanks.');
  await page.goto('/#/iris');
  await expect(page.locator('.learned')).toContainText('Love the warm colours');
});

test('export downloads Markdown and JSON with models, turns and cues', async ({ page, request }, info) => {
  const id = await finishedEpisode(request);
  await page.goto(`/#/studio/${id}/read`);
  await page.locator('.export-menu summary').click();
  const [md] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /Markdown script/ }).click()]);
  expect(md.suggestedFilename()).toMatch(/^crosstalk-ep\d+-is-a-four-day-workweek-practical\.md$/);
  const json = await (await request.get(`/api/conversations/${id}/export.json`)).json();
  expect(json).toMatchObject({ schemaVersion: 1 });
  expect(json.speakers.map((s: { modelId: string }) => s.modelId)).toEqual(['mock/wren-v1', 'mock/hale-v1']);
  expect(json.turns).toHaveLength(16);

  // The episode page: one offline file that opens on its own and plays nothing from the network.
  if (!(await page.locator('.export-menu').evaluate(d => (d as HTMLDetailsElement).open))) await page.locator('.export-menu summary').click();
  const [html] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /Episode page/ }).click()]);
  expect(html.suggestedFilename()).toMatch(/^crosstalk-ep\d+-is-a-four-day-workweek-practical\.html$/);
  const outside: string[] = [];
  page.on('request', r => { if (!/^(file|data):/.test(r.url())) outside.push(r.url()); });
  const file = info.outputPath(html.suggestedFilename());
  await html.saveAs(file);
  await page.goto('file://' + file);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Is a four-day workweek practical?');
  await expect(page.locator('article.turn')).toHaveCount(16);
  await expect(page.getByRole('img', { name: /Iris's/ })).toBeVisible();
  expect(outside).toEqual([]);
});

test('episodes: rename, then delete with confirmation', async ({ page, request }) => {
  const id = await finishedEpisode(request, 'Should cities ban cars from downtown?');
  await page.goto('/#/episodes');
  const row = page.locator('.lib-item', { has: page.locator(`a[href="#/studio/${id}/read"]`) }).first();
  await row.getByRole('button', { name: 'Rename' }).click();
  await page.locator(`#t-${id}`).fill('Car-free downtowns');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('link', { name: 'Car-free downtowns' })).toBeVisible();
  const renamed = page.locator('.lib-item', { hasText: 'Car-free downtowns' });
  await renamed.getByRole('button', { name: 'Delete' }).click();
  await expect(renamed.getByRole('alertdialog')).toContainText("can't be undone");
  await renamed.getByRole('button', { name: 'Delete for good' }).click();
  await expect(page.getByRole('link', { name: 'Car-free downtowns' })).toHaveCount(0);
  expect((await request.get(`/api/conversations/${id}`)).status()).toBe(404);
});

test('keyboard only: the turn menu and the branch dialog', async ({ page, request }) => {
  const id = await finishedEpisode(request);
  await page.goto(`/#/studio/${id}/read`);
  const menuButton = page.getByRole('button', { name: 'Actions for turn 2' });
  await menuButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);

  await page.keyboard.press('Enter');
  await page.getByRole('menuitem', { name: /Branch from here/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog').getByRole('textbox')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(menuButton).toBeFocused();
});

test('Scout: run it, pick a topic, and the brief follows the episode', async ({ page, request }) => {
  await page.goto('/#/create');
  await page.getByRole('button', { name: 'Run Scout now' }).click();
  const card = page.locator('.topic-card').first();
  await expect(card).toBeVisible();
  const question = await card.locator('h3').innerText();
  await card.getByRole('button', { name: 'Discuss this' }).click();
  await expect(page.locator('#topic')).toHaveValue(question);
  await page.getByRole('button', { name: /Start recording/ }).click();
  await expect(page.locator('.status-line')).toContainText('Complete', { timeout: 60_000 });
  await expect(page.locator('.stage-brief summary')).toContainText("Today's brief");
  await expect(page.locator('.notice')).toContainText('Brief from the linked sources');
  const id = page.url().split('/studio/')[1].split('/')[0];
  const json = await (await request.get(`/api/conversations/${id}/export.json`)).json();
  expect(json.sources.length).toBeGreaterThan(0);
});

test('Control room: block a word, run an episode with a producer note, then approve it', async ({ page, request }) => {
  await page.goto('/#/control/rules');
  await page.getByLabel('Blocked words and topics (one per line)').fill('crypto');
  await page.getByRole('button', { name: 'Save rules' }).click();
  await expect(page.getByText('Rules saved')).toBeVisible();

  await page.goto('/#/create');
  await page.locator('#topic').fill('Is crypto the future of money?');
  await expect(page.getByRole('alert')).toContainText('blocked list');
  await expect(page.getByRole('button', { name: /Start recording/ })).toBeDisabled();

  await page.locator('#topic').fill('Should cities ban cars from downtown?');
  await page.getByRole('button', { name: /Start recording/ }).click();
  await expect.poll(() => page.locator('.pip.done').count()).toBeGreaterThanOrEqual(1);
  await page.getByRole('button', { name: 'Pause after this turn' }).click();
  await expect(page.locator('.status-line')).toContainText('Paused after turn');
  const id = page.url().split('/studio/')[1].split('/')[0];

  await page.goto('/#/control/live');
  await page.getByLabel('Producer note').fill('Keep it to the facts we have.');
  await page.getByRole('button', { name: 'Send note' }).click();
  await expect(page.getByText('Producer note queued')).toBeVisible();

  await page.goto(`/#/studio/${id}/read`);
  await expect(page.locator('.cue.note')).toContainText('Keep it to the facts we have.');
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.locator('.status-line')).toContainText('Complete', { timeout: 60_000 });

  await page.goto('/#/control/publish');
  const row = page.locator('.lib-item', { has: page.locator(`a[href="#/studio/${id}/read"]`) });
  await row.getByRole('button', { name: 'Approve' }).click();
  await expect(row.locator('.status')).toHaveText('approved');
  const queue = await (await request.get('/api/admin/publish-queue')).json();
  expect(queue.map((q: { id: string }) => q.id)).toContain(id);
  await request.put('/api/admin/rules', { data: { blocked: [], allowMature: true, allowHeated: true, allowPolitics: false, cueLimit: 3 } });
});

test('Hot seat: vote who moved you, then make the episode poster', async ({ page }) => {
  await page.goto('/#/create');
  await page.locator('#topic').fill('Should homework be banned in primary schools?');
  await page.getByRole('button', { name: 'Hot seat' }).click();
  await page.getByRole('button', { name: /Start recording/ }).click();
  await expect(page.locator('.status-line')).toContainText('Complete', { timeout: 60_000 });
  await page.getByRole('link', { name: /Read/ }).first().click();
  await page.getByRole('button', { name: 'The challenger won me over' }).click();
  await expect(page.getByRole('button', { name: 'The challenger won me over' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Make poster' }).click({ timeout: 60_000 });
  await expect(page.getByRole('img', { name: /Poster for/ })).toBeVisible();
  const poster = page.locator('.poster-tile', { hasText: 'Episode poster' });
  const [dl] = await Promise.all([page.waitForEvent('download'), poster.getByRole('link', { name: 'Download' }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^crosstalk-ep\d+-poster\.png$/);

  // The comic strip, from the same Episode kit.
  await page.getByRole('button', { name: 'Make comic' }).click();
  await expect(page.getByRole('img', { name: /Comic strip of/ })).toBeVisible();
  const comic = page.locator('.poster-tile', { hasText: 'Comic strip' });
  const [dl2] = await Promise.all([page.waitForEvent('download'), comic.getByRole('link', { name: 'Download' }).click()]);
  expect(dl2.suggestedFilename()).toMatch(/^crosstalk-ep\d+-comic\.png$/);
});

test('Call in by voice: talk, check the words, go on air', async ({ page }) => {
  // No microphone in the test browser: a stand-in recognizer "hears" one sentence.
  await page.addInitScript(() => {
    class FakeRecognition {
      lang = ''; interimResults = false; continuous = false;
      onresult: ((e: unknown) => void) | null = null; onerror: ((e: unknown) => void) | null = null; onend: (() => void) | null = null;
      start() {
        setTimeout(() => this.onresult?.({ resultIndex: 0, results: [{ 0: { transcript: 'I teach at a primary school' }, isFinal: false }] }), 50);
        setTimeout(() => { this.onresult?.({ resultIndex: 0, results: [{ 0: { transcript: 'I teach at a primary school and homework steals family time.' }, isFinal: true }] }); this.onend?.(); }, 150);
      }
      stop() { this.onend?.(); } abort() {}
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognition;
  });
  await page.goto('/#/create');
  await page.getByRole('button', { name: /Start recording/ }).click();
  await expect.poll(() => page.locator('.pip.done').count()).toBeGreaterThanOrEqual(1);
  await page.getByRole('button', { name: 'Pause after this turn' }).click();
  await expect(page.locator('.status-line')).toContainText('Paused after turn');
  await page.getByRole('button', { name: '🎙 Talk' }).click();
  await expect(page.getByLabel('Your words on air')).toHaveValue('I teach at a primary school and homework steals family time.');
  await page.getByRole('button', { name: 'Go on air' }).click();
  await expect(page.locator('.set-tile.G')).toBeVisible();
  await expect(page.locator('.set-cap')).toContainText('homework steals family time');
});
