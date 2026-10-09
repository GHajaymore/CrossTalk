// A soft music bed for the social clip, composed on the device from plain tones (Web Audio): no
// samples, no library, nothing anyone else wrote, so it's free to post anywhere. Each episode gets
// its own key and chord loop from its id; the Temperature sets the pace (Calm drifts, Heated pulses).
// Gentle chimes mark the meter and Iris's art.

export type Mood = 'calm' | 'lively' | 'heated';
export type MusicPlan = { bpm: number; key: number; chords: number[][]; arp: boolean; pulse: boolean; chimes: number[]; duration: number };

// Four-chord loops, as semitones from the key's root (all in a gentle, open voicing).
const LOOPS = [
  [[0, 7, 16], [-5, 7, 14], [-3, 9, 12], [-7, 5, 12]], // I–V–vi–IV
  [[-3, 9, 12], [-7, 5, 12], [0, 7, 16], [-5, 7, 14]], // vi–IV–I–V
  [[0, 7, 15], [-4, 8, 15], [-9, 7, 15], [-2, 10, 14]], // i–VI–III–VII (minor)
  [[0, 7, 14, 16], [-7, 5, 12, 16], [-3, 9, 12, 16], [-5, 7, 11, 14]], // airy add-9s
];
const KEYS = [57, 60, 62, 55, 53]; // A3, C4, D4, G3, F3 (MIDI)

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The music for one clip: steady for the same episode, so making a clip again sounds the same. */
export function musicPlan(seed: string, mood: Mood, duration: number, chimes: number[] = []): MusicPlan {
  const h = hash(seed);
  const loop = LOOPS[h % LOOPS.length];
  const base = KEYS[(h >>> 4) % KEYS.length];
  const bpm = mood === 'calm' ? 72 : mood === 'heated' ? 108 : 90;
  return { bpm, key: base, chords: loop.map(c => c.map(n => base + n)), arp: mood !== 'calm', pulse: mood === 'heated', chimes, duration };
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Schedules the whole piece onto `out` from audio time `t0`. Returns a stop function. */
export function playMusic(ac: BaseAudioContext, plan: MusicPlan, out: AudioNode, t0 = ac.currentTime + 0.05) {
  const master = ac.createGain();
  master.gain.setValueAtTime(0, t0);
  master.gain.linearRampToValueAtTime(1.7, t0 + 2);
  master.gain.setValueAtTime(1.7, t0 + Math.max(2, plan.duration - 2.5));
  master.gain.linearRampToValueAtTime(0, t0 + plan.duration);
  // A little warmth: roll off the top so the tones sit back under the captions.
  const tone = ac.createBiquadFilter();
  tone.type = 'lowpass'; tone.frequency.value = 2400;
  master.connect(tone).connect(out);
  const nodes: OscillatorNode[] = [];
  const note = (midi: number, start: number, len: number, level: number, type: OscillatorType, attack = 0.02) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = hz(midi);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(level, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + len);
    o.connect(g).connect(master);
    o.start(start); o.stop(start + len + 0.05);
    nodes.push(o);
  };
  const beat = 60 / plan.bpm, bar = beat * 4;
  for (let b = 0, t = t0; t < t0 + plan.duration; b++, t += bar) {
    const chord = plan.chords[b % plan.chords.length];
    // Pad: the chord, held softly across the bar.
    chord.forEach((n, i) => note(n, t, bar * 1.05, 0.05 / (1 + i * 0.3), i ? 'sine' : 'triangle', 0.6));
    // Bass on the root, an octave down.
    note(chord[0] - 12, t, bar * 0.9, 0.07, 'sine', 0.05);
    // Lively and Heated: a light plucked arpeggio in eighths.
    if (plan.arp) for (let k = 0; k < 8; k++) note(chord[k % chord.length] + 12, t + k * beat / 2, beat * 0.9, 0.025, 'triangle');
    // Heated: a soft kick-like pulse on each beat.
    if (plan.pulse) for (let k = 0; k < 4; k++) note(plan.key - 24, t + k * beat, 0.25, 0.09, 'sine', 0.005);
  }
  // Chimes: two bright notes as a scene arrives.
  for (const c of plan.chimes) {
    note(plan.key + 24, t0 + c, 2.2, 0.05, 'sine', 0.005);
    note(plan.key + 31, t0 + c + 0.12, 2.0, 0.035, 'sine', 0.005);
  }
  return () => { for (const o of nodes) { try { o.stop(); } catch { /* already stopped */ } } master.disconnect(); };
}
