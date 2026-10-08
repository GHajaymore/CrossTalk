import { useState } from 'react';
import { api, type Access } from '../api/client';

/** The door of a hosted CrossTalk. The code is checked by the server; this page never stores it. */
export function Lock({ onOpen }: { onOpen: (a: Access) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { onOpen(await api.unlock(code)); } catch (err) { setError((err as Error).message); setCode(''); } finally { setBusy(false); }
  };
  return (
    <main className="wrap lock">
      <form className="lock-card" onSubmit={submit}>
        <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /></span>CrossTalk</div>
        <span className="tag">An Ajai Labs studio · private</span>
        <label className="fld">
          <span>Access code</span>
          <input type="password" autoComplete="current-password" autoFocus value={code} onChange={e => setCode(e.target.value)} />
        </label>
        {error && <p className="lock-error" role="alert">✕ {error}</p>}
        <button className="btn primary" disabled={busy || !code.trim()}>{busy ? 'Checking…' : 'Open the studio'}</button>
        <p className="hint">This device stays signed in for 30 days.</p>
      </form>
    </main>
  );
}
