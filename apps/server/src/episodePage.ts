// The episode page: one self-contained HTML file to keep or send. Iris's art, the whole conversation,
// the mind-change meter, and a Play button that reads it aloud with the reader's own device voices.
// No network at all (a strict Content-Security-Policy says so), and every piece of text is escaped.
import {
  ARTIST, artworkSvg, AUDIENCES, episodeLabel, mindChange, MODES, NOTICE, PAINT_STYLE_INFO, paintStyleOf, SCOUT_NOTICE,
  TEMPERATURES, VERDICTS, type ConversationView,
} from '@crosstalk/shared';

const esc = (s: string | null | undefined) => (s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
/** JSON that is safe inside a <script> block: nothing in it can close the tag or start markup. */
const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const httpUrl = (u: string) => /^https?:\/\//i.test(u) ? u : null;

// Listener cues, where they landed. Producer notes are private instructions to the hosts, so they stay out.
const CUE: Record<string, (x: ConversationView['interventions'][number]) => string> = {
  challenge: x => `<b>Listener's challenge</b> ${esc(x.text)}`,
  guest: x => `<b>Guest on the mic</b> “${esc(x.text)}”`,
  deeper: x => `<b>Listener</b> asked them to go deeper on turn ${x.targetSeq}`,
  temp: x => `<b>Listener</b> changed the mood: ${esc(x.fromTemp && TEMPERATURES[x.fromTemp].label)} → ${esc(x.toTemp && TEMPERATURES[x.toTemp].label)}`,
};

export function exportHtml(c: ConversationView): string {
  const sp = c.speakers;
  const art = c.artist?.state === 'done' ? c.artist : null;
  const artSvg = artworkSvg(art);
  const style = PAINT_STYLE_INFO[paintStyleOf(art?.artStyle)].name;
  const mc = mindChange(c.turns);
  const notice = c.brief ? SCOUT_NOTICE : NOTICE;
  const tags = [episodeLabel(c.episode), ...(c.round > 1 ? [`Round ${c.round}`] : []), MODES[c.mode].label, AUDIENCES[c.audience].label, TEMPERATURES[c.temperature].label].map(esc).join(' · ');

  const host = (k: 'A' | 'B') => `<span class="host"><span class="flag ${k}" aria-hidden="true">${k}</span><b>${esc(sp[k].name)}</b>${sp[k].role ? ` <span class="muted">${esc(sp[k].role)}</span>` : ''}</span>`;

  type Row = { flag: 'A' | 'B' | 'Y'; name: string; s: number; e: number | null };
  const rows: Row[] = [
    ...(['A', 'B'] as const).filter(k => mc[k].start != null).map(k => ({ flag: k, name: sp[k].name, s: mc[k].start!, e: mc[k].end })),
    ...(c.youStart != null ? [{ flag: 'Y' as const, name: 'You', s: c.youStart, e: c.youEnd }] : []),
  ];
  const meter = rows.map(({ flag: k, name, s, e }) => {
    const moved = e == null ? '' : e === s ? 'held steady' : `moved ${Math.abs(e - s)} toward ${e > s ? 'yes' : 'no'}`;
    return `<div class="mrow"><span class="flag ${k}" aria-hidden="true">${k}</span><b>${esc(name)}</b>
      <div class="track" role="img" aria-label="${esc(name)}: ${s}% on yes at the start${e != null ? `, ${e}% at the end` : ''}">
        <i class="dot start ${k}" style="left:${s}%"></i>${e != null ? `<i class="dot end ${k}" style="left:${e}%"></i>` : ''}</div>
      <span class="muted">${s}%${e != null ? ` → ${e}% · ${moved}` : ''}</span></div>`;
  }).join('');

  const turns = c.turns.map(t => {
    const cues = c.interventions.filter(x => x.status === 'applied' && x.appliesBeforeSeq === t.seq && CUE[x.kind])
      .map(x => `<p class="cue">${CUE[x.kind](x)}</p>`).join('');
    const drawn = art && art.momentSeq === t.seq ? ` <span class="drawn">✎ ${esc(ARTIST.name)} drew this</span>` : '';
    return `${cues}<article class="turn ${t.speakerId}" id="t${t.seq}" data-seq="${t.seq}">
      <header><span class="flag ${t.speakerId}" aria-hidden="true">${t.speakerId}</span><b>${esc(sp[t.speakerId].name)}</b>
      <span class="tag">Turn ${t.seq} · ${esc(t.objective)}</span>${drawn}</header>
      <p>${esc(t.text)}</p></article>${c.branchSeq === t.seq ? `<p class="cue">✂ The branch starts here: “${esc(c.branchDirection)}”</p>` : ''}`;
  }).join('\n');

  const sources = c.brief ? [...new Map(c.brief.bullets.map(b => [b.url, b])).values()].map(b => {
    const u = httpUrl(b.url);
    return `<li>${esc(b.text)} <span class="muted">· ${u ? `<a href="${esc(u)}" rel="noopener noreferrer">${esc(b.source)}</a>` : esc(b.source)}</span></li>`;
  }).join('') : '';

  // What the Play button reads: just the words, in order.
  const script = scriptJson({ turns: c.turns.map(t => ({ seq: t.seq, who: t.speakerId, text: t.text })) });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<meta name="referrer" content="no-referrer">
<title>${esc(c.topic)} · CrossTalk</title>
<style>
:root{color-scheme:dark;--bg:#111214;--surface:#1A1C1F;--raised:#22252A;--line:#2E3238;--text:#ECE8E1;--muted:#A39E96;--a:#E8A55A;--b:#5FB8B0;--cue:#E9D36A;--iris:#B9A4E6;
--say:"Source Serif 4",Georgia,"Times New Roman",serif;--ui:"Schibsted Grotesk","Segoe UI",system-ui,sans-serif;--tag:"JetBrains Mono",ui-monospace,Menlo,monospace}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 var(--ui)}
main{max-width:760px;margin:0 auto;padding:28px 16px 64px}
.tag{font:11.5px var(--tag);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}.muted{color:var(--muted)}
.brand{display:flex;align-items:center;gap:8px;font-weight:700}.mark{display:flex;gap:3px}.mark i{width:8px;height:16px;border-radius:2px;background:var(--a)}.mark i+i{background:var(--b)}
h1{font:600 clamp(28px,6vw,40px)/1.15 var(--say);margin:10px 0 12px;text-wrap:balance}
h2{font:600 20px var(--say);margin:36px 0 12px}
.hosts{display:flex;flex-wrap:wrap;gap:8px 18px}.host{display:inline-flex;gap:7px;align-items:center}
.flag{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:5px;font:600 12px var(--tag);color:#111;flex:none}.flag.A{background:var(--a)}.flag.B{background:var(--b)}.flag.C{background:var(--iris)}
figure{margin:24px 0 0;background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden}
figure img{display:block;width:100%;height:auto;background:#0e0d0c}
figcaption{padding:12px 16px;display:grid;gap:2px}.art-title{font:italic 600 18px var(--say);color:var(--iris)}
.player{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:22px -16px 0;padding:10px 16px;background:rgba(17,18,20,.95);border-bottom:1px solid var(--line)}
button{font:inherit;color:var(--text);background:var(--raised);border:1px solid var(--line);border-radius:8px;padding:8px 14px;cursor:pointer}
button.play{background:var(--text);color:#111;font-weight:600}button[aria-pressed=true]{border-color:var(--cue)}
button:focus-visible,a:focus-visible{outline:2px solid var(--cue);outline-offset:2px}
.now{flex:1;min-width:140px;font-size:13px;color:var(--muted)}
.meter{display:grid;gap:10px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.mrow{display:grid;grid-template-columns:auto auto 1fr;gap:4px 10px;align-items:center}.mrow .muted{grid-column:1/-1;font-size:13px}
.track{position:relative;height:8px;border-radius:4px;background:linear-gradient(90deg,#3a2e2e,#2e3a39)}
.dot{position:absolute;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:2px solid var(--bg)}.dot.start{background:transparent;border:2px solid var(--muted)}.dot.end.A{background:var(--a)}.dot.end.B{background:var(--b)}.dot.end.Y{background:var(--cue)}.flag.Y{background:var(--cue)}
.scale{display:flex;justify-content:space-between;font:11px var(--tag);color:var(--muted)}
.turns{display:grid;gap:12px;margin-top:8px}
.turn{border:1px solid var(--line);border-radius:12px;padding:12px 14px;max-width:88%}
.turn.A{background:rgba(232,165,90,.08);border-left:3px solid var(--a)}.turn.B{background:rgba(95,184,176,.08);border-right:3px solid var(--b);justify-self:end}
.turn header{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center}.turn p{margin:8px 0 0;font:17px/1.55 var(--say)}
.turn.speaking{outline:2px solid var(--cue);outline-offset:2px}
.drawn{font-size:12px;color:var(--iris)}
.cue{justify-self:center;max-width:88%;margin:0;padding:8px 12px;border:1px dashed rgba(233,211,106,.5);border-radius:10px;background:rgba(233,211,106,.06);font-size:14px;text-align:center}
.cue b{color:var(--cue);margin-right:4px}
.iris{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px}.iris p{font:17px/1.55 var(--say);margin:10px 0 0}
blockquote{margin:12px 0 0;padding-left:12px;border-left:2px solid var(--iris);font:italic 17px var(--say)}
.verdict{border:1px solid var(--cue);border-radius:12px;padding:12px 16px}
ul{padding-left:20px}li{margin:6px 0}a{color:var(--cue)}
footer{margin-top:44px;padding-top:14px;border-top:1px solid var(--line);font-size:13px;color:var(--muted);display:grid;gap:4px}
@media (max-width:560px){.turn,.cue{max-width:100%}}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style>
</head>
<body>
<main>
<div class="brand"><span class="mark" aria-hidden="true"><i></i><i></i></span>CrossTalk</div>
<p class="tag" style="margin:18px 0 0">${tags}</p>
<h1>${esc(c.topic)}</h1>
<div class="hosts">${host('A')}${host('B')}</div>
${c.parentId ? `<p class="muted">✂ A branch of “${esc(c.parent?.title ?? '')}” from turn ${c.branchSeq}: “${esc(c.branchDirection)}”</p>` : ''}
${art && artSvg ? `<figure><img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(artSvg)}" alt="${esc(`${ARTIST.name}'s ${style.toLowerCase()}: ${art.artTitle}`)}">
<figcaption><span class="art-title">“${esc(art.artTitle)}”</span><span class="tag">${esc(ARTIST.name)} · ${esc(style.toLowerCase())} of turn ${art.momentSeq}</span></figcaption></figure>` : ''}

<div class="player" id="player" hidden>
  <button class="play" id="play" type="button">▶ Play</button>
  <button id="stop" type="button" hidden>Stop</button>
  <span class="now" id="now" aria-live="polite">Reads the episode aloud with this device's voices.</span>
  <span role="group" aria-label="Speed"><button type="button" data-rate="1" aria-pressed="true">1×</button> <button type="button" data-rate="1.25" aria-pressed="false">1.25×</button></span>
</div>

${meter ? `<h2>Mind-change meter</h2><div class="meter"><div class="scale" aria-hidden="true"><span>No · 0</span><span>100 · Yes</span></div>${meter}<p class="muted" style="margin:0;font-size:13px">Hollow dot: where they started. Filled dot: where they ended.</p></div>` : ''}

<h2>The conversation</h2>
<div class="turns">
${turns}
</div>

${c.verdict ? `<h2>Who moved you?</h2><p class="verdict">${esc(VERDICTS[c.verdict])}</p>` : ''}
${art ? `<h2>From the booth</h2><div class="iris"><div class="host"><span class="flag C" aria-hidden="true">I</span><b>${esc(ARTIST.name)}, ${esc(ARTIST.role)}</b></div>
<p>${esc(art.perspective)}</p><blockquote>“${esc(art.caption)}”</blockquote></div>` : ''}
${sources ? `<h2>Today's brief</h2><ul>${sources}</ul>` : ''}

<footer><span>${esc(notice)}</span><span>Made with CrossTalk · two AI hosts and ${esc(ARTIST.name)}, the listener in the booth. This page works offline and sends nothing anywhere.</span></footer>
</main>
<script type="application/json" id="episode">${script}</script>
<script>
(function () {
  var synth = window.speechSynthesis;
  if (!synth || !window.SpeechSynthesisUtterance) return;
  var data = JSON.parse(document.getElementById('episode').textContent);
  var player = document.getElementById('player'), play = document.getElementById('play'), stop = document.getElementById('stop'), now = document.getElementById('now');
  player.hidden = false;
  var rate = 1, i = 0, playing = false, voices = [], gen = 0;
  function pickVoices() {
    var en = synth.getVoices().filter(function (v) { return /^en/i.test(v.lang); });
    voices = en.length ? [en[0], en[1] || en[0]] : [];
  }
  pickVoices();
  if ('onvoiceschanged' in synth) synth.onvoiceschanged = pickVoices;
  function mark(seq) {
    var el = document.querySelectorAll('.turn');
    for (var k = 0; k < el.length; k++) el[k].classList.toggle('speaking', el[k].getAttribute('data-seq') === String(seq));
    var t = document.getElementById('t' + seq);
    if (t) t.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  function next() {
    if (!playing) return;
    if (i >= data.turns.length) { end('Finished. Press Play to hear it again.'); i = 0; return; }
    var t = data.turns[i];
    var u = new SpeechSynthesisUtterance(t.text);
    if (voices.length) u.voice = voices[t.who === 'A' ? 0 : 1];
    u.rate = rate; u.pitch = t.who === 'A' ? 1 : 0.92;
    // Only the latest run may move on: stopping cancels speech, which also fires these.
    var g = gen;
    u.onend = function () { if (g === gen) { i++; next(); } };
    u.onerror = function (e) {
      if (g !== gen || e.error === 'interrupted' || e.error === 'canceled') return;
      end("This browser couldn't read it aloud. Try another browser, or read along below.");
    };
    now.textContent = 'Turn ' + t.seq + ' of ' + data.turns.length;
    mark(t.seq);
    synth.speak(u);
  }
  function end(msg) { playing = false; gen++; synth.cancel(); play.textContent = '▶ Play'; stop.hidden = true; now.textContent = msg; mark(-1); }
  play.onclick = function () {
    if (playing && !synth.paused) { synth.pause(); play.textContent = '▶ Resume'; return; }
    if (playing && synth.paused) { synth.resume(); play.textContent = '❚❚ Pause'; return; }
    playing = true; play.textContent = '❚❚ Pause'; stop.hidden = false; next();
  };
  stop.onclick = function () { i = 0; end('Stopped.'); };
  var rb = document.querySelectorAll('[data-rate]');
  for (var k = 0; k < rb.length; k++) rb[k].onclick = function (e) {
    rate = Number(e.currentTarget.getAttribute('data-rate'));
    for (var j = 0; j < rb.length; j++) rb[j].setAttribute('aria-pressed', String(rb[j] === e.currentTarget));
  };
})();
</script>
</body>
</html>
`;
}
