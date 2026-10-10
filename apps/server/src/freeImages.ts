// Pictures from a free AI image service: Cloudflare Workers AI (FLUX.1 schnell, on a free account
// with no card) when it's set up, otherwise Pollinations (no key, no account). Never both: one
// service, chosen in the settings. Shared by the hosts' photo portraits and Iris's pictures. Each picture is made once, checked to be an image, stored and
// served from the database. The service makes one picture at a time, so everything goes through one
// queue; requests never wait on it (202 while a picture is being made, the page asks again).

const TIMEOUT_MS = 90_000;
/** A busy reply gets one more try after this wait. */
const BUSY_WAIT_MS = 8_000;
/** Something that couldn't be made isn't asked for again until this long has passed. */
const FAILED_WAIT_MS = 10 * 60_000;

export type Img = { mime: string; data: Buffer };

/** What to make: the words, the size wanted, and a seed text (the same request gives the same picture where the service allows). */
export type ImageJob = { prompt: string; width: number; height: number; seedText: string };
type Made = { ok: true; img: Img } | { ok: false; busy: boolean; reason: string };

/** One image service. */
export type ImageService = { name: string; make(job: ImageJob, f: typeof fetch, signal: AbortSignal): Promise<Made> };

const IMAGE_MIME = /^image\/(jpeg|png|webp)$/;

/** Pollinations: a plain web address per picture. */
export const pollinations: ImageService = {
  name: 'Pollinations',
  async make(job, f, signal) {
    const res = await f(pollinationsUrl(job.prompt, job), { signal, headers: { Accept: 'image/jpeg,image/png,image/webp' } });
    const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!res.ok) {
      const body = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160);
      return { ok: false, busy: res.status === 429 || res.status === 503, reason: `The image service answered ${res.status}${body ? `: ${body}` : ''}` };
    }
    if (!IMAGE_MIME.test(mime)) return { ok: false, busy: false, reason: `The image service sent ${mime || 'something'} instead of a picture.` };
    return { ok: true, img: { mime, data: Buffer.from(await res.arrayBuffer()) } };
  },
};

/** The one Cloudflare model CrossTalk uses: FLUX.1 schnell, a fast photographic model. */
export const CLOUDFLARE_MODEL = '@cf/black-forest-labs/flux-1-schnell';

/** Cloudflare Workers AI on the owner's free account. The token travels only in the header. */
export function cloudflare(accountId: string, token: string): ImageService {
  return {
    name: 'Cloudflare Workers AI',
    async make(job, f, signal) {
      const res = await f(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${CLOUDFLARE_MODEL}`, {
        method: 'POST', signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: job.prompt.slice(0, 2048), steps: 8 }),
      });
      let body: { success?: boolean; result?: { image?: string }; errors?: { message?: string }[] } = {};
      try { body = await res.json() as typeof body; } catch { /* not JSON */ }
      const said = body.errors?.map(e => e.message).filter(Boolean).join('; ').slice(0, 200) ?? '';
      if (!res.ok || !body.result?.image) {
        // A spent daily allowance isn't "busy": it's back tomorrow (00:00 UTC).
        const daily = /neuron|daily|allocation|quota/i.test(said);
        return { ok: false, busy: !daily && (res.status === 429 || res.status >= 500), reason: `Cloudflare answered ${res.status}${said ? `: ${said}` : ''}${daily ? ' (the free daily allowance is used up; it resets at 00:00 UTC)' : ''}` };
      }
      const data = Buffer.from(body.result.image, 'base64');
      // FLUX answers in JPEG; check the bytes rather than trust it.
      const mime = data[0] === 0xff && data[1] === 0xd8 ? 'image/jpeg' : data[0] === 0x89 && data[1] === 0x50 ? 'image/png' : data.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : '';
      if (!mime) return { ok: false, busy: false, reason: 'Cloudflare sent something that isn\'t a picture.' };
      return { ok: true, img: { mime, data } };
    },
  };
}

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
  /** What to make for a key, or null when the key isn't one we make. */
  job: (key: string) => ImageJob | null;
  /** Which service makes it (Pollinations when left out). */
  service?: ImageService;
  saved: (key: string) => Img | null;
  save: (key: string, img: Img, at: string) => void;
  madeOn: (day: string) => number;
  busyWaitMs?: number;
  /** Largest picture accepted. */
  maxBytes: number;
};

/** How the image service did last time: for Settings, so a failure has a reason. */
export type ImageHealth = { lastOkAt: string | null; lastError: string | null; lastErrorAt: string | null };

export class FreeImages {
  health: ImageHealth = { lastOkAt: null, lastError: null, lastErrorAt: null };
  private inFlight = new Map<string, Promise<Img | null>>();
  private failed = new Map<string, number>();
  constructor(private o: MakerOptions) {}

  private day() { return this.o.now().toISOString().slice(0, 10); }

  /** At once: the stored picture, 'pending' while it's being made (started if need be), or null when there won't be one. */
  check(key: string): Img | 'pending' | null {
    if (this.o.job(key) === null) return null;
    const saved = this.o.saved(key);
    if (saved) return saved;
    if (this.inFlight.has(key)) return 'pending';
    if (!this.mayStart(key)) return null;
    void this.get(key);
    return 'pending';
  }

  /** Not lately failed, and room left today (pictures still being made count too). */
  private mayStart(key: string) {
    if (this.o.now().getTime() - (this.failed.get(key) ?? -Infinity) < FAILED_WAIT_MS) return false;
    return this.o.madeOn(this.day()) + this.inFlight.size < this.o.perDay;
  }

  /** The stored picture, or one made now (waiting for it); null when there won't be one. */
  async get(key: string): Promise<Img | null> {
    const job = this.o.job(key);
    if (job === null) return null;
    const saved = this.o.saved(key);
    if (saved) return saved;
    const pending = this.inFlight.get(key);
    if (pending) return pending;
    if (!this.mayStart(key)) return null;
    const p = this.o.queue.run(() => this.fetchOne(key, job))
      .then(got => { if (!got) this.failed.set(key, this.o.now().getTime()); return got; })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, p);
    return p;
  }

  private async fetchOne(key: string, job: ImageJob, retry = true): Promise<Img | null> {
    const service = this.o.service ?? pollinations;
    try {
      const made = await service.make(job, this.o.f, AbortSignal.timeout(TIMEOUT_MS));
      if (!made.ok) {
        if (made.busy && retry) {
          await new Promise(r => setTimeout(r, this.o.busyWaitMs ?? BUSY_WAIT_MS));
          return this.fetchOne(key, job, false);
        }
        return this.failure(made.reason);
      }
      const { mime, data } = made.img;
      if (!IMAGE_MIME.test(mime)) return this.failure(`${service.name} sent ${mime || 'something'} instead of a picture.`);
      if (!data.length || data.length > this.o.maxBytes) return this.failure(data.length ? 'The picture was too large.' : 'The picture was empty.');
      this.o.save(key, { mime, data }, this.o.now().toISOString());
      this.health = { ...this.health, lastOkAt: this.o.now().toISOString() };
      return { mime, data };
    } catch (e) {
      return this.failure((e as Error).name === 'TimeoutError' ? `${service.name} took over 90 seconds.` : `Couldn't reach ${service.name} (${(e as Error).message}).`);
    }
  }

  private failure(reason: string): null {
    this.health = { ...this.health, lastError: reason, lastErrorAt: this.o.now().toISOString() };
    console.warn(`Free images: ${reason}`);
    return null;
  }
}
