import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { finishedEpisode, settled } from './helpers';

// No serious or critical WCAG A/AA problems on any screen.
test('accessibility: every screen passes axe (serious and critical)', async ({ page, request }) => {
  const id = await finishedEpisode(request);
  for (const path of ['/#/create', `/#/studio/${id}/watch`, `/#/studio/${id}/listen`, `/#/studio/${id}/read`, '/#/episodes', '/#/iris', '/#/settings', '/#/control']) {
    await page.goto(path);
    await settled(page);
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const bad = violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
      .map(v => `${v.id} (${v.impact}): ${v.nodes.length}× e.g. ${v.nodes[0]?.target.join(' ')}`);
    expect(bad, path).toEqual([]);
  }
});

test('reduced motion: animations are switched off', async ({ browser, request }) => {
  const id = await finishedEpisode(request);
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`/#/studio/${id}/read`);
  const anim = await page.locator('.turn').first().evaluate(el => getComputedStyle(el).animationName);
  expect(anim).toBe('none');
  await ctx.close();
});
