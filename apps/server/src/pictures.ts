// Iris's real paintings: for each drawing version, a full illustration made once by the free image
// service from her own painting brief, stored and served from the database. Her checked line drawing
// stays as the instant version, and as the fallback whenever a painting can't be made.
import { homeStylesFor, type HomeStyle } from '@crosstalk/shared';
import type { Repo } from './db/repo';
import { FreeImages, SerialQueue, type Img, type ImageService } from './freeImages';

/** New paintings made per day at most. */
export const PICTURES_PER_DAY = 30;

// The hosts' homes, as a place's feel for a photograph (their art traditions are Iris's other styles).
const PLACE: Record<HomeStyle, string> = {
  inkwash: 'East Asia, quiet streets and soft light',
  folk: 'Latin America, warm colour and lively streets',
  tiles: 'the Middle East or North Africa, tiled walls and bright sun',
  miniature: 'South Asia, rich colour and busy markets',
  woven: 'sub-Saharan Africa, bold textiles and open light',
};

const clean = (s: string, max: number) => s.replace(/[<>{}\[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** The prompt sent for her picture: her brief to the photographer, the feel of the hosts' homes, and firm limits. Never a host's name. */
export function picturePrompt(brief: { imagePrompt: string; caption: string }, topic: string, homes: HomeStyle[]) {
  const scene = clean(brief.imagePrompt, 600) || `A scene about the question "${clean(topic, 160)}", showing this moment: ${clean(brief.caption, 160)}`;
  return [
    `A real-looking cinematic photograph: ${scene}`,
    // A host's home shows in the setting, not as a painting style.
    homes[0] ? `set somewhere with the feel of ${PLACE[homes[0]]}` : '',
    'natural light, true-to-life colour and detail, shallow depth of field, 35mm, documentary style, one clear focal point',
    'a fictional scene with invented adults only: no children, no text, no words, no letters, no captions, no logos, no watermark, no real or famous people',
  ].filter(Boolean).join('. ');
}

export const pictureKey = (conversationId: string, version: number) => `${conversationId}:${version}`;

export class IrisPictures {
  private maker: FreeImages;
  constructor(repo: Repo, f: typeof fetch, queue: SerialQueue, now: () => Date = () => new Date(), busyWaitMs?: number, service?: ImageService) {
    const parse = (key: string) => {
      const m = /^([0-9a-f-]{36}):([1-9]\d{0,3})$/.exec(key);
      return m ? { id: m[1], version: Number(m[2]) } : null;
    };
    this.maker = new FreeImages({
      f, now, queue, perDay: PICTURES_PER_DAY, busyWaitMs, maxBytes: 5_000_000, service,
      job: key => {
        const k = parse(key);
        const c = k && repo.getConversation(k.id);
        // Only drawings that are (or were) shown as a Picture: nobody can spend the day's paintings on the rest.
        const brief = k && c && repo.pictureWanted(k.id, k.version) && repo.artworkBrief(k.id, k.version);
        return brief ? { prompt: picturePrompt(brief, c!.topic, homeStylesFor(c!.speakers)), width: 1024, height: 614, seedText: key } : null;
      },
      saved: key => { const k = parse(key); return k ? repo.getPicture(k.id, k.version) : null; },
      save: (key, img, at) => { const k = parse(key)!; repo.savePicture(k.id, k.version, img.mime, img.data, at); },
      madeOn: day => repo.picturesMadeOn(day),
    });
  }
  check(conversationId: string, version: number): Img | 'pending' | null { return this.maker.check(pictureKey(conversationId, version)); }
  get health() { return this.maker.health; }
  get(conversationId: string, version: number): Promise<Img | null> { return this.maker.get(pictureKey(conversationId, version)); }
}
