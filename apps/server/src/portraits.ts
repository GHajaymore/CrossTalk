// Photo portraits for the invented hosts (free: Pollinations' image service, no key). Each look is
// fetched once from fixed traits, checked to be an image, stored, then served from the database.
// If anything goes wrong the app shows the drawn portrait instead.
import { parseLookCode, portraitPrompt } from '@crosstalk/shared';
import type { Repo } from './db/repo';

/** New looks fetched per day at most: a guard against anyone asking for every combination. */
export const PORTRAITS_PER_DAY = 24;
const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 90_000;
/** The free tier serves one picture at a time per server, so a busy reply gets one more try after this wait. */
const BUSY_WAIT_MS = 8_000;

export const portraitUrl = (code: string, prompt: string) => {
  // The seed comes from the look, so the same host gets the same person every time.
  let seed = 7;
  for (const ch of code) seed = (seed * 31 + ch.charCodeAt(0)) % 1_000_000;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&seed=${seed}&nologo=true&private=true`;
};

export class Portraits {
  private inFlight = new Map<string, Promise<{ mime: string; data: Buffer } | null>>();
  /** Photos are asked for one after another, never two at once. */
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private repo: Repo, private f: typeof fetch, private now: () => Date = () => new Date(), private busyWaitMs = BUSY_WAIT_MS) {}

  /** The stored photo, or a new one fetched once; null when the code isn't a look or no photo can be had. */
  async get(code: string): Promise<{ mime: string; data: Buffer } | null> {
    const traits = parseLookCode(code);
    if (!traits) return null;
    const saved = this.repo.getPortrait(code);
    if (saved) return saved;
    const pending = this.inFlight.get(code);
    if (pending) return pending;
    if (this.repo.portraitsMadeOn(this.now().toISOString().slice(0, 10)) >= PORTRAITS_PER_DAY) return null;
    const p = this.queue.then(() => this.fetchOne(code, portraitPrompt(traits))).finally(() => this.inFlight.delete(code));
    this.queue = p.catch(() => null);
    this.inFlight.set(code, p);
    return p;
  }

  private async fetchOne(code: string, prompt: string, retry = true): Promise<{ mime: string; data: Buffer } | null> {
    try {
      const res = await this.f(portraitUrl(code, prompt), { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'image/jpeg,image/png,image/webp' } });
      if ((res.status === 429 || res.status === 503) && retry) {
        await new Promise(r => setTimeout(r, this.busyWaitMs));
        return this.fetchOne(code, prompt, false);
      }
      const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim();
      if (!res.ok || !/^image\/(jpeg|png|webp)$/.test(mime)) return null;
      const data = Buffer.from(await res.arrayBuffer());
      if (!data.length || data.length > MAX_BYTES) return null;
      this.repo.savePortrait(code, mime, data, this.now().toISOString());
      return { mime, data };
    } catch { return null; }
  }
}
