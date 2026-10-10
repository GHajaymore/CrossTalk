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

/** Her styles an AI image model makes: a photograph, a dreamscape, a pencil sketch. */
export const AI_STYLES = ['picture', 'dreamscape', 'sketch'] as const;
export type AiStyle = typeof AI_STYLES[number];

/** Camera words in her brief, which only make sense for a photograph. */
const CAMERA = /,?\s*\b(\d{2,3}\s?mm( lens| film)?|shallow depth of field|film (grain|look)|bokeh|lens)\b/gi;

/** The prompt sent for her picture: her brief, the feel of the hosts' homes, and firm limits. Never a host's name. */
export function picturePrompt(brief: { imagePrompt: string; caption: string }, topic: string, homes: HomeStyle[], style: AiStyle = 'picture') {
  const scene = clean(brief.imagePrompt, 600) || `A scene about the question "${clean(topic, 160)}", showing this moment: ${clean(brief.caption, 160)}`;
  const limits = 'invented adults only: no children, no text, no words, no letters, no captions, no logos, no watermark, no real or famous people';
  if (style === 'dreamscape') {
    return [
      `A surreal, dreamlike fine-art image of the idea behind this scene: ${scene.replace(CAMERA, '')}`,
      'reimagined as a dream: impossible scale, floating forms, symbolic objects, a luminous night sky with aurora light, soft glowing mist, deep blues and violets with warm points of light',
      'painterly, ethereal, cinematic composition, museum-quality digital painting',
      limits,
    ].join('. ');
  }
  if (style === 'sketch') {
    return [
      `A detailed graphite pencil sketch on textured cream paper of this scene: ${scene.replace(CAMERA, '')}`,
      "confident hand-drawn lines, careful cross-hatching and shading, a few loose construction lines, light watercolour wash accents, an artist's sketchbook page",
      'black and grey pencil with soft touches of colour, no photograph, no digital look',
      limits,
    ].join('. ');
  }
  return [
    `A real-looking cinematic photograph: ${scene}`,
    // A host's home shows in the setting, not as a painting style.
    homes[0] ? `set somewhere with the feel of ${PLACE[homes[0]]}` : '',
    'natural light, true-to-life colour and detail, shallow depth of field, 35mm, documentary style, one clear focal point',
    'a fictional scene with invented adults only: no children, no text, no words, no letters, no captions, no logos, no watermark, no real or famous people',
  ].filter(Boolean).join('. ');
}

export const pictureKey = (conversationId: string, version: number, style: AiStyle = 'picture') => `${conversationId}:${version}${style === 'picture' ? '' : `:${style}`}`;

export class IrisPictures {
  private maker: FreeImages;
  constructor(repo: Repo, f: typeof fetch, queue: SerialQueue, now: () => Date = () => new Date(), busyWaitMs?: number, service?: ImageService) {
    const parse = (key: string) => {
      const m = /^([0-9a-f-]{36}):([1-9]\d{0,3})(?::(dreamscape|sketch))?$/.exec(key);
      return m ? { id: m[1], version: Number(m[2]), style: (m[3] ?? 'picture') as AiStyle } : null;
    };
    this.maker = new FreeImages({
      f, now, queue, perDay: PICTURES_PER_DAY, busyWaitMs, maxBytes: 5_000_000, service,
      job: key => {
        const k = parse(key);
        const c = k && repo.getConversation(k.id);
        // Only drawings that are (or were) shown in that style: nobody can spend the day's pictures on the rest.
        const brief = k && c && repo.pictureWanted(k.id, k.version, k.style) && repo.artworkBrief(k.id, k.version);
        return brief ? { prompt: picturePrompt(brief, c!.topic, homeStylesFor(c!.speakers), k!.style), width: 1024, height: 614, seedText: key } : null;
      },
      saved: key => { const k = parse(key); return k ? repo.getPicture(k.id, k.version, k.style) : null; },
      save: (key, img, at) => { const k = parse(key)!; repo.savePicture(k.id, k.version, img.mime, img.data, at, k.style); },
      madeOn: day => repo.picturesMadeOn(day),
    });
  }
  check(conversationId: string, version: number, style: AiStyle = 'picture'): Img | 'pending' | null { return this.maker.check(pictureKey(conversationId, version, style)); }
  get health() { return this.maker.health; }
  get(conversationId: string, version: number, style: AiStyle = 'picture'): Promise<Img | null> { return this.maker.get(pictureKey(conversationId, version, style)); }
}
