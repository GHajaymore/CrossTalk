import { useEffect, useRef, useState } from 'react';
import type { ConversationView } from '@crosstalk/shared';
import { api, type ConversationSummary } from '../api/client';

/** "This week on CrossTalk": your latest episodes in one vertical video, made on this device. */
export function RecapPanel({ items, photos, toast }: { items: ConversationSummary[]; photos: boolean; toast: (m: string) => void }) {
  const ready = items.filter(c => c.run?.state === 'completed' && c.artist?.state === 'done').slice(0, 5);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'idle' | 'recording' | 'done'>('idle');
  const [progress, setProgress] = useState({ sec: 0, total: 0 });
  const [video, setVideo] = useState<{ url: string; file: File } | null>(null);
  const [music, setMusic] = useState(true);
  const stop = useRef<AbortController | null>(null);
  useEffect(() => () => { stop.current?.abort(); if (video) URL.revokeObjectURL(video.url); }, [video]);
  if (!ready.length) return null;
  const make = async () => {
    setState('recording');
    const ctl = stop.current = new AbortController();
    try {
      const views: ConversationView[] = await Promise.all(ready.map(c => api.get(c.id)));
      const { recordRecap, recapName } = await import('../lib/recap');
      const { blob, ext } = await recordRecap(views, canvas.current!, { photos, music, signal: ctl.signal, onProgress: (sec, total) => { if (!ctl.signal.aborted) setProgress({ sec, total }); } });
      if (ctl.signal.aborted) return;
      setVideo({ url: URL.createObjectURL(blob), file: new File([blob], `${recapName()}.${ext}`, { type: blob.type }) });
      setState('done');
    } catch (e) { if (!ctl.signal.aborted || (e as Error).message !== 'Stopped.') toast((e as Error).message); if (stop.current === ctl) setState('idle'); }
  };
  const canShare = !!video && typeof navigator.canShare === 'function' && navigator.canShare({ files: [video.file] });
  return (
    <section className="recap" aria-label="This week's recap">
      <div className="recap-text">
        <span className="tag">This week on CrossTalk</span>
        <p>Your latest {ready.length === 1 ? 'episode' : `${ready.length} episodes`} in one vertical video: each question, the line Iris drew, and her art, with music composed for it. Made on this device while you watch.</p>
        {state === 'idle' && <label className="check"><input type="checkbox" checked={music} onChange={e => setMusic(e.target.checked)} /> Soft music (free to post)</label>}
        {state === 'recording' && <p className="hint" role="status">Recording {Math.floor(progress.sec)} of {Math.round(progress.total) || '…'} seconds. Keep this tab open.</p>}
        <div className="dock-row">
          {state === 'idle' && <button className="btn sm" onClick={make}>🎬 Make the recap</button>}
          {state === 'recording' && <button className="btn sm ghost" onClick={() => stop.current?.abort()}>Stop</button>}
          {video && <a className="btn sm" href={video.url} download={video.file.name}>Download</a>}
          {canShare && <button className="btn sm ghost" onClick={() => navigator.share({ files: [video!.file], title: 'This week on CrossTalk' }).catch(() => {})}>Share</button>}
          {video && <button className="btn sm ghost" onClick={() => { setVideo(null); setState('idle'); }}>Make again</button>}
        </div>
      </div>
      <canvas ref={canvas} className="clip-canvas" hidden={state !== 'recording'} aria-label="Your recap, being recorded" />
      {video && <video className="clip-video" src={video.url} controls playsInline loop aria-label="This week on CrossTalk" />}
    </section>
  );
}
