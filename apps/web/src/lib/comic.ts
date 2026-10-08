// The comic strip: the episode in 4 panels (opening, clash, the moment Iris drew, where they landed),
// drawn on the device as a 1080×1350 image. Free: no server, no requests.
import { ARTIST, episodeLabel, mindChange, NOTICE, SCOUT_NOTICE, type ConversationView, type SpeakerId, type Turn } from '@crosstalk/shared';
import { C, loadSketch, SAY, TAG, UI, wrap } from './poster';

const W = 1080, H = 1350, PAD = 48, GAP = 24;

/** Whole sentences up to ~200 characters: what fits in a speech bubble. */
const bubbleText = (t: string) => {
  const sentences = t.match(/[^.?!]+[.?!]+["'”’)]*(\s|$)/g) ?? [t];
  let out = '';
  for (const s of sentences) { if ((out + s).length > 200 && out) break; out += s; }
  out = out.trim() || t;
  return out.length > 220 ? `${out.slice(0, 217).replace(/\s+\S*$/, '')}…` : out;
};

/** The four beats of an episode. */
export function comicBeats(v: ConversationView) {
  const turns = v.turns;
  const opening = turns[0];
  // The clash: the turn that answered a listener's challenge or guest, else the first push-back.
  const moment = v.artist?.state === 'done' ? turns.find(t => t.seq === v.artist!.momentSeq) ?? null : null;
  // Never the same turn as Iris's panel, and preferably the other host from the opening, so the strip moves.
  const cue = v.interventions.find(c => c.status === 'applied' && (c.kind === 'challenge' || c.kind === 'guest'));
  const fresh = (t: Turn | undefined) => !!t && t.seq !== opening?.seq && t.seq !== moment?.seq;
  const CLASH_JOBS = new Set(['Push back', 'Catch', 'Test', 'Rethink', 'Curveball', 'Pressure test']);
  const candidates = [cue && turns.find(t => t.seq === cue.appliesBeforeSeq), ...turns.filter(t => CLASH_JOBS.has(t.objective))].filter(fresh) as Turn[];
  const clash = candidates.find(t => t.speakerId !== opening?.speakerId) ?? candidates[0] ?? turns.find(fresh);
  // The last word, unless it's already in a panel; then the latest line that isn't.
  const used = new Set([opening?.seq, clash?.seq, moment?.seq]);
  const landing = [...turns].reverse().find(t => !used.has(t.seq));
  return { opening, clash, moment, landing };
}

export async function makeComic(v: ConversationView): Promise<Blob> {
  // Load the exact faces drawn below, so text is measured and wrapped with the real font.
  await Promise.all([`600 34px ${SAY}`, `28px ${SAY}`, `italic 24px ${SAY}`, `600 24px ${UI}`, `18px ${UI}`, `18px ${TAG}`, `600 16px ${TAG}`, `600 22px ${TAG}`]
    .map(f => document.fonts?.load(f).catch(() => {})));
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.textBaseline = 'top';
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

  // Title band
  ctx.fillStyle = C.a; ctx.fillRect(PAD, PAD, 14, 30);
  ctx.fillStyle = C.b; ctx.fillRect(PAD + 18, PAD, 14, 30);
  ctx.fillStyle = C.muted; ctx.font = `18px ${TAG}`;
  ctx.fillText(`CROSSTALK · ${episodeLabel(v.episode).toUpperCase()} · THE EPISODE IN 4 PANELS`, PAD + 46, PAD + 6);
  ctx.fillStyle = C.text; ctx.font = `600 34px ${SAY}`;
  let y = PAD + 50;
  for (const l of wrap(ctx, v.topic, W - PAD * 2, 2)) { ctx.fillText(l, PAD, y); y += 42; }
  y += 14;

  const top = y, footer = 52;
  const pw = (W - PAD * 2 - GAP) / 2, ph = (H - top - PAD - footer - GAP) / 2;
  const at = (i: number) => ({ x: PAD + (i % 2) * (pw + GAP), y: top + Math.floor(i / 2) * (ph + GAP) });
  const { opening, clash, moment, landing } = comicBeats(v);

  const frame = (i: number, label: string) => {
    const { x, y } = at(i);
    ctx.fillStyle = C.surface; ctx.strokeStyle = C.line; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x, y, pw, ph, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.cue; ctx.font = `600 16px ${TAG}`; ctx.fillText(`${i + 1} · ${label.toUpperCase()}`, x + 20, y + 18);
    return { x, y };
  };

  /** A host speaking: their seat letter in a coloured badge, their name, and a speech bubble. */
  const speak = (i: number, label: string, t: Turn | undefined) => {
    const { x, y } = frame(i, label);
    if (!t) return;
    const k: SpeakerId = t.speakerId, col = k === 'A' ? C.a : C.b;
    const sx = k === 'A' ? x + 20 : x + pw - 20 - 44, sy = y + ph - 72;
    // The bubble fits its words and sits just above the speaker, its tail pointing at them.
    ctx.font = `28px ${SAY}`;
    const lines = wrap(ctx, `“${bubbleText(t.text)}”`, pw - 80, 8);
    const bh = lines.length * 37 + 40;
    const by = Math.max(y + 56, sy - 30 - bh);
    ctx.fillStyle = C.bg; ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x + 20, by, pw - 40, bh, 18); ctx.fill(); ctx.stroke();
    const tx = k === 'A' ? x + 42 : x + pw - 42;
    ctx.beginPath(); ctx.moveTo(tx - 12, by + bh - 1); ctx.lineTo(tx, by + bh + 20); ctx.lineTo(tx + 12, by + bh - 1); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.bg; ctx.fillRect(tx - 11, by + bh - 4, 22, 5);
    ctx.fillStyle = C.text;
    let ly = by + 20;
    for (const l of lines) { ctx.fillText(l, x + 40, ly); ly += 37; }
    ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(sx, sy, 44, 44, 10); ctx.fill();
    ctx.fillStyle = '#141517'; ctx.font = `600 22px ${TAG}`; ctx.fillText(k, sx + 15, sy + 11);
    ctx.fillStyle = C.text; ctx.font = `600 24px ${UI}`;
    const name = wrap(ctx, `${v.speakers[k].name} · turn ${t.seq}`, pw - 110, 1)[0] ?? '';
    const nw = ctx.measureText(name).width;
    ctx.fillText(name, k === 'A' ? sx + 58 : sx - 14 - nw, sy + 10);
  };

  speak(0, 'The opening', opening);
  speak(1, 'The clash', clash);

  // Panel 3: the moment Iris drew, in her own hand
  {
    const { x, y } = frame(2, `The moment · ${ARTIST.name} drew it`);
    const art = v.artist?.state === 'done' ? v.artist : null;
    const boxY = y + 52, boxH = ph - 52 - 116;
    ctx.fillStyle = '#0e0d0c'; ctx.beginPath(); ctx.roundRect(x + 20, boxY, pw - 40, boxH, 10); ctx.fill();
    if (art?.sketchSvg) {
      try {
        const { img, vw, vh } = await loadSketch(art.sketchSvg);
        const sc = Math.min((pw - 60) / vw, (boxH - 20) / vh);
        ctx.drawImage(img, x + (pw - vw * sc) / 2, boxY + (boxH - vh * sc) / 2, vw * sc, vh * sc);
      } catch { /* empty frame */ }
    }
    ctx.fillStyle = C.iris; ctx.font = `italic 24px ${SAY}`;
    let ly = boxY + boxH + 14;
    const quote = art ? `“${art.caption}”` : moment ? `“${bubbleText(moment.text)}”`
      : v.artist?.state === 'failed' ? `${ARTIST.name} didn't draw this one.` : `${ARTIST.name} is still drawing.`;
    for (const l of wrap(ctx, quote, pw - 40, 2)) { ctx.fillText(l, x + 20, ly); ly += 30; }
    if (art) { ctx.fillStyle = C.muted; ctx.font = `16px ${TAG}`; ctx.fillText(`“${art.artTitle.toUpperCase()}” · TURN ${art.momentSeq}`, x + 20, ly + 4, pw - 40); }
  }

  // Panel 4: where they landed (the Mind-change meter), else the last word
  {
    const m = mindChange(v.turns);
    if (m.A.start == null && m.B.start == null) speak(3, 'The last word', landing);
    else {
      const { x, y } = frame(3, 'Where they landed');
      (['A', 'B'] as const).forEach((k, j) => {
        const r = m[k], col = k === 'A' ? C.a : C.b, ry = y + 70 + j * ((ph - 90) / 2);
        ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x + 20, ry, 40, 40, 9); ctx.fill();
        ctx.fillStyle = '#141517'; ctx.font = `600 20px ${TAG}`; ctx.fillText(k, x + 33, ry + 10);
        ctx.fillStyle = C.text; ctx.font = `600 24px ${UI}`; ctx.fillText(v.speakers[k].name, x + 74, ry + 8, pw - 100);
        // the meter: 0 no … 100 yes, start ring and end dot
        const tx = x + 20, tw = pw - 40, tyy = ry + 72;
        ctx.fillStyle = C.bg; ctx.beginPath(); ctx.roundRect(tx, tyy, tw, 12, 6); ctx.fill();
        const px = (n: number) => tx + (n / 100) * tw;
        if (r.start != null) {
          if (r.end != null) { ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px(r.start), tyy + 6); ctx.lineTo(px(r.end), tyy + 6); ctx.stroke(); }
          ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.fillStyle = C.surface; ctx.beginPath(); ctx.arc(px(r.start), tyy + 6, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          if (r.end != null) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px(r.end), tyy + 6, 9, 0, Math.PI * 2); ctx.fill(); }
          ctx.fillStyle = C.muted; ctx.font = `18px ${TAG}`;
          ctx.fillText(r.end != null ? `${r.start}% → ${r.end}% on yes` : `${r.start}% on yes`, tx, tyy + 26);
        }
      });
      ctx.fillStyle = C.muted; ctx.font = `14px ${TAG}`; ctx.fillText('NO · 0', x + 20, y + ph - 30); ctx.fillText('100 · YES', x + pw - 100, y + ph - 30);
    }
  }

  ctx.fillStyle = C.muted; ctx.font = `18px ${UI}`;
  ctx.fillText(v.brief ? SCOUT_NOTICE : NOTICE, PAD, H - PAD - 22, W - PAD * 2);
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Couldn't draw the comic."))), 'image/png'));
}

export const comicName = (v: ConversationView) => `crosstalk-ep${String(v.episode).padStart(2, '0')}-comic.png`;
