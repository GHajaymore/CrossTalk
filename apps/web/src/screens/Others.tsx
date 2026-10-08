import { useEffect, useState } from 'react';
import type { IrisFeedback } from '@crosstalk/shared';
import { sketchSrc } from '../studio/ArtistCard';
import { MAX_TURNS, MODES, type AppConfig, type MockSettings } from '@crosstalk/shared';
import { api, type ConversationSummary } from '../api/client';
import { SetupBanner } from '../lib/Banners';
import { Footer } from './Footer';

/** Milestone 1 stand-in: a plain list so saved discussions can be reopened. The full Library is Milestone 6. */
export function Library({ config }: { config: AppConfig | null }) {
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  useEffect(() => { api.list().then(setItems).catch(() => setItems([])); }, []);
  return (
    <div className="page">
      <div><h1>Library</h1><p className="hint">Each episode shows Iris's sketch. Rename, export, delete and branches arrive in Milestone 6.</p></div>
      {!items ? <p className="hint">Loading…</p> : !items.length ? <p className="hint">No discussions yet. Start one from Create.</p> : (
        <ul className="lib-list">
          {items.map(c => {
            const st = c.run?.state ?? 'idle';
            return (
              <li className="lib-item" key={c.id}>
                <div className="lib-row">
                {c.artist?.sketchSvg && <a href={`#/studio/${c.id}`}><img className="thumb" src={sketchSrc(c.artist.sketchSvg)} alt={`Iris's sketch: ${c.artist.artTitle}`} /></a>}
                <div style={{ minWidth: 0 }}>
                  <div className="lib-title">{c.title}</div>
                  <div className="lib-meta">
                    <span className={`status ${st}`}>{c.run?.stopReason === 'interrupted' ? 'interrupted' : st}</span>
                    <span>Ep. {String(c.episode).padStart(2, '0')}</span>
                    <span>{MODES[c.mode].label}</span>
                    <span>{c.turnCount} of {MAX_TURNS} turns</span>
                    <span>{new Date(c.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                    {c.artist?.state === 'done' && <span>“{c.artist.artTitle}”</span>}
                  </div>
                </div>
                </div>
                <a className="btn sm" href={`#/studio/${c.id}`}>Open</a>
              </li>
            );
          })}
        </ul>
      )}
      <Footer config={config} />
    </div>
  );
}

function IrisLearning() {
  const [notes, setNotes] = useState<IrisFeedback[] | null>(null);
  useEffect(() => { api.irisFeedback().then(setNotes).catch(() => setNotes([])); }, []);
  return (
    <section className="sec"><h2>What Iris has learned</h2>
      <p className="hint">Iris reads your latest 10 notes before every drawing. Tell her what you think on her card after an episode.</p>
      {!notes ? <p className="hint">Loading…</p> : !notes.length ? <p className="hint">Nothing yet. After an episode, use "Help Iris learn" on her card.</p> : (
        <ul className="learned">
          {notes.map(n => (
            <li key={n.id}>
              <span>{n.rating === 'up' ? '👍' : '👎'} {n.note || (n.rating === 'up' ? 'Liked it' : 'Wanted something different')}{n.artTitle && <span className="hint"> · on “{n.artTitle}”</span>}</span>
              <button onClick={async () => setNotes(await api.forgetIrisFeedback(n.id))}>Forget</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Settings({ config, refreshConfig }: { config: AppConfig | null; refreshConfig: () => void }) {
  const [checking, setChecking] = useState(false);
  const real = config?.providerMode === 'openrouter';
  const set = async (patch: Partial<MockSettings>) => {
    if (!config) return;
    await api.setMock({ ...config.mock, ...patch });
    refreshConfig();
  };
  const recheck = async () => {
    setChecking(true);
    try { await api.checkModels(); } finally { setChecking(false); refreshConfig(); }
  };
  const verdict = (id: string) => config?.guard.verdicts.find(v => v.modelId === id);
  const modelRow = (label: string, id: string | null) => {
    const v = id ? verdict(id) : undefined;
    return <><dt>{label}</dt><dd>{id || 'not set'}{real && id && (v
      ? <span className={`verdict ${v.ok ? 'ok' : 'bad'}`}>{v.ok ? '✓' : '✕'} {v.reason}</span>
      : <span className="verdict">not checked yet</span>)}</dd></>;
  };
  const u = config?.usageToday;
  const cost = !u ? '…' : real ? (u.costUsd === null ? 'unknown (not every reply reported a price)' : `$${u.costUsd.toFixed(4)}`) : '$0.00 (mock mode)';

  return (
    <div className="page">
      <div><h1>Settings</h1><p className="hint">Voices and Scout settings arrive in later milestones.</p></div>
      <SetupBanner config={config} onSettings />
      <section className="sec"><h2>Models</h2>
        <p className="hint">Read-only here. Models are set in the server's settings (the <code>.env</code> file, or the cloud environment's variables) and must be different IDs.</p>
        <dl className="kv">
          <dt>PROVIDER_MODE</dt><dd>{config?.providerMode ?? '…'}</dd>
          {modelRow('SPEAKER_A_MODEL', config?.models.A ?? null)}
          {modelRow('SPEAKER_B_MODEL', config?.models.B ?? null)}
          {real && modelRow('ARTIST_MODEL', config?.artistModel ?? null)}
          <dt>ALLOW_PAID_MODELS</dt><dd>{String(config?.allowPaidModels ?? false)}{config?.allowPaidModels ? ' · paid models are NOT blocked' : ' · only $0 models can run'}</dd>
          <dt>MAX_OUTPUT_TOKENS</dt><dd>{config?.maxOutputTokens}</dd>
        </dl>
        {real && <div className="dock-row">
          <button className="btn sm" disabled={checking} onClick={recheck}>{checking ? 'Checking…' : 'Check models again'}</button>
          <span className="hint">{config?.guard.checkedAt ? `Last checked ${new Date(config.guard.checkedAt).toLocaleTimeString()}. ` : ''}Each model must show $0 on OpenRouter's own price list, or runs are blocked. A ":free" name alone doesn't count.</span>
        </div>}
      </section>
      <IrisLearning />
      <section className="sec"><h2>Usage today</h2>
        <dl className="kv">
          <dt>Requests</dt><dd>{config ? `${config.requestsToday} of ${config.dailyLimit} (every attempt counts, including retries)` : '…'}</dd>
          <dt>Tokens</dt><dd>{u ? `${u.tokensIn.toLocaleString()} in · ${u.tokensOut.toLocaleString()} out` : '…'}</dd>
          <dt>Cost</dt><dd>{cost}</dd>
        </dl>
        <p className="hint">The daily limit is a local safety limit set by the app. It is not a billing guarantee from any provider.</p>
      </section>
      <section className="sec"><h2>API key</h2>
        <p className="hint">The OpenRouter key lives only in the server's settings, read by the local server. The browser never receives it.</p>
        <dl className="kv"><dt>OPENROUTER_API_KEY</dt><dd>{!real ? 'not needed in mock mode' : config?.apiKeySet ? 'set' : 'not set'}</dd></dl>
      </section>
      {!real && <section className="sec"><h2>Prototype controls</h2>
        <label className="toggle"><input type="checkbox" checked={!!config?.mock.failOnce} onChange={e => set({ failOnce: e.target.checked })} /> Simulate a provider failure on turn 5 (once per conversation)</label>
        <label className="toggle"><input type="checkbox" checked={!!config?.mock.fast} onChange={e => set({ fast: e.target.checked })} /> Fast streaming</label>
        <p className="hint">These reset when the server restarts.</p>
      </section>}
      <Footer config={config} />
    </div>
  );
}

export function ControlRoom({ config }: { config: AppConfig | null }) {
  return (
    <div className="page">
      <div><span className="tag">Admin · only you</span><h1>Control room</h1></div>
      <p className="hint">Overview, Live control with producer notes, Publishing approvals, Topics and Rules arrive in Milestone 8.</p>
      <Footer config={config} />
    </div>
  );
}
