import { useState } from 'react';
import type { AppConfig, MockSettings } from '@crosstalk/shared';
import { api } from '../api/client';
import { SetupBanner } from '../lib/Banners';
import { Footer } from './Footer';

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
      <div><h1>Settings</h1><p className="hint">Voices and Scout settings arrive in later milestones. What Iris has learned from you is on the <a href="#/iris">Iris</a> page.</p></div>
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
