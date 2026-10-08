import { useEffect, useState } from 'react';
import { MODES, type AppConfig, type MockSettings } from '@crosstalk/shared';
import { api, type ConversationSummary } from '../api/client';
import { Footer } from './Footer';

/** Milestone 1 stand-in: a plain list so saved discussions can be reopened. The full Library is Milestone 6. */
export function Library() {
  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  useEffect(() => { api.list().then(setItems).catch(() => setItems([])); }, []);
  return (
    <div className="page">
      <div><h1>Library</h1><p className="hint">A simple list for now. Rename, export, delete, branches and Iris's thumbnails arrive in Milestone 6.</p></div>
      {!items ? <p className="hint">Loading…</p> : !items.length ? <p className="hint">No discussions yet. Start one from Create.</p> : (
        <ul className="lib-list">
          {items.map(c => {
            const st = c.run?.state ?? 'idle';
            return (
              <li className="lib-item" key={c.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="lib-title">{c.title}</div>
                  <div className="lib-meta">
                    <span className={`status ${st}`}>{c.run?.stopReason === 'interrupted' ? 'interrupted' : st}</span>
                    <span>Ep. {String(c.episode).padStart(2, '0')}</span>
                    <span>{MODES[c.mode].label}</span>
                    <span>{c.turnCount} of 8 turns</span>
                    <span>{new Date(c.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                  </div>
                </div>
                <a className="btn sm" href={`#/studio/${c.id}`}>Open</a>
              </li>
            );
          })}
        </ul>
      )}
      <Footer />
    </div>
  );
}

export function Settings({ config, refreshConfig }: { config: AppConfig | null; refreshConfig: () => void }) {
  const set = async (patch: Partial<MockSettings>) => {
    if (!config) return;
    await api.setMock({ ...config.mock, ...patch });
    refreshConfig();
  };
  return (
    <div className="page">
      <div><h1>Settings</h1><p className="hint">Voices, Scout settings and usage details arrive in later milestones.</p></div>
      <section className="sec"><h2>Models</h2>
        <p className="hint">Read-only. In real mode (Milestone 2) models are set in the server's <code>.env</code> file and must be two different IDs.</p>
        <dl className="kv">
          <dt>PROVIDER_MODE</dt><dd>{config?.providerMode ?? '…'}</dd>
          <dt>SPEAKER_A_MODEL</dt><dd>{config?.models.A}</dd>
          <dt>SPEAKER_B_MODEL</dt><dd>{config?.models.B}</dd>
          <dt>Requests today</dt><dd>{config ? `${config.requestsToday} of ${config.dailyLimit} (mock turns count here so you can see the limit work)` : '…'}</dd>
        </dl>
        <p className="hint">The daily limit is a local safety limit set by the app. It is not a billing guarantee from any provider.</p>
      </section>
      <section className="sec"><h2>Prototype controls</h2>
        <label className="toggle"><input type="checkbox" checked={!!config?.mock.failOnce} onChange={e => set({ failOnce: e.target.checked })} /> Simulate a provider failure on turn 5 (once per conversation)</label>
        <label className="toggle"><input type="checkbox" checked={!!config?.mock.fast} onChange={e => set({ fast: e.target.checked })} /> Fast streaming</label>
        <p className="hint">These reset when the server restarts.</p>
      </section>
      <Footer />
    </div>
  );
}

export function ControlRoom() {
  return (
    <div className="page">
      <div><span className="tag">Admin · only you</span><h1>Control room</h1></div>
      <p className="hint">Overview, Live control with producer notes, Publishing approvals, Topics and Rules arrive in Milestone 8.</p>
      <Footer />
    </div>
  );
}
