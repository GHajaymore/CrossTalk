// Iris's real paintings: for each drawing version, a full illustration made once by the free image
// service from her own painting brief, stored and served from the database. Her checked line drawing
// stays as the instant version, and as the fallback whenever a painting can't be made.
import { homeStylesFor, type HomeStyle } from '@crosstalk/shared';
import type { Repo } from './db/repo';
import { FreeImages, pollinationsUrl, SerialQueue, type Img } from './freeImages';

/** New paintings made per day at most. */
export const PICTURES_PER_DAY = 30;

// A respectful nod to the tradition of a host's home, in words an image model understands.
const TRADITION: Record<HomeStyle, string> = {
  inkwash: 'painted in the manner of East Asian ink-wash painting, expressive brush and ink with soft washes and a small red seal',
  folk: 'painted with the bright, joyful palette of Latin American folk art, bold flat colour and papel picado bunting',
  tiles: 'framed by Middle Eastern and North African geometric tilework, deep blues, turquoise and gold',
  miniature: 'in the jewel-toned style of South Asian miniature painting, fine detail inside an ornate gold border',
  woven: 'with bold African textile patterns woven into the border, earth tones and bright accents',
};

const clean = (s: string, max: number) => s.replace(/[<>{}\[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** The prompt sent for a painting: her brief, the tradition of the hosts' homes, and firm limits. Only art words; never a host's name. */
export function picturePrompt(brief: { imagePrompt: string; caption: string }, topic: string, homes: HomeStyle[]) {
  const scene = clean(brief.imagePrompt, 600) || `A painted scene about the question "${clean(topic, 160)}", showing this moment: ${clean(brief.caption, 160)}`;
  return [
    scene,
    homes[0] ? TRADITION[homes[0]] : 'a rich painterly illustration, expressive visible brushwork, layered glazes of colour',
    'cinematic light, depth and atmosphere, one clear focal point, thoughtful composition, museum-quality fine art',
    'a fictional scene: no text, no words, no letters, no captions, no logos, no watermark, no real or famous people',
  ].join('. ');
}

export const pictureKey = (conversationId: string, version: number) => `${conversationId}:${version}`;

export class IrisPictures {
  private maker: FreeImages;
  constructor(repo: Repo, f: typeof fetch, queue: SerialQueue, now: () => Date = () => new Date(), busyWaitMs?: number) {
    const parse = (key: string) => {
      const m = /^([0-9a-f-]{36}):([1-9]\d{0,3})$/.exec(key);
      return m ? { id: m[1], version: Number(m[2]) } : null;
    };
    this.maker = new FreeImages({
      f, now, queue, perDay: PICTURES_PER_DAY, busyWaitMs, maxBytes: 5_000_000,
      url: key => {
        const k = parse(key);
        const c = k && repo.getConversation(k.id);
        // Only drawings that are (or were) shown as a Picture: nobody can spend the day's paintings on the rest.
        const brief = k && c && repo.pictureWanted(k.id, k.version) && repo.artworkBrief(k.id, k.version);
        return brief ? pollinationsUrl(picturePrompt(brief, c!.topic, homeStylesFor(c!.speakers)), { width: 1024, height: 614, seedText: key }) : null;
      },
      saved: key => { const k = parse(key); return k ? repo.getPicture(k.id, k.version) : null; },
      save: (key, img, at) => { const k = parse(key)!; repo.savePicture(k.id, k.version, img.mime, img.data, at); },
      madeOn: day => repo.picturesMadeOn(day),
    });
  }
  check(conversationId: string, version: number): Img | 'pending' | null { return this.maker.check(pictureKey(conversationId, version)); }
  get(conversationId: string, version: number): Promise<Img | null> { return this.maker.get(pictureKey(conversationId, version)); }
}
