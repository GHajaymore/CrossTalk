import { useEffect, useState } from 'react';
import { AUTOPILOT_REQUESTS, type AppConfig, type MockSettings } from '@crosstalk/shared';
import { api, type ScoutView } from '../api/client';
import { ScoutPrefsEditor } from '../scout/ScoutPrefsEditor';
import { BrowserSpeech } from '../speech/BrowserSpeech';
import { useVoices } from '../speech/usePlayback';
import { VoicePicker } from '../speech/VoicePicker';
import { ago, SetupBanner, StorageBanner } from '../lib/Banners';
import { Footer } from './Footer';

/** Online only: is every episode really being kept? Asks the bucket itself, not just the settings. */
function BackupSection({ config, refreshConfig }: { config: AppConfig; refreshConfig: () => void }) {
  const [checking, setChecking] = useState(false);
  const b = config.backup;
  const check = async () => {
    setChecking(true);
    try { await api.checkBackup(); } finally { setChecking(false); refreshConfig(); }
  };
  const state = config.storage === 'forgets' ? '✕ Not set up: everything is forgotten when the server restarts.'
    : b.state === 'ok' ? `✓ Working. The bucket's newest copy is from ${b.lastAt ? ago(b.lastAt) : 'just now'}.`
    : b.state === 'failing' ? `✕ Not reaching the bucket${b.detail ? `: ${b.detail}` : '.'}`
    : '… Checking the bucket (about a minute after the server starts).';
  return (
    <section className="sec"><h2>Backup</h2>
      <dl className="kv">
        <dt>Episodes and art</dt><dd>{state}</dd>
        {b.restore && <><dt>This start</dt><dd>{b.restore === 'restored' ? 'Brought back from the bucket.' : 'The bucket had nothing to bring back, so it started empty.'}</dd></>}
        {b.checkedAt && <><dt>Last checked</dt><dd>{ago(b.checkedAt)}</dd></>}
      </dl>
      {config.storage === 'backed-up' && <div className="dock-row">
        <button className="btn sm" disabled={checking} onClick={check}>{checking ? 'Checking…' : 'Check backup now'}</button>
        <span className="hint">Asks the bucket what it holds. Copies go up about 10 seconds after each change.</span>
      </div>}
    </section>
  );
}

