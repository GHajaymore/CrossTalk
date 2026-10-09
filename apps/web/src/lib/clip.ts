// The social clip: a 30–45 second vertical video of an episode's key moment, made on this device
// (canvas + MediaRecorder: no server, no cost, nothing uploaded). Captions carry it, like most social
// clips: the hosts' device voices can't be recorded, so the clip is silent unless you add music.
//
// planClip() decides what's shown and when (pure, so it's tested); drawFrame() paints one moment;
// recordClip() plays the frames in real time into a video file.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ARTIST, artworkSvg, episodeLabel, homeOf, hostSubtitle, hostTraits, isRtl, lookCode, mindChange, NOTICE, sentencesOf, wordsIn,
  type ConversationView, type SpeakerId,
} from '@crosstalk/shared';
import { Portrait } from '../studio/Portrait';
import { C, loadImage, SAY, TAG, UI, wrap } from './poster';

export const CLIP_W = 720, CLIP_H = 1280, CLIP_FPS = 30;

export type ClipLine = { seq: number; speakerId: SpeakerId; job: string; tokens: string[]; start: number; end: number };
export type ClipPlan = {
  intro: { start: number; end: number };
  lines: ClipLine[];
  meter: { start: number; end: number } | null;
  art: { start: number; end: number } | null;
  outro: { start: number; end: number };
  duration: number;
};

/** Words to light up one by one; Chinese and Japanese (no spaces) go by character. */
export function tokensOf(text: string): string[] {
  const t = text.replace(/\s+/g, ' ').trim();
  return / /.test(t) ? t.split(' ') : [...t];
}

/** At most ~40 spoken words of a line, cut at a sentence end where possible. */
export function clipText(text: string, max = 40): string {
  if (wordsIn(text) <= max) return text.trim();
  let out = '';
  for (const s of sentencesOf(text)) {
    if (out && wordsIn(`${out} ${s}`) > max) break;
    out = out ? `${out} ${s}` : s;
  }
  if (wordsIn(out) <= max) return out;
  const toks = tokensOf(out);
  return `${toks.slice(0, max).join(toks[0]?.length === 1 && !/ /.test(out) ? '' : ' ')}…`;
}

/** What the clip shows, and when: the opening, the key moment (the line Iris drew and its neighbours), the meter, Iris's art, the end card. */
export function planClip(v: ConversationView): ClipPlan {
  const at = v.artist?.state === 'done' ? v.artist.momentSeq : 0;
  const centre = v.turns.find(t => t.seq === at) ?? v.turns[Math.floor(v.turns.length / 2)] ?? v.turns[0];
  const i = Math.max(0, v.turns.indexOf(centre));
  const picked = v.turns.slice(Math.max(0, i - 1), i + 2);
  let t = 0;
  const intro = { start: t, end: (t += 3.5) };
  const lines = picked.map(turn => {
    const tokens = tokensOf(clipText(turn.text));
    const read = Math.min(10, Math.max(3.5, wordsIn(tokens.join(' ')) / 2.7 + 1));
    return { seq: turn.seq, speakerId: turn.speakerId, job: turn.objective, tokens, start: t, end: (t += read) };
  });
  const m = mindChange(v.turns);
  const meter = [m.A.start, m.A.end, m.B.start, m.B.end].every(x => x != null) ? { start: t, end: (t += 4.5) } : null;
  const art = artworkSvg(v.artist) ? { start: t, end: (t += 6) } : null;
  const outro = { start: t, end: (t += 3) };
  return { intro, lines, meter, art, outro, duration: t };
}

export const clipName = (v: ConversationView) => `crosstalk-${episodeLabel(v.episode).replace(/\W+/g, '').toLowerCase()}-clip`;

type HostArt = { photo: HTMLImageElement | null; rest: HTMLImageElement; talk: HTMLImageElement; blink: HTMLImageElement };
export type ClipAssets = { hosts: Record<SpeakerId, HostArt>; art: HTMLImageElement | null };

