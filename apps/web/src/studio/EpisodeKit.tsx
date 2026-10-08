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

/** What a finished episode can become. Text is ready now; audio, clips and prints come later and always wait for your OK. */
export function EpisodeKit({ c, toast }: { c: ConversationView; toast: (m: string) => void }) {
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
        <div className="kit-tile"><b>Social clip</b><p>The key moment as a 30–60 second vertical clip: the studio, live captions, and Iris's sketch at the end.</p><span className="badge later">Later</span></div>
        <div className="kit-tile"><b>Iris print</b><p>{c.artist?.state === 'done' ? `“${c.artist.artTitle}”, her sketch of turn ${c.artist.momentSeq}, prepared as a listing for your shop.` : 'Her drawing of the moment that stayed with her, prepared as a listing.'}</p><span className="badge later">Later</span></div>
      </div>
      <p className="hint publish-line">
        <span className={`status ${c.publish === 'approved' ? 'completed' : c.publish === 'held' ? 'failed' : 'paused'}`}>{c.publish === 'approved' ? 'approved' : c.publish === 'held' ? 'held' : 'waiting for your OK'}</span>{' '}
        Nothing posts or sells automatically: every episode, clip and print waits for your OK in the <a href="#/control/publish">Control room</a>.
      </p>
    </section>
  );
}