/** How the free image service is doing, so a missing photo or painting has a reason. */
function ImagesSection({ config }: { config: AppConfig }) {
  const line = (h: AppConfig['images']['portraits']) => {
    const ok = h.lastOkAt ? Date.parse(h.lastOkAt) : 0, bad = h.lastErrorAt ? Date.parse(h.lastErrorAt) : 0;
    if (!ok && !bad) return 'Nothing asked for since the server started.';
    return bad > ok ? `✕ Last try failed ${ago(h.lastErrorAt!)}: ${h.lastError}` : `✓ Last picture arrived ${ago(h.lastOkAt!)}.`;
  };
  return (
    <section className="sec"><h2>Pictures</h2>
      <p className="hint">The hosts' photos and Iris's full paintings come from a free image service. When it can't make one, Iris paints her own on your device instead.</p>
      <dl className="kv">
        {config.portraits && <><dt>Host photos</dt><dd>{line(config.images.portraits)}</dd></>}
        {config.irisPictures && <><dt>Iris's paintings</dt><dd>{line(config.images.pictures)}</dd></>}
      </dl>
    </section>
  );
}

export function Settings({ config, refreshConfig }: { config: AppConfig | null; refreshConfig: () => void }) {
  const [checking, setChecking] = useState(false);
  const real = !!config && config.providerMode !== 'mock';
  const groq = config?.providerMode === 'groq';
  const service = groq ? 'Groq' : 'OpenRouter';
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
      <div><h1>Settings</h1><p className="hint">What Iris has learned from you is on the <a href="#/iris">Iris</a> page.</p></div>
      <SetupBanner config={config} onSettings />
      <StorageBanner config={config} />
      <VoiceSettings />
      <ScoutSettings real={real} />
      <section className="sec"><h2>Models</h2>
        <p className="hint">Read-only here. Models are set in the server's settings (the <code>.env</code> file, or the cloud environment's variables) and must be different IDs.</p>
        <dl className="kv">
          <dt>PROVIDER_MODE</dt><dd>{config?.providerMode ?? '…'}</dd>
          {modelRow('SPEAKER_A_MODEL', config?.models.A ?? null)}
          {modelRow('SPEAKER_B_MODEL', config?.models.B ?? null)}
          {real && modelRow('ARTIST_MODEL', config?.artistModel ?? null)}
          {groq
            ? <><dt>GROQ_PLAN</dt><dd>{config?.problems.some(p => p.includes('GROQ_PLAN')) ? 'not confirmed · nothing runs until it says free' : 'free · your Groq account has no card, so nothing can be charged'}</dd></>
            : <><dt>ALLOW_PAID_MODELS</dt><dd>{String(config?.allowPaidModels ?? false)}{config?.allowPaidModels ? ' · paid models are NOT blocked' : ' · only $0 models can run'}</dd></>}
          <dt>MAX_OUTPUT_TOKENS</dt><dd>{config?.maxOutputTokens}</dd>
        </dl>
        {real && <div className="dock-row">
          <button className="btn sm" disabled={checking} onClick={recheck}>{checking ? 'Checking…' : 'Check models again'}</button>
          <span className="hint">{config?.guard.checkedAt ? `Last checked ${new Date(config.guard.checkedAt).toLocaleTimeString()}. ` : ''}{groq ? "Each model must be on Groq's own list for your key, or runs are blocked." : 'Each model must show $0 on OpenRouter\'s own price list, or runs are blocked. A ":free" name alone doesn\'t count.'}</span>
        </div>}
      </section>
      <section className="sec"><h2>Usage today</h2>
        <dl className="kv">
          <dt>Requests</dt><dd>{config ? `${config.requestsToday} of ${config.dailyLimit} (every attempt counts, including retries)` : '…'}</dd>
          <dt>Tokens</dt><dd>{u ? `${u.tokensIn.toLocaleString()} in · ${u.tokensOut.toLocaleString()} out` : '…'}</dd>
          <dt>Cost</dt><dd>{cost}</dd>
        </dl>
        <p className="hint">The daily limit is a local safety limit set by the app. It is not a billing guarantee from any provider.</p>
      </section>
      {config && config.storage !== 'local' && <BackupSection config={config} refreshConfig={refreshConfig} />}
      {config && (config.portraits || config.irisPictures) && <ImagesSection config={config} />}
      <section className="sec"><h2>API key</h2>
        <p className="hint">The {service} key lives only in the server's settings, read by the local server. The browser never receives it.</p>
        <dl className="kv"><dt>{config?.keyName ?? 'OPENROUTER_API_KEY'}</dt><dd>{!real ? 'not needed in mock mode' : config?.apiKeySet ? 'set' : 'not set'}</dd></dl>
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

/** The device's voices for the left and right seats. Every episode uses them; recordings use their own voices. */
function VoiceSettings() {
  const { voices, prefs, update } = useVoices();
  const names = { A: 'Left seat (warm)', B: 'Right seat (cool)' };
  return (
    <section className="sec"><h2>Voices</h2>
      <p className="hint">Saved on this device only. The same choices are in the Studio under Cues &amp; voices. Episodes with a rendered recording play its natural voices instead.</p>
      <VoicePicker names={names} voices={voices} prefs={prefs} update={update}
        preview={k => new BrowserSpeech(() => prefs).speak([{ key: 'p', speakerId: k, text: `This is the ${k === 'A' ? 'left' : 'right'} seat. This is how I'll sound on the show.` }], {})} />
    </section>
  );
}

/** The Topic Scout: what it looks for, where, when, and Autopilot. */
function ScoutSettings({ real }: { real: boolean }) {
  const [data, setData] = useState<ScoutView | null>(null);
  const [place, setPlace] = useState('');
  useEffect(() => { api.scout().then(v => { setData(v); setPlace(v.prefs.place); }).catch(() => {}); }, []);
  if (!data) return null;
  const save = async (p: ScoutView['prefs']) => { setData({ ...data, prefs: p }); try { setData(await api.setScoutPrefs(p)); } catch { /* kept as typed */ } };
  const last = data.status.lastRun;
  return (
    <section className="sec"><h2>Topic Scout</h2>
      <p className="hint">Once a day the Scout reads public lists and feeds, drops tragedies, crime, health scares and private lives, and briefs the best 3–5 debates for your Today tray on Create.</p>
      <ScoutPrefsEditor prefs={data.prefs} onChange={save} />
      <label className="fld"><span className="tag">Your city or region, for "Local"</span>
        <input type="text" maxLength={60} value={place} placeholder="e.g. Columbus, Ohio" onChange={e => setPlace(e.target.value)} onBlur={() => place !== data.prefs.place && save({ ...data.prefs, place: place.trim() })} />
      </label>
      <label className="switch"><input type="checkbox" checked={data.prefs.autopilot} onChange={e => save({ ...data.prefs, autopilot: e.target.checked })} /> Autopilot: make the top pick into an episode each day (about {AUTOPILOT_REQUESTS} requests)</label>
      <dl className="kv">
        <dt>SCOUT_TIME</dt><dd>{data.status.time} (server time)</dd>
        <dt>Sources</dt><dd>{real ? 'Hacker News · Wikipedia most-read · RSS feeds in SCOUT_RSS_FEEDS' : 'Saved sample stories (mock mode)'}</dd>
        <dt>Last run</dt><dd>{last ? `${new Date(last.startedAt).toLocaleString()} · ${last.state === 'ok' ? 'ok' : `failed: ${last.error}`}` : 'not yet'}</dd>
      </dl>
      <p className="hint">The app never detects your location: "Local" uses only what you type here. Reddit isn't used yet; it needs a registered app and a check of its terms first.</p>
    </section>
  );
}