// The drawn portrait as a still picture: resting, mid-word (mouth open) and mid-blink.
const POSE_CSS = {
  rest: '.p-lid,.p-mouth,.p-smile{display:none}',
  talk: '.p-lid,.p-rest,.p-smile{display:none}.p-mouth{transform:scale(.95,1.1)}',
  blink: '.p-mouth,.p-smile{display:none}',
};
async function drawnPoses(name: string, role: string, seat: SpeakerId, home?: string) {
  const svg = renderToStaticMarkup(createElement(Portrait, { name, role, seat, home }))
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="312" height="356" ');
  const pose = (css: string) => loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/>/, `><style>${css}</style>`))}`);
  const [rest, talk, blink] = await Promise.all([pose(POSE_CSS.rest), pose(POSE_CSS.talk), pose(POSE_CSS.blink)]);
  return { rest, talk, blink };
}

/** Photos (when they're ready), the drawn hosts and Iris's art, loaded before recording. */
export async function loadClipAssets(v: ConversationView, photos: boolean): Promise<ClipAssets> {
  const host = async (id: SpeakerId): Promise<HostArt> => {
    const s = v.speakers[id];
    const role = hostSubtitle(s);
    const drawn = await drawnPoses(s.name, role, id, s.home);
    let photo: HTMLImageElement | null = null;
    if (photos) {
      try {
        const r = await fetch(`/api/portraits/${lookCode(hostTraits({ name: s.name, role, seat: id, home: s.home }))}.jpg`);
        if (r.status === 200 && (r.headers.get('content-type') ?? '').startsWith('image/')) photo = await loadImage(URL.createObjectURL(await r.blob()));
      } catch { /* the drawn host it is */ }
    }
    return { photo, ...drawn };
  };
  const svg = artworkSvg(v.artist);
  const [A, B, art] = await Promise.all([host('A'), host('B'), svg ? loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`).catch(() => null) : Promise.resolve(null)]);
  return { hosts: { A, B }, art };
}

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - (1 - x) ** 3);
const fade = (t: number, s: { start: number; end: number }, inn = 0.4, out = 0.35) =>
  Math.min(ease((t - s.start) / inn), ease((s.end - t) / out));
const seatColour = (id: SpeakerId) => (id === 'A' ? C.a : C.b);

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}

/** A host's picture in a rounded frame: their photo, or the drawn host talking and blinking. */
function drawHost(ctx: CanvasRenderingContext2D, a: HostArt, id: SpeakerId, x: number, y: number, w: number, h: number, t: number, talking: boolean) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 28); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, id === 'A' ? '#3a2a1c' : '#1f2c2a'); g.addColorStop(1, '#121111');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  // A gentle breath, and a slow push in while they talk.
  const s = 1.02 + Math.sin(t * 1.3 + (id === 'A' ? 0 : 2)) * 0.008 + (talking ? 0.02 : 0);
  if (a.photo) {
    const ir = a.photo.width / a.photo.height, fr = w / h;
    const dw = (ir > fr ? h * ir : w) * s, dh = (ir > fr ? h : w / ir) * s;
    ctx.drawImage(a.photo, x + (w - dw) / 2, y + (h - dh) * 0.35, dw, dh);
  } else {
    // Mouth moves with the words; a blink every few seconds.
    const blink = (t + (id === 'A' ? 0.7 : 2.1)) % 3.6 < 0.14;
    const open = talking && Math.sin(t * 17) + Math.sin(t * 9.3) > 0.2;
    const img = blink ? a.blink : open ? a.talk : a.rest;
    const dh = h * 0.96 * s, dw = dh * (312 / 356);
    ctx.drawImage(img, x + (w - dw) / 2, y + h - dh, dw, dh);
  }
  ctx.restore();
  ctx.lineWidth = talking ? 5 : 2; ctx.strokeStyle = talking ? seatColour(id) : C.line;
  roundRect(ctx, x, y, w, h, 28); ctx.stroke();
}

