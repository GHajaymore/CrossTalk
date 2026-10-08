import { expect, test } from '@playwright/test';
import { finishedEpisode, noHorizontalScroll } from './helpers';

test('phone: every screen fits, the three Studio tabs work, and cues open as a sheet', async ({ page, request }) => {
  const id = await finishedEpisode(request);
  for (const path of ['/#/create', `/#/studio/${id}/watch`, `/#/studio/${id}/listen`, `/#/studio/${id}/read`, '/#/episodes', '/#/iris', '/#/settings']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await noHorizontalScroll(page), path).toBe(true);
  }
  await page.goto(`/#/studio/${id}/listen`);
  await expect(page.locator('.chapters li')).toHaveCount(16);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await page.getByRole('button', { name: 'Cues & voices' }).click();
  await expect(page.locator('.panel.open')).toBeVisible();
});
