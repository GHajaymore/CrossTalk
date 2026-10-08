// Renders a CrossTalk episode to MP3 with Kokoro, a free open-source voice model (Apache-2.0).
// Usage: node render.mjs <episode.json> [out.mp3]
//   episode.json is what GET /api/conversations/<id> returns.
// Writes out.mp3 and out.json (when each turn starts and ends, for captions and highlighting).
// Voices: KOKORO_VOICE_A / KOKORO_VOICE_B (defaults below). The model downloads once from Hugging Face.
import { readFileSync, writeFileSync } from 'node:fs';
import { KokoroTTS } from 'kokoro-js';
import { Mp3Encoder } from '@breezystack/lamejs';

const [input, outArg] = process.argv.slice(2);
if (!input) { console.error('Usage: node render.mjs <episode.json> [out.mp3]'); process.exit(1); }
const out = outArg ?? input.replace(/\.json$/, '') + '.mp3';
const ep = JSON.parse(readFileSync(input, 'utf8'));
const turns = ep.turns.filter(t => t.status === 'completed').sort((a, b) => a.seq - b.seq);
if (!turns.length) { console.error('This episode has no saved turns.'); process.exit(1); }

const VOICES = { A: process.env.KOKORO_VOICE_A || 'am_michael', B: process.env.KOKORO_VOICE_B || 'af_heart' };
console.log(`Loading Kokoro (first run downloads the model)… voices: A=${VOICES.A}, B=${VOICES.B}`);
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });

// Spoken text: no markdown emphasis; dashes become short pauses.
const speakable = t => t.replace(/\*/g, '').replace(/\s+—\s+|\s+–\s+/g, ', ').trim();

const parts = [];
const timings = [];
let rate = 24000;
let at = 0;
const silence = sec => new Float32Array(Math.round(sec * rate));
parts.push(silence(0.4)); at += 0.4;

for (const t of turns) {
  const started = Date.now();
  const audio = await tts.generate(speakable(t.text), { voice: VOICES[t.speakerId] });
  rate = audio.sampling_rate;
  const samples = audio.audio;
  timings.push({ seq: t.seq, speakerId: t.speakerId, start: +at.toFixed(3), end: +(at + samples.length / rate).toFixed(3) });
  parts.push(samples); at += samples.length / rate;
  // A natural, slightly uneven gap between speakers.
  const gap = 0.28 + Math.random() * 0.25;
  parts.push(silence(gap)); at += gap;
  console.log(`turn ${t.seq} (${t.speakerId}) ${(samples.length / rate).toFixed(1)}s in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

// Float32 → 16-bit PCM → MP3 (mono, 64 kbps: small enough to share, clear enough for speech).
const total = parts.reduce((n, p) => n + p.length, 0);
const pcm = new Int16Array(total);
let o = 0;
for (const p of parts) for (let i = 0; i < p.length; i++) pcm[o++] = Math.max(-1, Math.min(1, p[i])) * 0x7fff;
const enc = new Mp3Encoder(1, rate, 64);
const chunks = [];
for (let i = 0; i < pcm.length; i += 1152) { const b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (b.length) chunks.push(Buffer.from(b)); }
const tail = enc.flush(); if (tail.length) chunks.push(Buffer.from(tail));
writeFileSync(out, Buffer.concat(chunks));
writeFileSync(out.replace(/\.mp3$/, '.json'), JSON.stringify({ voices: VOICES, durationSec: +at.toFixed(2), timings }, null, 2));
console.log(`Wrote ${out} (${(at / 60).toFixed(1)} min) and ${out.replace(/\.mp3$/, '.json')}`);
