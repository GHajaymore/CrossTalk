// Iris's best art for an episode, as an image: the AI picture in her style when it's ready, otherwise
// the one her own engine paints on this device. Null for styles that are line art (then callers use it).
import { artSeed, type ArtistNotes } from '@crosstalk/shared';
import { irisArtUrl, type EngineStyle } from './irisEngine';
import { readyPicture } from './usePolledImage';

const ENGINE: readonly string[] = ['picture', 'dreamscape', 'sketch'];

type WithArt = { id: string; artist?: Pick<ArtistNotes, 'artStyle' | 'version' | 'sketchSvg' | 'imagePrompt' | 'state'> | null };

/** An image URL (blob: or data:) for her art, or null. `onlyReady` never asks for a new AI picture. */
export async function bestArt(v: WithArt, onlyReady = false): Promise<string | null> {
  const a = v.artist;
  if (!a || a.state !== 'done' || !a.sketchSvg || !ENGINE.includes(a.artStyle)) return null;
  const pic = await readyPicture({ id: v.id, artist: a }, onlyReady);
  if (pic) return URL.createObjectURL(pic);
  return irisArtUrl({ sketch: a.sketchSvg, seed: artSeed(v.id, a.version), brief: a.imagePrompt, style: a.artStyle as EngineStyle });
}

// Thumbnails paint one at a time, with a pause between, so a long list never stalls the page.
let line: Promise<unknown> = Promise.resolve();
export function bestArtQueued(v: WithArt): Promise<string | null> {
  const next = line.then(() => new Promise(r => setTimeout(r, 30))).then(() => bestArt(v, true)).catch(() => null);
  line = next;
  return next;
}
