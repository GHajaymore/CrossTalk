import { useEffect, useState } from 'react';
import { photoThemesFor } from '@crosstalk/shared';

/**
 * Photo of the day: today's ideas from Iris's camera (one of each kind, new every day), or your own
 * words. Made by the free AI image service, up to 10 a day, and not kept: download the ones you love.
 */
export function PhotoOfTheDay({ compact = false }: { compact?: boolean }) {
  const [themes] = useState(() => photoThemesFor(new Date()));
  const [picked, setPicked] = useState<string | null>(compact ? themes[0].title : null);
  const [prompt, setPrompt] = useState(compact ? themes[0].prompt : '');
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<{ left: number; perDay: number } | null>(null);

  useEffect(() => {
    fetch('/api/images/try').then(r => (r.ok ? r.json() : null)).then(setLeft).catch(() => {});
  }, []);
  useEffect(() => () => { if (img) URL.revokeObjectURL(img.url); }, [img]);

  const pick = (title: string, text: string) => { setPicked(title); setPrompt(text); };
  const go = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch('/api/images/try', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? `It didn't work (${r.status}).`);
      const n = Number(r.headers.get('X-Tries-Left'));
      if (Number.isFinite(n) && left) setLeft({ ...left, left: n });
      const name = (picked && themes.find(t => t.title === picked)?.prompt === prompt ? picked : 'my-photo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      setImg({ url: URL.createObjectURL(await r.blob()), name: `crosstalk-${name || 'photo'}.jpg` });
    } catch (e) {
      setError((e as Error).message);
      fetch('/api/images/try').then(x => (x.ok ? x.json() : null)).then(setLeft).catch(() => {});
    } finally { setBusy(false); }
  };
  const none = left?.left === 0;

  return (
    <div className="potd">
      {!compact && <p className="hint">Today's ideas from Iris's camera: one of each kind, new every day. Pick one and make it as it is, change the words, or describe your own.</p>}
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
        <span className="hint">{left ? `${left.left} of ${left.perDay} left today` : 'Up to 10 a day'} · not kept, so download the ones you love · invented adults only, no text, no real people.</span>
      </div>
      {error && <p className="hint" role="alert">✕ {error}</p>}
      {img && (
        <figure className="try-out">
          <img src={img.url} alt={`AI photo: ${prompt}`} />
          <a className="btn sm" href={img.url} download={img.name}>⤓ Download</a>
        </figure>
      )}
    </div>
  );
}
