import type { AppConfig } from '@crosstalk/shared';

/** "3 min ago", for the backup's last copy. */
export function ago(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 90) return 'just now';
  if (s < 90 * 60) return `${Math.round(s / 60)} min ago`;
  if (s < 36 * 3600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

/**
 * Online, episodes only last if they're backed up. Says so plainly when there's no backup, or when
 * copies aren't reaching the bucket, so it's never a surprise after a restart.
 */
export function StorageBanner({ config }: { config: AppConfig | null }) {
  if (!config || config.storage === 'local') return null;
  if (config.storage === 'forgets') {
    return (
      <div className="banner" role="alert">
        <span><b>Not backed up.</b> Online, the server forgets every episode and drawing when it restarts, sleeps or updates. Add the free backup: docs/DEPLOY.md → Keep episodes for good.</span>
      </div>
    );
  }
  if (config.storage === 'paused') {
    return (
      <div className="banner" role="alert">
        <span><b>Backup paused: your saved episodes aren't loaded.</b> The bucket couldn't be read when the server started, so they're safe in it but not shown, and anything new isn't backed up. Restart the server once the bucket is reachable.</span>
        <a className="btn sm" href="#/settings">What to do</a>
      </div>
    );
  }
  if (config.backup.state !== 'failing') return null;
  return (
    <div className="banner" role="alert">
      <span><b>The backup isn't reaching your bucket.</b> New episodes will be lost at the next restart until it's fixed.
        {config.backup.detail && <> What Litestream says: <code>{config.backup.detail}</code></>} Check the five BACKUP_ settings in Render.</span>
      <a className="btn sm" href="#/settings">Open Settings</a>
    </div>
  );
}

/** Shown when the app's own daily request limit is used up. */
export function BudgetBanner({ config }: { config: AppConfig | null }) {
  if (!config || config.requestsToday < config.dailyLimit) return null;
  return (
    <div className="banner" role="alert">
      <span><b>Daily limit reached.</b> {config.requestsToday} of {config.dailyLimit} requests used today. New turns can start again tomorrow. This is the app's own safety limit, not a bill.</span>
    </div>
  );
}

/** Real-mode settings or models that block every run, each with what to change. */
export function SetupBanner({ config, onSettings = false }: { config: AppConfig | null; onSettings?: boolean }) {
  if (!config || config.providerMode === 'mock') return null;
  const blocked = config.guard.verdicts.filter(v => !v.ok);
  if (!config.problems.length && !blocked.length) return null;
  return (
    <div className="banner" role="alert">
      <span><b>Real mode is blocked.</b> {config.problems.length ? 'Fix these in the server\'s settings, then restart the server:' : 'Change the model in the server\'s settings, or press Check models again in Settings:'}
        <ul>
          {config.problems.map(p => <li key={p}>{p}</li>)}
          {blocked.map(v => <li key={v.modelId}><code>{v.modelId}</code>: {v.reason}</li>)}
        </ul>
      </span>
      {!onSettings && <a className="btn sm" href="#/settings">Open Settings</a>}
    </div>
  );
}

/** Real mode can't start until settings are complete and both models are known to be free. */
export const realBlocked = (c: AppConfig | null) =>
  !!c && c.providerMode !== 'mock' && (c.problems.length > 0 || c.guard.verdicts.some(v => !v.ok));
