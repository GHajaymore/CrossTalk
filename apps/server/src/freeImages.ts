// Pictures from a free image service (Pollinations: no key, no account, no cost). Shared by the hosts'
// photo portraits and Iris's paintings. Each picture is made once, checked to be an image, stored and
// served from the database. The service makes one picture at a time, so everything goes through one
// queue; requests never wait on it (202 while a picture is being made, the page asks again).

const TIMEOUT_MS = 90_000;
/** A busy reply gets one more try after this wait. */
const BUSY_WAIT_MS = 8_000;
/** Something that couldn't be made isn't asked for again until this long has passed. */
const FAILED_WAIT_MS = 10 * 60_000;

export type Img = { mime: string; data: Buffer };

/** One picture at a time, in order. */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(job: () => Promise<T>): Promise<T> {
    const p = this.tail.then(job);
    this.tail = p.catch(() => null);
    return p;
  }
}

/** The service's address for a prompt. The seed makes the same request give the same picture. */
export function pollinationsUrl(prompt: string, o: { width: number; height: number; seedText: string }) {
  let seed = 7;
  for (const ch of o.seedText) seed = (seed * 31 + ch.charCodeAt(0)) % 1_000_000;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${o.width}&height=${o.height}&seed=${seed}&nologo=true&private=true`;
}

export type MakerOptions = {
  f: typeof fetch;
  now: () => Date;
  queue: SerialQueue;
  perDay: number;
  /** Where to fetch a key's picture from, or null when the key isn't one we make. */
  url: (key: string) => string | null;
  saved: (key: string) => Img | null;
  save: (key: string, img: Img, at: string) => void;
  madeOn: (day: string) => number;
  busyWaitMs?: number;
  /** Largest picture accepted. */
  maxBytes: number;
};

export class FreeImages {
  private inFlight = new Map<string, Promise<Img | null>>();
  private failed = new Map<string, number>();
  constructor(private o: MakerOptions) {}

  private day() { return this.o.now().toISOString().slice(0, 10); }

  /** At once: the stored picture, 'pending' while it's being made (started if need be), or null when there won't be one. */
  check(key: string): Img | 'pending' | null {
    if (this.o.url(key) === null) return null;
    const saved = this.o.saved(key);
    if (saved) return saved;
    if (this.inFlight.has(key)) return 'pending';
    if (this.o.now().getTime() - (this.failed.get(key) ?? -Infinity) < FAILED_WAIT_MS) return null;
    // Pictures still being made count toward the day's cap too.
    if (this.o.madeOn(this.day()) + this.inFlight.size >= this.o.perDay) return null;
    void this.get(key);
    return 'pending';
  }

  /** The stored picture, or one made now (waiting for it); null when there won't be one. */
  async get(key: string): Promise<Img | null> {
    const url = this.o.url(key);
    if (url === null) return null;
    const saved = this.o.saved(key);
    if (saved) return saved;
    const pending = this.inFlight.get(key);
    if (pending) return pending;
    if (this.o.madeOn(this.day()) >= this.o.perDay) return null;
    const p = this.o.queue.run(() => this.fetchOne(key, url))
      .then(got => { if (!got) this.failed.set(key, this.o.now().getTime()); return got; })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, p);
    return p;
  }

  private async fetchOne(key: string, url: string, retry = true): Promise<Img | null> {
    try {
      const res = await this.o.f(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'image/jpeg,image/png,image/webp' } });
      if ((res.status === 429 || res.status === 503) && retry) {
        await new Promise(r => setTimeout(r, this.o.busyWaitMs ?? BUSY_WAIT_MS));
        return this.fetchOne(key, url, false);
      }
      const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim();
      if (!res.ok || !/^image\/(jpeg|png|webp)$/.test(mime)) return null;
      const data = Buffer.from(await res.arrayBuffer());
      if (!data.length || data.length > this.o.maxBytes) return null;
      this.o.save(key, { mime, data }, this.o.now().toISOString());
      return { mime, data };
    } catch { return null; }
  }
}
