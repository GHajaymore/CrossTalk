import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppConfig } from '@crosstalk/shared';
import { api } from './api/client';
import { Create } from './screens/Create';
import { ControlRoom, Library, Settings } from './screens/Others';
import { Studio } from './screens/Studio';

// Routes live in the URL hash (#/studio/<id>), so a refresh reopens the same discussion.
const parse = (h: string) => {
  const [route = 'create', id = null] = h.replace(/^#\/?/, '').split('/') as [string?, string?];
  return { route: route || 'create', id };
};

const NAV: [string, string][] = [['create', 'Create'], ['studio', 'Studio'], ['library', 'Library'], ['settings', 'Settings'], ['control', 'Control room']];

export function App() {
  const [loc, setLoc] = useState(() => parse(location.hash));
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number>();
  const lastStudio = useRef<string | null>(null);

  useEffect(() => {
    const on = () => { setLoc(parse(location.hash)); window.scrollTo(0, 0); };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);

  const refreshConfig = useCallback(() => { api.config().then(setConfig).catch(() => {}); }, []);
  useEffect(refreshConfig, [loc.route, refreshConfig]);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);
  const go = (hash: string) => { location.hash = hash; };

  // "Studio" with no id opens the active discussion, else the last one you had open, else the newest.
  useEffect(() => {
    if (loc.route !== 'studio' || loc.id) return;
    const target = config?.activeConversationId ?? lastStudio.current;
    if (target) { go(`#/studio/${target}`); return; }
    api.list().then(l => { if (l[0]) go(`#/studio/${l[0].id}`); else go('#/create'); }).catch(() => go('#/create'));
  }, [loc, config?.activeConversationId]);
  if (loc.route === 'studio' && loc.id) lastStudio.current = loc.id;

  let screen;
  if (loc.route === 'studio') screen = loc.id ? <Studio key={loc.id} id={loc.id} config={config} refreshConfig={refreshConfig} toast={toast} /> : <div className="empty-stage">Opening the studio…</div>;
  else if (loc.route === 'library') screen = <Library />;
  else if (loc.route === 'settings') screen = <Settings config={config} refreshConfig={refreshConfig} />;
  else if (loc.route === 'control') screen = <ControlRoom />;
  else screen = <Create config={config} go={go} refreshConfig={refreshConfig} toast={toast} />;

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /></span>CrossTalk</div>
          <nav aria-label="Main">
            {NAV.map(([r, l]) => (
              <a key={r} href={`#/${r}`} className={r === 'control' ? 'admin-nav' : undefined} aria-current={loc.route === r ? 'page' : undefined}>{l}</a>
            ))}
          </nav>
          <div className="top-right">
            <span className="pill mock" title="Scripted sample text. No model is called.">Mock mode</span>
            <span className="pill" title="App-side safety limit, not a billing guarantee">
              App limit {config?.requestsToday ?? 0} / {config?.dailyLimit ?? 40} today
            </span>
          </div>
        </div>
      </header>
      <main className="wrap">{screen}</main>
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </>
  );
}
