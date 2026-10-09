// "This week on CrossTalk": one vertical video of your latest episodes, one key moment each (the line
// Iris drew, then her art), between a title card and an end card. Built from the same pieces as the
// social clip and recorded the same way, on the device.
import { ARTIST, artworkSvg, episodeLabel, NOTICE, type ConversationView } from '@crosstalk/shared';
import { CLIP_H, CLIP_W, clipText, drawFrame, loadClipAssets, loadClipFonts, assetUrls, recordFrames, tokensOf, type ClipAssets, type ClipPlan } from './clip';
import { musicPlan } from './clipMusic';
import { C, SAY, TAG, UI, wrap } from './poster';
import { wordsIn } from '@crosstalk/shared';

/** At most this many episodes in a recap: about a minute of video. */
export const RECAP_MAX = 5;

export type RecapSegment = { v: ConversationView; plan: ClipPlan; start: number; end: number };
export type RecapPlan = { intro: { start: number; end: number }; segments: RecapSegment[]; outro: { start: number; end: number }; duration: number };

/** Episodes a recap can use: finished, with Iris's art, newest first. */
export const recapReady = (v: ConversationView) => v.run?.state === 'completed' && v.artist?.state === 'done' && !!artworkSvg(v.artist) && v.turns.length > 0;

/** For each episode, its own short act: the question and hosts, the line Iris drew, her art. */
export function planRecap(views: ConversationView[]): RecapPlan {
  let t = 0;
  const intro = { start: t, end: (t += 3) };
  const segments = views.filter(recapReady).slice(0, RECAP_MAX).map(v => {
    const turn = v.turns.find(x => x.seq === v.artist!.momentSeq) ?? v.turns[Math.floor(v.turns.length / 2)];
    const text = clipText(turn.text, 30);
    const read = Math.min(7.5, Math.max(3.5, wordsIn(text) / 2.7 + 0.8));
    const plan: ClipPlan = {
      intro: { start: 0, end: 2.8 },
      lines: [{ seq: turn.seq, speakerId: turn.speakerId, job: turn.objective, tokens: tokensOf(text), spaced: / /.test(text.trim()), start: 2.8, end: 2.8 + read }],
      meter: null,
      art: { start: 2.8 + read, end: 2.8 + read + 4.2 },
      outro: { start: 2.8 + read + 4.2, end: 2.8 + read + 4.2 },
      duration: 2.8 + read + 4.2,
    };
    const seg = { v, plan, start: t, end: t + plan.duration };
    t = seg.end;
    return seg;
  });
  const outro = { start: t, end: (t += 3.5) };
  return { intro, segments, outro, duration: t };
}

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - (1 - x) ** 3);

function card(ctx: CanvasRenderingContext2D, alpha: number, draw: () => void) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, CLIP_W, CLIP_H);
  const lamp = ctx.createRadialGradient(CLIP_W / 2, 420, 20, CLIP_W / 2, 520, 900);
  lamp.addColorStop(0, 'rgba(185,164,230,0.16)'); lamp.addColorStop(1, 'rgba(17,18,20,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, CLIP_W, CLIP_H);
  ctx.save(); ctx.globalAlpha = alpha; ctx.direction = 'ltr'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  draw();
  ctx.restore();
}

/** One frame of the recap at time `t`. */
export function drawRecap(ctx: CanvasRenderingContext2D, r: RecapPlan, assets: ClipAssets[], t: number) {
  if (t < r.intro.end) {
    const a = Math.min(ease(t / 0.5), ease((r.intro.end - t) / 0.4));
    card(ctx, a, () => {
      ctx.fillStyle = C.a; ctx.fillRect(CLIP_W / 2 - 30, 300, 26, 58);
      ctx.fillStyle = C.b; ctx.fillRect(CLIP_W / 2 + 4, 300, 26, 58);
      ctx.fillStyle = C.cue; ctx.font = `20px ${TAG}`;
      ctx.fillText('THIS WEEK ON', CLIP_W / 2, 430);
      ctx.fillStyle = C.text; ctx.font = `700 64px ${UI}`;
      ctx.fillText('CrossTalk', CLIP_W / 2, 505);
      ctx.font = `600 26px ${SAY}`;
      r.segments.forEach((s, k) => {
        const show = ease((t - 0.4 - k * 0.25) / 0.5);
        ctx.globalAlpha = a * show;
        ctx.fillStyle = k % 2 ? C.b : C.a;
        ctx.fillText(wrap(ctx, s.v.topic, CLIP_W - 120, 1)[0] ?? '', CLIP_W / 2, 610 + k * 54 + (1 - show) * 16);
      });
    });
    return;
  }
  const k = r.segments.findIndex(s => t >= s.start && t < s.end);
  if (k >= 0) {
    const s = r.segments[k];
    drawFrame(ctx, s.v, s.plan, assets[k], t - s.start);
    // Where we are in the week.
    ctx.save(); ctx.direction = 'ltr'; ctx.textAlign = 'center'; ctx.fillStyle = C.muted; ctx.font = `16px ${TAG}`;
    ctx.fillText(`${k + 1} OF ${r.segments.length} · ${episodeLabel(s.v.episode).toUpperCase()}`, CLIP_W / 2, CLIP_H - 60);
    ctx.restore();
    return;
  }
  const a = ease((t - r.outro.start) / 0.5);
  card(ctx, a, () => {
    ctx.fillStyle = C.text; ctx.font = `700 46px ${UI}`;
    ctx.fillText('That was the week', CLIP_W / 2, 560);
    ctx.fillStyle = C.muted; ctx.font = `24px ${UI}`;
    ctx.fillText(`${r.segments.length} questions · ${r.segments.length * 2} AI hosts · art by ${ARTIST.name}`, CLIP_W / 2, 610);
    ctx.font = `16px ${TAG}`;
    wrap(ctx, `${NOTICE} The hosts are invented AI characters.`, CLIP_W - 120, 3).forEach((l, i) => ctx.fillText(l, CLIP_W / 2, 1120 + i * 24));
  });
}

export const recapName = () => `crosstalk-week-${new Date().toISOString().slice(0, 10)}`;

/** Records the recap. Resolves with the video. */
export async function recordRecap(views: ConversationView[], canvas: HTMLCanvasElement, opts: { photos: boolean; music?: boolean; onProgress?: (sec: number, total: number) => void; signal?: AbortSignal }) {
  const plan = planRecap(views);
  if (!plan.segments.length) throw new Error('Finish an episode (with Iris\'s art) first: the recap is made from your latest ones.');
  await loadClipFonts();
  const assets = await Promise.all(plan.segments.map(s => loadClipAssets(s.v, opts.photos)));
  return recordFrames({
    canvas, duration: plan.duration, draw: (ctx, t) => drawRecap(ctx, plan, assets, t),
    music: opts.music ? musicPlan(`week:${plan.segments.map(s => s.v.id).join()}`, 'lively', plan.duration, plan.segments.map(s => s.start)) : null,
    urls: assets.flatMap(assetUrls), onProgress: opts.onProgress, signal: opts.signal,
  });
}
