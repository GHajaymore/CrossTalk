import type { Accents, VoicePrefs } from './BrowserSpeech';
import { betterVoicesTip, voiceQuality, voicesFor } from './BrowserSpeech';

const QUALITY_LABEL = { natural: '✦ Natural', good: 'Good', basic: 'Basic' } as const;

type Props = { names: { A: string; B: string }; voices: SpeechSynthesisVoice[]; prefs: VoicePrefs; update: (p: Partial<VoicePrefs>) => void; preview: (id: 'A' | 'B') => void; accents?: Accents };

/** Voice per host, with preview, plus speed. Choices are remembered on this device only. */
export function VoicePicker({ names, voices, prefs, update, preview, accents }: Props) {
  if (!('speechSynthesis' in window)) return <p className="hint">This browser can't speak aloud. You can still read every turn.</p>;
  if (!voices.length) return <p className="hint">Loading voices… Some browsers list them a moment after the page opens.</p>;
  const chosen = voicesFor(prefs, accents);
  const row = (id: 'A' | 'B') => (
    <div className="voice-row" key={id}>
      <h3><span><span className={`dot ${id}`} /> {names[id]}</span></h3>
      <select aria-label={`Voice for ${names[id]}`} value={chosen[id]?.name ?? ''} onChange={e => update({ [id]: e.target.value })}>
        {voices.map(v => <option key={v.name} value={v.name}>{v.name} · {QUALITY_LABEL[voiceQuality(v)]}</option>)}
      </select>
      <button className="btn sm ghost" onClick={() => preview(id)}>Preview</button>
      {chosen[id] && <span className={`tag vq ${voiceQuality(chosen[id]!)}`}>{QUALITY_LABEL[voiceQuality(chosen[id]!)]}</span>}
    </div>
  );
  return (
    <>
      {row('A')}{row('B')}
      {chosen.A?.name === chosen.B?.name && <p className="hint">Both hosts share one voice on this device, so one is pitched a little lower. Pick different voices if you can.</p>}
      <label className="fld"><span className="tag">Speed {prefs.rate.toFixed(1)}×</span>
        <input type="range" min="0.8" max="1.3" step="0.1" value={prefs.rate} onChange={e => update({ rate: Number(e.target.value) })} />
      </label>
      {voices.every(v => voiceQuality(v) !== 'natural') && <p className="hint voice-tip">✦ Want hosts that sound more like real people? {betterVoicesTip()}</p>}
      <p className="hint">Voices come from your device, so they sound different on each one. CrossTalk picks the most natural ones first.</p>
    </>
  );
}
