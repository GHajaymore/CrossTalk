// Photo portraits for the invented hosts (free: Pollinations' image service, no key). Each look is
// made once from fixed traits, stored, then served from the database. If anything goes wrong the app
// shows the drawn portrait instead.
import { parseLookCode, portraitPrompt } from '@crosstalk/shared';
import type { Repo } from './db/repo';
import { FreeImages, pollinationsUrl, SerialQueue, type Img } from './freeImages';

/** New looks made per day at most: a guard against anyone asking for every combination. */
export const PORTRAITS_PER_DAY = 24;

// The seed comes from the look, so the same host gets the same person every time.
export const portraitUrl = (code: string, prompt: string) => pollinationsUrl(prompt, { width: 512, height: 512, seedText: code });

export class Portraits {
  private maker: FreeImages;
  constructor(repo: Repo, f: typeof fetch, now: () => Date = () => new Date(), busyWaitMs?: number, queue = new SerialQueue()) {
    this.maker = new FreeImages({
      f, now, queue, perDay: PORTRAITS_PER_DAY, busyWaitMs, maxBytes: 3_000_000,
      url: code => { const t = parseLookCode(code); return t ? portraitUrl(code, portraitPrompt(t)) : null; },
      saved: code => repo.getPortrait(code),
      save: (code, img, at) => repo.savePortrait(code, img.mime, img.data, at),
      madeOn: day => repo.portraitsMadeOn(day),
    });
  }
  check(code: string): Img | 'pending' | null { return this.maker.check(code); }
  get health() { return this.maker.health; }
  get(code: string): Promise<Img | null> { return this.maker.get(code); }
}
