import { useEffect, useMemo, useRef, useState } from 'react';
import { comicName, makeComic } from '../lib/comic';
import { makePoster, posterName } from '../lib/poster';
import { makePrint, PAPERS, paperPixels, photoQuality, printListing, printName, vectorArt, vectorName, type PaperKey, type PrintArt } from '../lib/print';
import { printSizeLine } from '../lib/printSize';
import { bestArt } from '../lib/irisArt';
import { PLATFORMS, postText, type Platform } from '../lib/publish';
import { ARTIST, AUDIENCES, episodeLabel, jobLabel, MODES, NOTICE, TEMPERATURES, type ConversationView } from '@crosstalk/shared';

export function showNotes(c: ConversationView) {
  const sp = c.speakers;
  const a = c.artist;
  return [
    `CrossTalk · ${episodeLabel(c.episode)}: ${c.topic}`,
    '',
    `${sp.A.name}${sp.A.role ? ` (${sp.A.role})` : ''} and ${sp.B.name}${sp.B.role ? ` (${sp.B.role})` : ''} take on ${c.topic.replace(/\?$/, '').toLowerCase()} in a ${MODES[c.mode].label.toLowerCase()} (${AUDIENCES[c.audience].label}, ${TEMPERATURES[c.temperature].label}).`,
    a?.state === 'done' ? `\nFrom the booth, ${ARTIST.name}: "${a.perspective}"\n\nCover art: "${a.artTitle}" by ${ARTIST.name}` : '',
    '',
    'Chapters',
    ...c.turns.map(t => `${t.seq}. ${jobLabel(t.objective, c.createdAt)}: ${sp[t.speakerId].name}`),
    '',
    `${NOTICE} Voices and hosts are AI: ${sp.A.modelId} and ${sp.B.modelId}.`,
  ].join('\n');
}

type ImageTileProps = { c: ConversationView; toast: (m: string) => void; title: string; blurb: string; button: string; alt: string; make: (c: ConversationView) => Promise<Blob>; name: (c: ConversationView) => string; extra?: React.ReactNode };

/** A share-ready image (poster or comic): made on this device, then downloaded or shared from the phone. */
export function ImageTile({ c, toast, title, blurb, button, alt, make: draw, name, extra }: ImageTileProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  // A vote, a new drawing or a rename makes the poster out of date: offer a fresh one.
  const stamp = `${c.verdict}|${c.artist?.version}|${c.title}|${c.turns.length}`;
  useEffect(() => { setUrl(null); setBlob(null); }, [stamp]);
  const make = async () => {
    setBusy(true);
    try { const b = await draw(c); setBlob(b); setUrl(URL.createObjectURL(b)); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const file = useMemo(() => (blob ? new File([blob], name(c), { type: 'image/png' }) : null), [blob]); // eslint-disable-line react-hooks/exhaustive-deps
  const canShare = useMemo(() => !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }), [file]);
  return (
    <div className="kit-tile poster-tile"><b>{title}</b>
      {url ? <img className="poster-preview" src={url} alt={`${alt} ${c.topic}`} /> : <p>{blurb}</p>}
      <div className="dock-row">
        {!url && <button className="btn sm" disabled={busy} onClick={make}>{busy ? 'Drawing…' : button}</button>}
        {url && <a className="btn sm" href={url} download={name(c)}>Download</a>}
        {canShare && <button className="btn sm ghost" onClick={() => navigator.share({ files: [file!], title: c.topic }).catch(() => {})}>Share</button>}
        {extra}
      </div>
    </div>
  );
}

/**
 * The social clip: a vertical video of the key moment, recorded on this device in real time. You
 * watch it being made, then download or share it. Silent with big captions, like most social clips.
 */
