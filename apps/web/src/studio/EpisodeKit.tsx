import { useEffect, useMemo, useRef, useState } from 'react';
import { comicName, makeComic } from '../lib/comic';
import { makePoster, posterName } from '../lib/poster';
import { ARTIST, AUDIENCES, episodeLabel, MODES, NOTICE, TEMPERATURES, type ConversationView } from '@crosstalk/shared';

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
    ...c.turns.map(t => `${t.seq}. ${t.objective}: ${sp[t.speakerId].name}`),
    '',
    `${NOTICE} Voices and hosts are AI: ${sp.A.modelId} and ${sp.B.modelId}.`,
  ].join('\n');
}

type ImageTileProps = { c: ConversationView; toast: (m: string) => void; title: string; blurb: string; button: string; alt: string; make: (c: ConversationView) => Promise<Blob>; name: (c: ConversationView) => string };

/** A share-ready image (poster or comic): made on this device, then downloaded or shared from the phone. */
function ImageTile({ c, toast, title, blurb, button, alt, make: draw, name }: ImageTileProps) {
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
      </div>
      <span className="badge ok">Free · made on this device</span>
    </div>
  );
}

/**
 * The social clip: a vertical video of the key moment, recorded on this device in real time. You
 * watch it being made, then download or share it. Silent with big captions, like most social clips.
 */
function ClipTile({ c, toast, photos }: { c: ConversationView; toast: (m: string) => void; photos: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'idle' | 'recording' | 'done'>('idle');
  const [progress, setProgress] = useState({ sec: 0, total: 0 });
  const [video, setVideo] = useState<{ url: string; file: File } | null>(null);
  const stop = useRef<AbortController | null>(null);
  useEffect(() => () => { stop.current?.abort(); if (video) URL.revokeObjectURL(video.url); }, [video]);
  const stamp = `${c.artist?.version}|${c.artist?.artStyle}|${c.title}|${c.turns.length}`;
  useEffect(() => { setVideo(null); setState('idle'); }, [stamp]);
  const make = async () => {
    setState('recording');
    stop.current = new AbortController();
    try {
      const { recordClip, clipName } = await import('../lib/clip');
      const { blob, ext } = await recordClip(c, canvas.current!, { photos, signal: stop.current.signal, onProgress: (sec, total) => setProgress({ sec, total }) });
      setVideo({ url: URL.createObjectURL(blob), file: new File([blob], `${clipName(c)}.${ext}`, { type: blob.type }) });
      setState('done');
    } catch (e) { toast((e as Error).message); setState('idle'); }
  };
  const canShare = !!video && typeof navigator.canShare === 'function' && navigator.canShare({ files: [video.file] });
  return (
    <div className="kit-tile clip-tile"><b>Social clip</b>
      {state === 'idle' && <p>The key moment as a vertical video for Reels, Shorts or TikTok: the hosts, captions that light up word by word, where they landed, and Iris's art. 30 to 45 seconds, made on this device while you watch.</p>}
      <canvas ref={canvas} className="clip-canvas" hidden={state !== 'recording'} aria-label="Your clip, being recorded" />
      {state === 'recording' && <p className="hint" role="status">Recording {Math.floor(progress.sec)} of {Math.round(progress.total) || '…'} seconds. Keep this tab open.</p>}
      {video && <video className="clip-video" src={video.url} controls playsInline muted loop aria-label={`Social clip for ${c.topic}`} />}
      <div className="dock-row">
        {state === 'idle' && <button className="btn sm" onClick={make} disabled={!c.turns.length}>Make clip</button>}
        {state === 'recording' && <button className="btn sm ghost" onClick={() => stop.current?.abort()}>Stop</button>}
        {video && <a className="btn sm" href={video.url} download={video.file.name}>Download</a>}
        {canShare && <button className="btn sm ghost" onClick={() => navigator.share({ files: [video!.file], title: c.topic }).catch(() => {})}>Share</button>}
        {video && <button className="btn sm ghost" onClick={() => { setVideo(null); setState('idle'); }}>Make again</button>}
      </div>
      <span className="badge ok">Free · made on this device · silent, with captions</span>
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
        <div><span className="tag">{c.format === 'live' ? 'Live show replay' : 'Episode kit'} · {episodeLabel(c.episode)}</span><h3>Ready for your review</h3></div>
        <button className="btn sm" onClick={copy}>Copy show notes</button>
      </div>
      <div className="kit-grid">
        <div className="kit-tile"><b>Podcast episode</b><p>Title, show notes, {c.turns.length} chapters and the full transcript are ready. {c.audio ? 'Audio with natural voices is ready too.' : 'Audio comes when the episode is voiced.'}</p><span className="badge ok">Text ready</span><span className={`badge ${c.audio ? 'ok' : 'later'}`}>{c.audio ? 'Audio ready' : 'Audio · later'}</span></div>
        <div className="kit-tile"><b>Episode page</b><p>One file with {c.artist?.state === 'done' ? "Iris's art, " : ''}the whole conversation{c.turns.some(t => t.stance != null) ? ', the mind-change meter' : ''} and a Play button that reads it aloud. Opens in any browser, works offline, sends nothing.</p>
          <div className="dock-row"><a className="btn sm" href={`/api/conversations/${c.id}/export.html`} download>Download page</a></div>
          <span className="badge ok">Free · works offline</span></div>
        <ImageTile c={c} toast={toast} title="Episode poster" button="Make poster" alt="Poster for" make={makePoster} name={posterName}
          blurb="The question, the hosts, Iris's sketch and quote, and where each host landed, in one image to share." />
        <ImageTile c={c} toast={toast} title="Comic strip" button="Make comic" alt="Comic strip of" make={makeComic} name={comicName}
          blurb="The episode in 4 panels: the opening, the clash, the moment Iris drew, and where the hosts landed." />
        <ClipTile c={c} toast={toast} photos={photos} />
        <div className="kit-tile"><b>Iris print</b><p>{c.artist?.state === 'done' ? `“${c.artist.artTitle}”, her sketch of turn ${c.artist.momentSeq}, prepared as a listing for your shop.` : 'Her drawing of the moment that stayed with her, prepared as a listing.'}</p><span className="badge later">Later</span></div>
      </div>
      <p className="hint publish-line">
        <span className={`status ${c.publish === 'approved' ? 'completed' : c.publish === 'held' ? 'failed' : 'paused'}`}>{c.publish === 'approved' ? 'approved' : c.publish === 'held' ? 'held' : 'waiting for your OK'}</span>{' '}
        Nothing posts or sells automatically: every episode, clip and print waits for your OK in the <a href="#/control/publish">Control room</a>.
      </p>
    </section>
  );
}
