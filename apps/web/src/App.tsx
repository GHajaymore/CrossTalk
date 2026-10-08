import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppConfig } from '@crosstalk/shared';
import { api, type Access } from './api/client';
import { Lock } from './screens/Lock';
import { Create } from './screens/Create';
import { IrisPage } from './screens/Iris';
import { Episodes } from './screens/Episodes';
import { ControlRoom, Settings } from './screens/Others';
import { Studio, STUDIO_TABS, type StudioTab } from './screens/Studio';

// Routes live in the URL hash (#/studio/<id>/<tab>), so a refresh reopens the same discussion and view.
const parse = (h: string) => {
  const [route = 'create', id = null, view = null] = h.replace(/^#\/?/, '').split('/') as [string?, string?, string?];
  const tab: StudioTab = STUDIO_TABS.some(([k]) => k === view) ? view as StudioTab : 'watch';
  return { route: route === 'library' ? 'episodes' : route || 'create', id, tab };
};

const NAV: [string, string][] = [['create', 'Create'], ['studio', 'Studio'], ['episodes', 'Episodes'], ['iris', 'Iris'], ['settings', 'Settings'], ['control', 'Control room']];

export function App() {
  const [loc, setLoc] = useState(() => parse(location.hash));
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number>();
  const lastStudio = useRef<string | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  useEffect(() => {
    const check = () => api.access().then(setAccess).catch(() => setAccess({ required: false, ok: true }));
    check();
    addEventListener('crosstalk:locked', check);
    return () => removeEventListener('crosstalk:locked', check);
  }, []);
  const unlocked = !!access && (!access.required || access.ok);

  useEffect(() => {
    const on = () => { setLoc(parse(location.hash)); window.scrollTo(0, 0); };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);

  const refreshConfig = useCallback(() => { api.config().then(setConfig).catch(() => {}); }, []);
  useEffect(() => { if (unlocked) refreshConfig(); }, [loc.route, refreshConfig, unlocked]);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);
  const go = (hash: string) => { location.hash = hash; };

  // "Studio" with no id opens the active discussion, else the last one you had open, else the newest.
  useEffect(() => {
    if (!unlocked || loc.route !== 'studio' || loc.id) return;
    const target = config?.activeConversationId ?? lastStudio.current;
    if (target) { go(`#/studio/${target}`); return; }
    api.list().then(l => { if (l[0]) go(`#/studio/${l[0].id}`); else go('#/create'); }).catch(() => go('#/create'));
  }, [loc, config?.activeConversationId, unlocked]);
  if (loc.route === 'studio' && loc.id) lastStudio.current = loc.id;

  if (!access) return <main className="wrap"><div className="empty-stage">Opening CrossTalk…</div></main>;
  if (!unlocked) return <Lock onOpen={setAccess} />;

  let screen;
  if (loc.route === 'studio') screen = loc.id ? <Studio key={loc.id} id={loc.id} tab={loc.tab} config={config} refreshConfig={refreshConfig} toast={toast} /> : <div className="empty-stage">Opening the studio…</div>;
  else if (loc.route === 'episodes') screen = <Episodes config={config} toast={toast} />;
  else if (loc.route === 'iris') screen = <IrisPage config={config} />;
  else if (loc.route === 'settings') screen = <Settings config={config} refreshConfig={refreshConfig} />;
  else if (loc.route === 'control') screen = <ControlRoom config={config} />;
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
            {config?.providerMode === 'openrouter'
              ? <span className="pill real" title="Real AI models via OpenRouter, free models only">Real models</span>
              : <span className="pill mock" title="Scripted sample text. No model is called.">Mock mode</span>}
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