function drawHeader(ctx: CanvasRenderingContext2D, v: ConversationView, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = C.a; ctx.fillRect(48, 52, 12, 28);
  ctx.fillStyle = C.b; ctx.fillRect(64, 52, 12, 28);
  ctx.fillStyle = C.text; ctx.font = `700 26px ${UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText('CrossTalk', 90, 67);
  ctx.fillStyle = C.muted; ctx.font = `18px ${TAG}`; ctx.textAlign = 'right';
  ctx.fillText(episodeLabel(v.episode).toUpperCase(), CLIP_W - 48, 67);
  ctx.restore();
}

function centred(ctx: CanvasRenderingContext2D, lines: string[], y: number, gap: number) {
  ctx.textAlign = 'center';
  lines.forEach((l, i) => ctx.fillText(l, CLIP_W / 2, y + i * gap));
}

/** One frame of the clip at time `t` (seconds). */
export function drawFrame(ctx: CanvasRenderingContext2D, v: ConversationView, plan: ClipPlan, assets: ClipAssets, t: number) {
  const rtl = isRtl(v.language ?? 'en');
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textBaseline = 'alphabetic';
  // Studio dark, with a soft lamp that drifts.
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, CLIP_W, CLIP_H);
  const lamp = ctx.createRadialGradient(CLIP_W * (0.3 + Math.sin(t / 5) * 0.1), 260, 20, CLIP_W / 2, 400, 900);
  lamp.addColorStop(0, 'rgba(232,165,90,0.16)'); lamp.addColorStop(1, 'rgba(17,18,20,0)');
  ctx.fillStyle = lamp; ctx.fillRect(0, 0, CLIP_W, CLIP_H);
  drawHeader(ctx, v);

  // Opening: the question, and the two hosts sliding in.
  if (t < plan.intro.end) {
    const a = fade(t, plan.intro);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = C.cue; ctx.font = `18px ${TAG}`; ctx.textAlign = 'center';
    ctx.fillText('TWO AI HOSTS · ONE QUESTION', CLIP_W / 2, 200);
    ctx.fillStyle = C.text; ctx.font = `600 52px ${SAY}`;
    centred(ctx, wrap(ctx, v.topic, CLIP_W - 96, 5), 280, 64);
    const slide = 1 - ease((t - 0.3) / 0.9);
    for (const id of ['A', 'B'] as const) {
      const x = id === 'A' ? 60 - slide * 300 : 380 + slide * 300;
      drawHost(ctx, assets.hosts[id], id, x, 640, 280, 330, t, false);
      const s = v.speakers[id];
      ctx.fillStyle = seatColour(id); ctx.font = `700 28px ${UI}`; ctx.textAlign = 'center';
      ctx.fillText(s.name, x + 140, 1012);
      ctx.fillStyle = C.muted; ctx.font = `18px ${UI}`;
      const sub = [hostSubtitle(s), homeOf(s.home)?.country].filter(Boolean).join(' · ');
      wrap(ctx, sub, 270, 2).forEach((l, k) => ctx.fillText(l, x + 140, 1044 + k * 24));
    }
    ctx.restore();
    return;
  }

  // The key moment: whoever's speaking, big; captions lighting up word by word.
  const line = plan.lines.find(l => t >= l.start && t < l.end);
  if (line) {
    const a = fade(t, line, 0.3, 0.25);
    const s = v.speakers[line.speakerId];
    const other = line.speakerId === 'A' ? 'B' : 'A';
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = C.muted; ctx.font = `18px ${TAG}`; ctx.textAlign = 'center';
    wrap(ctx, v.topic.toUpperCase(), CLIP_W - 120, 2).forEach((l, k) => ctx.fillText(l, CLIP_W / 2, 128 + k * 24));
    drawHost(ctx, assets.hosts[line.speakerId], line.speakerId, 110, 190, 500, 560, t, true);
    // The listening host, small, on the right (clear of the name bar).
    drawHost(ctx, assets.hosts[other], other, 520, 600, 160, 180, t, false);
    // Name bar, and a voice meter that moves with the words.
    ctx.fillStyle = 'rgba(17,18,20,0.86)'; roundRect(ctx, 110, 690, 330, 78, 10); ctx.fill();
    ctx.fillStyle = seatColour(line.speakerId); ctx.fillRect(110, 690, 6, 78);
    ctx.textAlign = 'left'; ctx.direction = 'ltr';
    ctx.fillStyle = C.text; ctx.font = `700 28px ${UI}`; ctx.fillText(s.name, 132, 724);
    ctx.fillStyle = C.muted; ctx.font = `16px ${TAG}`; ctx.fillText(`TURN ${line.seq} · ${line.job.toUpperCase()}`, 132, 752);
    for (let k = 0; k < 5; k++) {
      const hgt = 8 + Math.abs(Math.sin(t * (7 + k) + k)) * 26;
      ctx.fillStyle = seatColour(line.speakerId); ctx.fillRect(400 + k * 9 - 40, 740 - hgt, 5, hgt);
    }
    ctx.direction = rtl ? 'rtl' : 'ltr';
    // Captions: the words said so far bright, the rest dim.
    const p = (t - line.start) / (line.end - line.start - 0.4);
    const lit = Math.ceil(Math.min(1, Math.max(0, p)) * line.tokens.length);
    const joiner = line.tokens.every(x => [...x].length === 1) && line.tokens.length > 6 ? '' : ' ';
    ctx.font = `600 40px ${SAY}`;
    const rows = wrap(ctx, line.tokens.join(joiner === '' ? '​' : ' '), CLIP_W - 112, 6).map(r => r.replace(/​/g, ''));
    let count = 0;
    const top = 880;
    rows.forEach((row, r) => {
      const toks = joiner === '' ? [...row] : row.split(' ');
      const width = ctx.measureText(toks.join(joiner)).width;
      let x = rtl ? (CLIP_W + width) / 2 : (CLIP_W - width) / 2;
      ctx.textAlign = rtl ? 'right' : 'left';
      for (const tok of toks) {
        const w = ctx.measureText(tok + joiner).width;
        ctx.fillStyle = count < lit ? C.text : 'rgba(236,232,225,0.32)';
        ctx.fillText(tok, x, top + r * 54);
        x += rtl ? -w : w;
        count++;
      }
    });
    ctx.restore();
    return;
  }

  // Where they landed: the mind-change meter, dots gliding from start to end.
  if (plan.meter && t < plan.meter.end) {
    const a = fade(t, plan.meter);
    const m = mindChange(v.turns);
    const p = ease((t - plan.meter.start - 0.5) / 2.2);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = C.cue; ctx.font = `18px ${TAG}`; ctx.textAlign = 'center';
    ctx.fillText('DID ANYONE CHANGE THEIR MIND?', CLIP_W / 2, 330);
    ctx.fillStyle = C.muted; ctx.fillText('NO · 0 ←  → 100 · YES', CLIP_W / 2, 372);
    (['A', 'B'] as const).forEach((id, k) => {
      const y = 470 + k * 200, start = m[id].start!, end = m[id].end!;
      ctx.fillStyle = seatColour(id); ctx.font = `700 30px ${UI}`; ctx.textAlign = 'left'; ctx.direction = 'ltr';
      ctx.fillText(v.speakers[id].name, 70, y);
      ctx.fillStyle = C.line; roundRect(ctx, 70, y + 30, CLIP_W - 140, 14, 7); ctx.fill();
      const px = (n: number) => 70 + (CLIP_W - 140) * (n / 100);
      const now = start + (end - start) * p;
      ctx.strokeStyle = seatColour(id); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(px(start), y + 37, 13, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = seatColour(id); ctx.beginPath(); ctx.arc(px(now), y + 37, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.text; ctx.font = `22px ${TAG}`;
      ctx.fillText(`${start}% → ${Math.round(now)}%`, 70, y + 96);
      if (p >= 1) {
        const moved = end - start;
        ctx.fillStyle = C.muted; ctx.font = `20px ${UI}`;
        ctx.fillText(moved === 0 ? 'held their ground' : `moved ${Math.abs(moved)} toward ${moved > 0 ? 'yes' : 'no'}`, 70, y + 130);
      }
    });
    ctx.restore();
    ctx.direction = rtl ? 'rtl' : 'ltr';
    return;
  }

  // Iris's art: her painting of the moment, slowly pushing in, with her title and the quote.
  if (plan.art && t < plan.art.end && assets.art && v.artist) {
    const a = fade(t, plan.art, 0.8, 0.4);
    const k = 1 + ease((t - plan.art.start) / (plan.art.end - plan.art.start)) * 0.06;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = C.iris; ctx.font = `18px ${TAG}`; ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText(`${ARTIST.name.toUpperCase()}, ${ARTIST.role.toUpperCase()} · FROM THE BOOTH`, CLIP_W / 2, 190);
    const w = CLIP_W - 80, h = w * 0.6;
    ctx.save(); roundRect(ctx, 40, 240, w, h, 18); ctx.clip();
    ctx.drawImage(assets.art, 40 - (w * (k - 1)) / 2, 240 - (h * (k - 1)) / 2, w * k, h * k);
    ctx.restore();
    ctx.fillStyle = C.text; ctx.font = `italic 600 40px ${SAY}`; ctx.direction = rtl ? 'rtl' : 'ltr';
    centred(ctx, wrap(ctx, `“${v.artist.artTitle}”`, CLIP_W - 100, 2), 680, 50);
    ctx.fillStyle = C.muted; ctx.font = `italic 30px ${SAY}`;
    centred(ctx, wrap(ctx, `“${v.artist.caption}”`, CLIP_W - 120, 4), 820, 42);
    ctx.restore();
    return;
  }

  // The end card.
  const a = fade(t, plan.outro, 0.4, 0.01);
  ctx.save(); ctx.globalAlpha = a; ctx.direction = 'ltr';
  ctx.fillStyle = C.a; ctx.fillRect(CLIP_W / 2 - 40, 470, 34, 76);
  ctx.fillStyle = C.b; ctx.fillRect(CLIP_W / 2 + 6, 470, 34, 76);
  ctx.fillStyle = C.text; ctx.font = `700 54px ${UI}`; ctx.textAlign = 'center';
  ctx.fillText('CrossTalk', CLIP_W / 2, 640);
  ctx.fillStyle = C.muted; ctx.font = `24px ${UI}`;
  centred(ctx, wrap(ctx, 'Two AI hosts, one question. Where do you stand?', CLIP_W - 140, 2), 700, 34);
  ctx.font = `16px ${TAG}`;
  centred(ctx, wrap(ctx, `${NOTICE} The hosts are invented AI characters.`, CLIP_W - 120, 4), 1120, 24);
  ctx.restore();
}

/** The best video format this browser can record. */
export function clipFormat(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const [mime, ext] of [['video/mp4;codecs=avc1.42E01E', 'mp4'], ['video/mp4;codecs=avc1', 'mp4'], ['video/mp4', 'mp4'], ['video/webm;codecs=vp9', 'webm'], ['video/webm;codecs=vp8', 'webm'], ['video/webm', 'webm']] as const) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  }
  return null;
}

/**
 * Records the clip in real time onto `canvas` (which can be on screen, as a live preview).
 * Resolves with the video. Keep the tab in front: browsers slow hidden tabs down.
 */
export async function recordClip(v: ConversationView, canvas: HTMLCanvasElement, opts: { photos: boolean; onProgress?: (sec: number, total: number) => void; signal?: AbortSignal }) {
  const format = clipFormat();
  if (!format || typeof canvas.captureStream !== 'function') throw new Error("This browser can't record video. Try Chrome, Edge or Safari on a computer or phone.");
  await Promise.all([`600 52px ${SAY}`, `italic 30px ${SAY}`, `700 28px ${UI}`, `18px ${TAG}`].map(f => document.fonts?.load(f).catch(() => {})));
  const plan = planClip(v);
  const assets = await loadClipAssets(v, opts.photos);
  canvas.width = CLIP_W; canvas.height = CLIP_H;
  const ctx = canvas.getContext('2d')!;
  drawFrame(ctx, v, plan, assets, 0);
  const stream = canvas.captureStream(CLIP_FPS);
  const rec = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: 2_500_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise<Blob>((resolve, reject) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: format.mime.split(';')[0] }));
    rec.onerror = () => reject(new Error('Recording failed. Try again.'));
  });
  rec.start(500);
  const t0 = performance.now();
  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (opts.signal?.aborted) { rec.stop(); reject(new Error('Stopped.')); return; }
      const t = (performance.now() - t0) / 1000;
      drawFrame(ctx, v, plan, assets, Math.min(t, plan.duration - 0.001));
      opts.onProgress?.(Math.min(t, plan.duration), plan.duration);
      if (t >= plan.duration) { resolve(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  stream.getTracks().forEach(tr => tr.stop());
  for (const h of Object.values(assets.hosts)) if (h.photo?.src.startsWith('blob:')) URL.revokeObjectURL(h.photo.src);
  return { blob: await done, ext: format.ext };
}
