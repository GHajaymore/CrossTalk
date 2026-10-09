import type { AppConfig } from '@crosstalk/shared';

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