export function ClipTile({ c, toast, photos }: { c: ConversationView; toast: (m: string) => void; photos: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'idle' | 'recording' | 'done'>('idle');
  const [progress, setProgress] = useState({ sec: 0, total: 0 });
  const [video, setVideo] = useState<{ url: string; file: File } | null>(null);
  const [music, setMusic] = useState(true);
  const stop = useRef<AbortController | null>(null);
  useEffect(() => () => { stop.current?.abort(); if (video) URL.revokeObjectURL(video.url); }, [video]);
  const stamp = `${c.artist?.version}|${c.artist?.artStyle}|${c.title}|${c.turns.length}`;
  // A new drawing or a rename makes the clip out of date; a recording in progress is stopped first.
  useEffect(() => { stop.current?.abort(); setVideo(null); setState('idle'); }, [stamp]);
  const make = async () => {
    setState('recording');
    const ctl = stop.current = new AbortController();
    try {
      const { recordClip, clipName } = await import('../lib/clip');
      const { blob, ext } = await recordClip(c, canvas.current!, { photos, music, signal: ctl.signal, onProgress: (sec, total) => { if (!ctl.signal.aborted) setProgress({ sec, total }); } });
      if (ctl.signal.aborted) return; // left the page, or a newer recording took over
      setVideo({ url: URL.createObjectURL(blob), file: new File([blob], `${clipName(c)}.${ext}`, { type: blob.type }) });
      setState('done');
    } catch (e) { if (!ctl.signal.aborted || (e as Error).message !== 'Stopped.') toast((e as Error).message); if (stop.current === ctl) setState('idle'); }
  };
  const canShare = !!video && typeof navigator.canShare === 'function' && navigator.canShare({ files: [video.file] });
  return (
    <div className="kit-tile clip-tile"><b>Social clip</b>
      {state === 'idle' && <p>A 30–45 second vertical video with live captions and Iris's art, for Reels, Shorts or TikTok.</p>}
      {state === 'idle' && <label className="check"><input type="checkbox" checked={music} onChange={e => setMusic(e.target.checked)} /> Soft music, composed for this episode on your device (free to post)</label>}
      <canvas ref={canvas} className="clip-canvas" hidden={state !== 'recording'} aria-label="Your clip, being recorded" />
      {state === 'recording' && <p className="hint" role="status">Recording {Math.floor(progress.sec)} of {Math.round(progress.total) || '…'} seconds. Keep this tab open.</p>}
      {video && <video className="clip-video" src={video.url} controls playsInline loop aria-label={`Social clip for ${c.topic}`} />}
      <div className="dock-row">
        {state === 'idle' && <button className="btn sm" onClick={make} disabled={!c.turns.length}>Make clip</button>}
        {state === 'recording' && <button className="btn sm ghost" onClick={() => stop.current?.abort()}>Stop</button>}
        {video && <a className="btn sm" href={video.url} download={video.file.name}>Download</a>}
        {canShare && <button className="btn sm ghost" onClick={() => navigator.share({ files: [video!.file], title: c.topic }).catch(() => {})}>Share</button>}
        {video && <button className="btn sm ghost" onClick={() => { setVideo(null); setState('idle'); }}>Make again</button>}
      </div>
    </div>
  );
}

/** What a finished episode can become. Text is ready now; audio, clips and prints come later and always wait for your OK. */
export function EpisodeKit({ c, toast, photos = false }: { c: ConversationView; toast: (m: string) => void; photos?: boolean }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(showNotes(c)); toast('Show notes copied'); } catch { toast('Copying is blocked in this browser'); }
  };
  return (
    <section className="kit" aria-label="Episode kit">
      <div className="kit-head">
        <div><span className="tag">{c.format === 'live' ? 'Live show replay' : 'Episode kit'} · {episodeLabel(c.episode)}</span><h3>Ready for your review</h3><p className="hint kit-free">Everything here is free and made on this device; nothing is uploaded.</p></div>
        <button className="btn sm" onClick={copy}>Copy show notes</button>
      </div>
      <div className="kit-grid">
        <div className="kit-tile"><b>Podcast episode</b><p>Show notes, {c.turns.length} chapters and the transcript. {c.audio ? 'Audio with natural voices too.' : 'Audio comes when it is voiced.'}</p><span className="badge ok">Text ready</span><span className={`badge ${c.audio ? 'ok' : 'later'}`}>{c.audio ? 'Audio ready' : 'Audio · later'}</span></div>
        <div className="kit-tile"><b>Episode page</b><p>One file with {c.artist?.state === 'done' ? "Iris's art, " : ''}the whole conversation and a Play button. Works offline.</p>
          <div className="dock-row"><a className="btn sm" href={`/api/conversations/${c.id}/export.html`} download>Download page</a></div></div>
        <ImageTile c={c} toast={toast} title="Episode poster" button="Make poster" alt="Poster for" make={makePoster} name={posterName}
          blurb="The question, the hosts, Iris's art and where each landed, in one image." />
        <ImageTile c={c} toast={toast} title="Comic strip" button="Make comic" alt="Comic strip of" make={makeComic} name={comicName}
          blurb="The episode in 4 panels, from the opening to where they landed." />
        <ClipTile c={c} toast={toast} photos={photos} />
        <PostTile c={c} toast={toast} />
        <PrintTile c={c} toast={toast} />
      </div>
      <p className="hint publish-line">
        <span className={`status ${c.publish === 'approved' ? 'completed' : c.publish === 'held' ? 'failed' : 'paused'}`}>{c.publish === 'approved' ? 'approved' : c.publish === 'held' ? 'held' : 'waiting for your OK'}</span>{' '}
        Nothing posts or sells automatically: every episode, clip and print waits for your OK in the <a href="#/control/publish">Control room</a>.
      </p>
    </section>
  );
}

