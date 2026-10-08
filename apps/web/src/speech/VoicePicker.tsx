import type { Speakers } from '@crosstalk/shared';
import type { VoicePrefs } from './BrowserSpeech';
import { voicesFor } from './BrowserSpeech';

type Props = { speakers: Speakers; voices: SpeechSynthesisVoice[]; prefs: VoicePrefs; update: (p: Partial<VoicePrefs>) => void; preview: (id: 'A' | 'B') => void };

/** Voice per host, with preview, plus speed. Choices are remembered on this device only. */
export function VoicePicker({ speakers, voices, prefs, update, preview }: Props) {
  if (!('speechSynthesis' in window)) return <p className="hint">This browser can't speak aloud. You can still read every turn.</p>;
  if (!voices.length) return <p className="hint">Loading voices… Some browsers list them a moment after the page opens.</p>;
  const chosen = voicesFor(prefs);
  const row = (id: 'A' | 'B') => (
    <div className="voice-row" key={id}>
      <h3><span><span className={`dot ${id}`} /> {speakers[id].name}</span></h3>
      <select aria-label={`Voice for ${speakers[id].name}`} value={chosen[id]?.name ?? ''} onChange={e => update({ [id]: e.target.value })}>
        {voices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
      </select>
      <button className="btn sm ghost" onClick={() => preview(id)}>Preview</button>
    </div>
  );
  return (
    <>
      {row('A')}{row('B')}
      {chosen.A?.name === chosen.B?.name && <p className="hint">Both hosts share one voice on this device, so one is pitched a little lower. Pick different voices if you can.</p>}
      <label className="fld"><span className="tag">Speed {prefs.rate.toFixed(1)}×</span>
        <input type="range" min="0.8" max="1.3" step="0.1" value={prefs.rate} onChange={e => update({ rate: Number(e.target.value) })} />
      </label>
      <p className="hint">Voices come from your device, so they sound different on each one. The most natural ones (named Natural, Neural or Premium) are picked first; Microsoft Edge has some of the best free ones. Studio voices come later.</p>
    </>
  );
}
