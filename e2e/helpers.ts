import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const TOPIC = 'Is a four-day workweek practical?';

export const draft = (topic = TOPIC) => ({
  topic, mode: 'explore', format: 'recorded', audience: 'general', temperature: 'lively',
  speakers: {
    A: { name: '', autoName: true, persona: 'optimist', autoPersona: true, lens: '', role: '', autoRole: true },
    B: { name: '', autoName: true, persona: 'skeptic', autoPersona: true, lens: '', role: '', autoRole: true },
  },
});

/** Fast mock streaming, so a full episode takes seconds. */
export async function fastMock(request: APIRequestContext) {
  await request.put('/api/mock', { data: { failOnce: false, fast: true } });
}

/** Creates an episode through the API and runs it to the end (Iris included). */
export async function finishedEpisode(request: APIRequestContext, topic = TOPIC) {
  await fastMock(request);
  const c = await (await request.post('/api/conversations', { data: draft(topic) })).json();
  await request.post(`/api/conversations/${c.id}/start`);
  await expect.poll(async () => {
    const v = await (await request.get(`/api/conversations/${c.id}`)).json();
    return `${v.run?.state}/${v.artist?.state}`;
  }, { timeout: 60_000 }).toBe('completed/done');
  return c.id as string;
}

export const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
