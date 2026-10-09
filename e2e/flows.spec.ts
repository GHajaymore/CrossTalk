import { expect, test } from '@playwright/test';
import { fastMock, finishedEpisode } from './helpers';

test.beforeEach(async ({ request }) => { await fastMock(request); });

test('length: a Short episode is 8 turns, chosen by listening time', async ({ page }) => {
  await page.goto('/#/create');
  const len = page.getByRole('group', { name: 'Length' });
  await len.getByRole('button', { name: /Short · ~3 min/ }).click();
  await expect(page.getByText(/8 turns: the opening/)).toBeVisible();
  await page.getByRole('button', { name: /Start recording/ }).click();
  await expect(page.locator('.status-line')).toContainText('Complete', { timeout: 60_000 });
  await expect(page.locator('.pip')).toHaveCount(8);
  // Remembered for next time on this device; put it back for the other tests.
  await page.goto('/#/create');
  await expect(page.getByRole('group', { name: 'Length' }).getByRole('button', { name: /Short/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('group', { name: 'Length' }).getByRole('button', { name: /Normal/ }).click();
});

test('hosts from somewhere: the name bar, the style hint, and their first lines', async ({ page }) => {
  await page.goto('/#/create');
  await page.getByRole('region', { name: 'Speaker A' }).getByLabel('Home').selectOption('KE');
  await page.getByRole('region', { name: 'Speaker B' }).getByLabel('Home').selectOption('IN');
  await expect(page.getByRole('region', { name: 'Speaker A' })).toContainText('Warm and spirited: clearly there at Lively.');
  await page.getByRole('region', { name: 'Speaker A' }).getByLabel('Voice').selectOption('energetic');
  await expect(page.getByRole('region', { name: 'Speaker A' })).toContainText('Quicker and brighter.');
  await expect(page.locator('.set-l3').first()).toContainText('Kenya');
  await expect(page.locator('.set-l3').nth(1)).toContainText('India');
  await page.getByRole('region', { name: 'Speaker B' }).getByLabel('Home').selectOption('');
  await expect(page.locator('.set-l3').nth(1)).not.toContainText('India');
  await page.getByRole('region', { name: 'Speaker B' }).getByLabel('Home').selectOption('IN');
  await page.getByRole('button', { name: /Start recording/ }).click();
  await expect(page.locator('.status-line')).toContainText('Complete', { timeout: 60_000 });
  await page.getByRole('link', { name: /Read/ }).first().click();
  await expect(page.locator('.turn').first()).toContainText('Coming to you from Kenya today.');
  await expect(page.locator('.turn').nth(1)).toContainText('Coming to you from India today.');
  // Iris may paint in the tradition of a host's home: Kenya brings the woven border, India the miniature.
  const styles = page.getByRole('group', { name: 'Art style' });
  await expect(styles.getByRole('button', { name: 'Woven border' })).toBeVisible({ timeout: 30_000 });
  await expect(styles.getByRole('button', { name: 'Miniature' })).toBeVisible();
  await expect(styles.getByRole('button', { name: 'Ink wash' })).toHaveCount(0);
});

test('language: a host from Mexico puts Spanish first; the episode greets in Spanish', async ({ page }) => {
  await page.goto('/#/create');
  await page.getByRole('region', { name: 'Speaker B' }).getByLabel('Home').selectOption('MX');
  const lang = page.getByLabel('Language');
  await expect(lang.locator('optgroup').first()).toHaveAttribute('label', 'For these hosts');
  await expect(lang.locator('optgroup').first().locator('option')).toHaveText(['English', 'Spanish · Español']);
  await lang.selectOption('es');
  await expect(page.getByText(/Mock mode plays a whole sample episode in Spanish/)).toBeVisible();
  await page.getByRole('group', { name: 'Length' }).getByRole('button', { name: /Short/ }).click();
  await page.getByRole('button', { name: /Start recording/ }).click();
  await expect(page.locator('.status-line')).toContainText('Complete', { timeout: 60_000 });
  await page.getByRole('link', { name: /Read/ }).first().click();
  await expect(page.locator('.table')).toHaveAttribute('lang', 'es');
  await expect(page.locator('.turn').first()).toContainText('¡Hola y bienvenidos a CrossTalk!');
  await expect(page.locator('.turn').nth(1)).toContainText('Un saludo desde Mexico.');
  await page.goto('/#/create');
  await page.getByRole('group', { name: 'Length' }).getByRole('button', { name: /Normal/ }).click();
});

test('host photos: "still being made" is waited for, then the photo shows and moves', async ({ page }) => {
  // A real photo can't be fetched here, so the server's answers are played back: two 202s, then a picture.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const asked = new Map<string, number>();
  await page.route('**/api/portraits/*', route => {
    const n = (asked.get(route.request().url()) ?? 0) + 1;
    asked.set(route.request().url(), n);
    return n <= 2 ? route.fulfill({ status: 202, contentType: 'application/json', body: '{"pending":true}' })
      : route.fulfill({ status: 200, contentType: 'image/png', body: png });
  });
  await page.goto('/#/create');
  await expect(page.locator('.set-photo.ok img')).toHaveCount(2, { timeout: 20_000 });
  // Typing a name doesn't ask for a photo per keystroke.
  const before = asked.size;
  await page.getByRole('region', { name: 'Speaker A' }).getByLabel('Name').pressSequentially('Priyanka', { delay: 40 });
  await expect.poll(() => asked.size, { timeout: 5000 }).toBe(before + 1);
  // The photo moves (its tilt and turn change over time).
  const motion = () => page.locator('.set-photo').first().evaluate(el => getComputedStyle(el).getPropertyValue('--tilt'));
  await expect.poll(motion, { timeout: 8000 }).not.toBe('');
});

test('react while you listen: emoji float up, and each line keeps its count', async ({ page }) => {
  const id = await finishedEpisode(page.request);
  await page.goto(`/#/studio/${id}/watch`);
  const bar = page.getByRole('group', { name: /React to turn \d+/ });
  await bar.getByRole('button', { name: /Funny/ }).click();
  await expect(bar.locator('.react-floats span')).toHaveCount(1);
  await bar.getByRole('button', { name: /Funny/ }).click();
  await bar.getByRole('button', { name: /Applause/ }).click();
  await page.getByRole('link', { name: /Read/ }).first().click();
  await expect(page.getByLabel('Your reactions: Applause 1, Funny 2')).toBeVisible();
});

test('Iris gallery as an exhibition: play, step with the keys, pause, close with Esc', async ({ page }) => {
  await finishedEpisode(page.request);
  await finishedEpisode(page.request, 'Should cities ban cars from their centres?');
  await page.goto('/#/iris');
  await page.getByRole('button', { name: '▶ Play the gallery' }).click();
  const show = page.getByRole('dialog', { name: /gallery, piece 1 of \d+/ });
  await expect(show).toBeVisible();
  await expect(show.getByRole('button', { name: 'Close' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: /piece 2 of/ })).toBeVisible();
  await page.getByRole('button', { name: '❚❚ Pause' }).click();
  await expect(page.getByRole('button', { name: '▶ Play', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('this week on CrossTalk: a recap of the latest episodes, recorded on this device', async ({ page }) => {
  test.setTimeout(180_000);
  await finishedEpisode(page.request);
  await finishedEpisode(page.request, 'Should cities ban cars from their centres?');
  await page.goto('/#/episodes');
  const recap = page.getByRole('region', { name: "This week's recap" });
  await recap.getByRole('button', { name: /Make the recap/ }).click();
  await expect(recap.getByRole('status')).toContainText(/Recording \d+ of \d+ seconds/);
  await expect(recap.locator('video.clip-video')).toBeVisible({ timeout: 150_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), recap.getByRole('link', { name: 'Download' }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^crosstalk-week-\d{4}-\d{2}-\d{2}\.(mp4|webm)$/);
});

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

test("Iris: tick your styles, and the gallery keeps every version", async ({ page, request }) => {
  await page.goto('/#/iris');
  const picks = page.getByRole('group', { name: 'Styles Iris may use' });
  // Untick Picture, Sketch and Dreamscape: Painting only.
  await picks.getByRole('button', { name: /^Picture/ }).click();
  await expect(page.getByRole('status')).toContainText('choose among Sketch, Painting, Dreamscape');
  await picks.getByRole('button', { name: /Sketch/ }).click();
  await expect(page.getByRole('status')).toContainText('choose among Painting, Dreamscape');
  await picks.getByRole('button', { name: /Dreamscape/ }).click();
  await expect(page.getByRole('status')).toContainText('use Painting for every new drawing');
  await picks.getByRole('button', { name: /Painting/ }).click();
  await expect(page.getByRole('status')).toContainText('Keep at least one style ticked');

  const id = await finishedEpisode(request);
  expect((await (await request.get(`/api/conversations/${id}`)).json()).artist.artStyle).toBe('painting');
  await page.goto(`/#/studio/${id}/read`);
  await page.getByRole('region', { name: "Iris's perspective" }).getByRole('button', { name: 'Sketch', exact: true }).click();
  await expect(page.getByRole('region', { name: "Iris's perspective" }).getByRole('img', { name: /Iris's sketch/ })).toBeVisible();

  await page.goto('/#/iris');
  const versions = page.getByRole('group', { name: /Every version for/ }).first();
  await expect(versions.getByRole('button')).toHaveCount(2);
  await versions.getByRole('button', { name: 'Painting' }).click();
  await expect(page.locator('.g-card').first().getByRole('img', { name: /Iris's painting/ })).toBeVisible();
  // Put the styles back for the other tests.
  await request.put('/api/iris/styles', { data: { styles: ['picture', 'sketch', 'painting', 'dreamscape'] } });
});

test('up next: when an episode plays through, the next one starts on its own', async ({ page, request }) => {
  // No real voices in the test browser: a stand-in speaks each line instantly.
  await page.addInitScript(() => {
    const fake = {
      speaking: false, paused: false, pending: false,
      speak(u: SpeechSynthesisUtterance) { setTimeout(() => { u.onstart?.(new Event('start') as SpeechSynthesisEvent); setTimeout(() => u.onend?.(new Event('end') as SpeechSynthesisEvent), 5); }, 5); },
      cancel() {}, pause() {}, resume() {}, getVoices: () => [], addEventListener() {}, removeEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
  });
  const first = await finishedEpisode(request, 'Should cities ban cars from downtown?');
  const second = await finishedEpisode(request);
  await page.goto(`/#/studio/${first}/listen`);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const card = page.getByRole('region', { name: 'Up next' });
  await expect(card).toContainText('Is a four-day workweek practical?');
  await card.getByRole('button', { name: '▶ Play now' }).click();
  await expect(page).toHaveURL(new RegExp(`#/studio/${second}/listen`));
  // It played through on its own, so Up next comes round again (never back to the first episode).
  await expect(page.getByRole('region', { name: 'Up next' }).or(page.getByText("That's everything on your shelf"))).toBeVisible();
  const again = page.getByRole('region', { name: 'Up next' });
  if (await again.count()) await expect(again).not.toContainText('Should cities ban cars from downtown?');
});

test('round two: same hosts pick up where they ended, linked both ways', async ({ page, request }) => {
  const id = await finishedEpisode(request);
  await page.goto(`/#/studio/${id}/read`);
  const card = page.getByRole('region', { name: 'Round 2' });
  await expect(card).toContainText('They pick up where they ended');
  await card.getByRole('button', { name: /Start round 2/ }).click();
  await expect(page).not.toHaveURL(new RegExp(id));
  const two = page.url().split('/studio/')[1].split('/')[0];
  await expect(page.locator('.status-line')).toContainText('Complete', { timeout: 60_000 });
  await expect(page.locator('.round-banner')).toContainText('Round 2');
  const v = await (await request.get(`/api/conversations/${two}`)).json();
  expect(v).toMatchObject({ round: 2, roundOf: id });
  expect(v.turns[0].text).toMatch(/^Round 2!/);
  await page.getByRole('link', { name: '← Round 1' }).click();
  await expect(page.getByRole('region', { name: 'Round 2' }).getByRole('button', { name: 'Open round 2 →' })).toBeVisible();
});

test('where do you stand: before and after, next to the hosts', async ({ page, request }) => {
  const id = await finishedEpisode(request);
  await page.goto(`/#/studio/${id}/read`);
  const meter = page.getByRole('region', { name: 'Mind-change meter' }).first();
  await expect(meter).toContainText('Before you listen: where do you stand?');
  await meter.getByRole('slider').fill('30');
  await meter.getByRole('button', { name: "That's me" }).click();
  await expect(meter).toContainText('Where are you now?');
  await meter.getByRole('slider').fill('70');
  await meter.getByRole('button', { name: 'Save' }).click();
  await expect(meter).toContainText('30% → 70% · you moved 40 toward yes');
  expect(await (await request.get(`/api/conversations/${id}`)).json()).toMatchObject({ youStart: 30, youEnd: 70 });
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

test('Scout: Show more is free, sources can be switched, social posts stay opinions', async ({ page }) => {
  await page.goto('/#/create');
  await page.getByRole('button', { name: '↻ Refresh topics' }).click();
  await expect(page.locator('.topic-card')).toHaveCount(5);
  await page.getByRole('button', { name: /Show more · \d+ left/ }).click();
  await expect.poll(() => page.locator('.topic-card').count()).toBeGreaterThan(5);
  await expect(page.locator('.topic-card', { hasText: 'Has tipping culture gone too far?' })).toBeVisible();
  const sources = page.getByRole('group', { name: 'Sources' });
  await expect(page.getByText(/brief reports them as opinions, never as facts/)).toBeVisible();
  await sources.getByRole('button', { name: 'Reddit' }).click();
  await expect(sources.getByRole('button', { name: 'Reddit' })).toHaveAttribute('aria-pressed', 'false');
  await sources.getByRole('button', { name: 'Reddit' }).click();
  await expect(page.getByText(/Last refreshed just now/)).toBeVisible();
});

test('Scout: your interests, countries and own sites; briefs show their spread', async ({ page, request }) => {
  await page.goto('/#/create');
  await page.getByRole('button', { name: '↻ Refresh topics' }).click().catch(() => {});
  await page.getByLabel('Your interests').fill('golf, tipping');
  await page.getByLabel('Your interests').press('Enter');
  await page.getByLabel('Follow a country').selectOption('IN');
  await expect(page.getByRole('button', { name: 'Stop following India' })).toBeVisible();
  const link = page.getByLabel("RSS link of a news site to add");
  await link.fill('https://localhost/rss');
  await page.getByRole('group', { name: 'Your news sites' }).getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('status').filter({ hasText: /isn't a public website/ })).toBeVisible();
  await link.fill('https://news.example/rss');
  await page.getByRole('group', { name: 'Your news sites' }).getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('button', { name: 'Remove https://news.example/rss' })).toBeVisible();
  await expect(page.locator('.topic-card .perspectives').first()).toContainText(/\d+ sources?/);
  const prefs = (await (await request.get('/api/scout')).json()).prefs;
  expect(prefs).toMatchObject({ interests: 'golf, tipping', countries: ['IN'], feeds: ['https://news.example/rss'] });
  // Put things back for the other tests.
  await request.put('/api/scout/prefs', { data: { ...prefs, interests: '', countries: [], feeds: [] } });
});

test('Scout: run it, pick a topic, and the brief follows the episode', async ({ page, request }) => {
  await page.goto('/#/create');
  await page.getByRole('button', { name: '↻ Refresh topics' }).click();
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

  // Iris's print: a print-ready A4 page, and listing text that says it's AI-made.
  const print = page.locator('.poster-tile', { hasText: 'Iris print' });
  await print.getByRole('button', { name: 'Make print' }).click();
  await expect(page.getByRole('img', { name: /Iris print for/ })).toBeVisible();
  const [dl3] = await Promise.all([page.waitForEvent('download'), print.getByRole('link', { name: 'Download' }).click()]);
  expect(dl3.suggestedFilename()).toMatch(/^crosstalk-ep\d+-iris-print\.png$/);
});

test('social clip: recorded on this device while you watch, then a real video to download', async ({ page }) => {
  test.setTimeout(150_000);
  const id = await finishedEpisode(page.request);
  await page.goto(`/#/studio/${id}/read`);
  const tile = page.locator('.clip-tile');
  // Stop part way: back to the start, cleanly.
  await tile.getByRole('button', { name: 'Make clip' }).click();
  await expect(tile.getByRole('status')).toContainText(/Recording \d+ of \d+ seconds/);
  await tile.getByRole('button', { name: 'Stop' }).click();
  await expect(tile.getByRole('button', { name: 'Make clip' })).toBeVisible();
  await expect(tile.locator('video.clip-video')).toHaveCount(0);
  await tile.getByRole('button', { name: 'Make clip' }).click();
  await expect(tile.getByRole('status')).toContainText(/Recording \d+ of \d+ seconds/);
  await expect(tile.locator('canvas.clip-canvas')).toBeVisible();
  await expect(tile.locator('video.clip-video')).toBeVisible({ timeout: 90_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), tile.getByRole('link', { name: 'Download' }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^crosstalk-ep\d+-clip\.(mp4|webm)$/);
  const size = (await import('fs')).statSync((await dl.path())!).size;
  expect(size).toBeGreaterThan(100_000);
  // The video really plays: it has a length.
  const length = await tile.locator('video.clip-video').evaluate(async (v: HTMLVideoElement) => {
    if (!Number.isFinite(v.duration)) { v.currentTime = 1e9; await new Promise(r => v.addEventListener('durationchange', r, { once: true })); }
    return v.duration;
  });
  expect(length).toBeGreaterThan(15);
});

test('raise your hand: the host invites you in, you speak, they answer', async ({ page, request }) => {
  await page.goto('/#/create');
  await page.getByRole('button', { name: /Start recording/ }).click();
  await expect.poll(() => page.locator('.pip.done').count()).toBeGreaterThanOrEqual(1);
  await page.getByRole('button', { name: '✋ Raise hand' }).click();
  const call = page.getByRole('region', { name: "You're invited on air" });
  await expect(call).toBeVisible({ timeout: 30_000 });
  await expect(call).toContainText(/go ahead|You're on/i);
  await expect(page.locator('.set-tile.G')).toContainText('You');
  const id = page.url().split('/studio/')[1].split('/')[0];
  const paused = (await (await request.get(`/api/conversations/${id}`)).json()).turns.length;
  await call.getByLabel('Your words on air').fill('I run a bakery, and Friday is our busiest day.');
  await call.getByRole('button', { name: 'Go on air' }).click();
  await expect(page.locator('.status-line')).toContainText('Complete', { timeout: 60_000 });
  const v = await (await request.get(`/api/conversations/${id}`)).json();
  expect(v.turns[paused].text).toContain('Friday is our busiest day');
});

test('raise your hand, then stay quiet: the host carries on after 15 seconds', async ({ page }) => {
  await page.goto('/#/create');
  await page.getByRole('button', { name: /Start recording/ }).click();
  await expect.poll(() => page.locator('.pip.done').count()).toBeGreaterThanOrEqual(1);
  await page.getByRole('button', { name: '✋ Raise hand' }).click();
  const call = page.getByRole('region', { name: "You're invited on air" });
  await expect(call).toContainText(/carries on in \d+ s/, { timeout: 30_000 });
  await expect(call).toBeHidden({ timeout: 25_000 });
  await expect(page.locator('.status-line')).toContainText('Complete', { timeout: 60_000 });
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