/** Publish kit: the words to post on each platform, ready to copy. Nothing posts by itself. */
export function PostTile({ c, toast }: { c: ConversationView; toast: (m: string) => void }) {
  const [p, setP] = useState<Platform>('shorts');
  const text = postText(c, p);
  const copy = async () => { try { await navigator.clipboard.writeText(text); toast(`${PLATFORMS[p].label} text copied`); } catch { toast('Copying is blocked in this browser'); } };
  return (
    <div className="kit-tile post-tile">
      <b>Post it</b>
      <div className="seg sm" role="group" aria-label="Platform">
        {(Object.keys(PLATFORMS) as Platform[]).map(k => <button key={k} aria-pressed={p === k} onClick={() => setP(k)}>{PLATFORMS[k].label}</button>)}
      </div>
      <textarea className="post-text" readOnly value={text} aria-label={`${PLATFORMS[p].label} text`} rows={7} />
      <p className="hint">{PLATFORMS[p].help} Add the Social clip, and tick the platform's own AI-content label when you post.</p>
      <div className="dock-row"><button className="btn sm" onClick={() => void copy()}>Copy text</button></div>
    </div>
  );
}

/**
 * Iris print: her art matted on a page of the size you pick. Her line art is vector, so it's sharp at
 * every size; her AI picture is only as sharp as its own pixels, and the tile says how big that is.
 */
function PrintTile({ c, toast }: { c: ConversationView; toast: (m: string) => void }) {
  const [paper, setPaper] = useState<PaperKey>('a4');
  const [art, setArt] = useState<PrintArt>('ink');
  const [made, setMade] = useState<{ url: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [picSize, setPicSize] = useState<{ w: number; h: number } | null>(null);
  const key = `${paper}|${art}|${c.artist?.version}|${c.artist?.artStyle}`;
  useEffect(() => () => { if (made) URL.revokeObjectURL(made.url); }, [made]);
  const make = async () => {
    setBusy(true);
    try { const b = await makePrint(c, paper, art); setMade({ url: URL.createObjectURL(b), key }); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const vector = () => {
    const b = vectorArt(c, art === 'ink');
    if (!b) return;
    const u = URL.createObjectURL(b);
    const a = document.createElement('a'); a.href = u; a.download = vectorName(c); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  };
  const px = paperPixels(paper);
  const current = made?.key === key ? made : null;
  return (
    <div className="kit-tile poster-tile print-tile"><b>Iris print</b>
      {current ? <img className="poster-preview" src={current.url} alt={`Iris print for ${c.topic}`} /> : <p>“{c.artist?.artTitle ?? 'Her drawing'}”, matted on a page, ready to print at home or at a print shop.</p>}
      <div className="seg sm" role="group" aria-label="Art">
        <button aria-pressed={art === 'ink'} onClick={() => setArt('ink')}>Ink on paper</button>
        <button aria-pressed={art === 'line'} onClick={() => setArt('line')}>Her style</button>
        <button aria-pressed={art === 'picture'} onClick={() => setArt('picture')}>AI picture</button>
      </div>
      <label className="fld"><span className="tag">Paper</span>
        <select value={paper} onChange={e => setPaper(e.target.value as PaperKey)}>
          {(Object.keys(PAPERS) as PaperKey[]).map(k => <option key={k} value={k}>{PAPERS[k].label}{art === 'picture' && picSize ? ` · ${photoQuality(picSize.w, k).word}` : ''}</option>)}
        </select>
      </label>
      <p className="hint print-size">🖨 {art !== 'picture'
        ? `Vector line art: sharp at ${PAPERS[paper].label}. File: ${px.w} × ${px.h} px at ${px.dpi} dpi.`
        : picSize ? `${printSizeLine(picSize)}. Bigger pages enlarge it and look softer; Line art stays sharp.` : 'Sharp only up to the picture\'s own size (shown once it\'s made); Line art stays sharp at any size.'}</p>
      <div className="dock-row">
        {!current && <button className="btn sm" disabled={busy} onClick={() => void make().then(() => { if (art === 'picture') void bestPictureSize(c).then(setPicSize); })}>{busy ? 'Drawing…' : 'Make print'}</button>}
        {current && <a className="btn sm" href={current.url} download={printName(c, paper)}>Download</a>}
        {art !== 'picture' && <button className="btn sm ghost" onClick={vector}>⤓ Vector (SVG)</button>}
        <button className="btn sm ghost" onClick={async () => { try { await navigator.clipboard.writeText(printListing(c)); toast('Listing text copied'); } catch { toast('Copying is blocked in this browser'); } }}>Copy listing text</button>
      </div>
    </div>
  );
}

/** The real pixel size of her AI picture (or the one she painted here), for the honest print-size line. */
async function bestPictureSize(c: ConversationView): Promise<{ w: number; h: number } | null> {
  const src = await bestArt(c).catch(() => null);
  if (!src) return null;
  return await new Promise(resolve => { const i = new Image(); i.onload = () => resolve({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => resolve(null); i.src = src; });
}

