import { useEffect, useState } from 'react';
import { photoThemesFor } from '@crosstalk/shared';
import { printSizeLine } from '../lib/printSize';

/**
 * Photo of the day: today's ideas from Iris's camera (one of each kind, new every day), or your own
 * words. Made by the free AI image service, up to 10 a day; the ones you love can be kept in My photos.
 */
export function PhotoOfTheDay({ onKept }: { onKept?: () => void }) {
  const [themes] = useState(() => photoThemesFor(new Date()));
  const [picked, setPicked] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState<{ url: string; name: string; title: string; token: string | null; kept: 'no' | 'saving' | 'yes' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<{ left: number; perDay: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    fetch('/api/images/try').then(r => (r.ok ? r.json() : null)).then(setLeft).catch(() => {});
  }, []);
  // Let go of a photo only when a new one replaces it (or the page closes), not when it's kept.
  const url = img?.url;
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const pick = (title: string, text: string) => { setPicked(title); setPrompt(text); };
  const go = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch('/api/images/try', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? `It didn't work (${r.status}).`);
      const n = Number(r.headers.get('X-Tries-Left'));
      if (Number.isFinite(n) && left) setLeft({ ...left, left: n });
      const title = picked && themes.find(t => t.title === picked)?.prompt === prompt ? picked : titleOf(prompt);
      const name = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      setImg({ url: URL.createObjectURL(await r.blob()), name: `crosstalk-${name || 'photo'}.jpg`, title, token: r.headers.get('X-Photo-Token'), kept: 'no' });
    } catch (e) {
      setError((e as Error).message);
      fetch('/api/images/try').then(x => (x.ok ? x.json() : null)).then(setLeft).catch(() => {});
    } finally { setBusy(false); }
  };
  const keep = async () => {
    if (!img?.token) return;
    setImg({ ...img, kept: 'saving' });
    try {
      const r = await fetch('/api/photos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: img.token, title: img.title }) });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? `It didn't work (${r.status}).`);
      setImg(i => (i ? { ...i, kept: 'yes' } : i));
      onKept?.();
    } catch (e) { setImg(i => (i ? { ...i, kept: 'no' } : i)); setError((e as Error).message); }
  };
  const none = left?.left === 0;

  return (
    <div className="potd">
      <p className="hint">Today's ideas from Iris's camera: one of each kind, new every day. Pick one and make it as it is, change the words, or describe your own.</p>
      <div className="potd-ideas" role="group" aria-label="Today's photo ideas">
        {themes.map(t => (
          <button key={t.title} className="chip potd-idea" aria-pressed={picked === t.title} onClick={() => pick(t.title, t.prompt)}>
            <span className="tag">{t.kind}</span>{t.title}
          </button>
        ))}
      </div>
      <label className="tag" htmlFor="potd-prompt">{picked ? 'The brief (change any words)' : 'Your own picture'}</label>
      <textarea id="potd-prompt" maxLength={400} value={prompt} placeholder="Describe a photo in your own words: the subject, the place, the light. For example: a red kayak on a still lake at sunrise, mist, 35mm"
        onChange={e => { setPrompt(e.target.value); if (picked && themes.find(t => t.title === picked)?.prompt !== e.target.value) setPicked(null); }} />
      <div className="dock-row">
        <button className="btn sm primary" disabled={busy || none || prompt.trim().length < 3} onClick={go}>{busy ? 'Making it… (up to a minute)' : '📷 Make the photo'}</button>
        <span className="hint">{left ? `${left.left} of ${left.perDay} left today` : 'Up to 10 a day'} · {onKept ? 'keep the ones you love in My photos' : 'not kept, so download the ones you love'} · invented adults only, no text, no real people.</span>
      </div>
      {error && <p className="hint" role="alert">✕ {error}</p>}
      {img && (
        <figure className="try-out">
          <img src={img.url} alt={`AI photo: ${prompt}`} onLoad={e => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
          {size && <p className="hint print-size">🖨 {printSizeLine(size)}</p>}
          <div className="dock-row">
            <a className="btn sm" href={img.url} download={img.name}>⤓ Download</a>
            {onKept && img.token && (img.kept === 'yes'
              ? <span className="hint" role="status">✓ Kept in My photos, below.</span>
              : <button className="btn sm ghost" disabled={img.kept === 'saving'} onClick={keep}>☆ Keep in My photos</button>)}
          </div>
        </figure>
      )}
    </div>
  );
}

/** A short title from your own words: the first few, up to the first comma. */
export const titleOf = (prompt: string) => {
  const t = prompt.replace(/^a real photograph (of|looking)\s+/i, '').split(/[,.]/)[0].trim();
  const w = t.split(/\s+/).slice(0, 6).join(' ');
  return w ? w[0].toUpperCase() + w.slice(1) : 'My photo';
};
