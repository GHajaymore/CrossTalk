// Is the backup really working? The "backed up" label used to mean only that the five settings were
// there. This asks Litestream what the bucket itself holds (`litestream generations` reads the
// replica, not this disk) and reports when it last received a copy, or what went wrong.
import { execFile } from 'node:child_process';

export type BackupState = 'off' | 'checking' | 'ok' | 'failing';
export type BackupStatus = {
  state: BackupState;
  /** The newest copy the bucket holds. */
  lastAt: string | null;
  /** In plain words, when something's wrong. Never contains a key. */
  detail: string | null;
  /** How this run started: brought back from the bucket, or started empty because the bucket had nothing. */
  restore: 'restored' | 'empty' | 'failed' | null;
  checkedAt: string | null;
};

/** The newest "end" time in `litestream generations` output, or null when the bucket has no copies. */
export function newestCopy(stdout: string): string | null {
  let best: string | null = null;
  for (const line of stdout.split('\n').slice(1)) {
    const cols = line.trim().split(/\s+/);
    const end = cols[4];
    if (end && /^\d{4}-\d\d-\d\dT/.test(end) && (!best || end > best)) best = end;
  }
  return best;
}

/** Litestream's error text, with anything that looks like the key or secret taken out. */
export function plainError(text: string, secrets: string[]) {
  // Litestream's log line: keep just its error="…", up to the first escaped newline.
  const logged = /error="((?:[^"\\]|\\.)*)"/.exec(text)?.[1].split('\\n')[0];
  let t = (logged ?? text.split('\n').filter(Boolean).slice(-2).join(' ')).slice(0, 240);
  for (const s of secrets) if (s && s.length >= 4) t = t.split(s).join('…');
  return t || 'Litestream gave no reason.';
}

export class BackupWatch {
  status: BackupStatus;
  private timer: NodeJS.Timeout | null = null;
  private busy: Promise<BackupStatus> | null = null;

  constructor(
    private opts: {
      on: boolean;
      restore: 'restored' | 'empty' | 'failed' | null;
      /** Why the bucket couldn't be read at start, when it couldn't. */
      restoreError?: string | null;
      /** Runs `litestream generations`; resolves with stdout, rejects with stderr. */
      list: () => Promise<string>;
      secrets: string[];
      now?: () => Date;
    },
  ) {
    const detail = opts.restore === 'failed' && opts.restoreError ? plainError(opts.restoreError, opts.secrets) : null;
    this.status = { state: opts.on ? 'checking' : 'off', lastAt: null, detail, restore: opts.restore, checkedAt: null };
  }

  /** Ask the bucket now (one call at a time). */
  check(): Promise<BackupStatus> {
    if (!this.opts.on) return Promise.resolve(this.status);
    this.busy ??= this.opts.list().then(
      out => {
        const lastAt = newestCopy(out);
        return { ...this.status, state: lastAt ? 'ok' : 'failing', lastAt, detail: lastAt ? null : 'The bucket has no copies yet.' } as BackupStatus;
      },
      (e: Error & { stderr?: string }) => ({ ...this.status, state: 'failing', detail: plainError(e.stderr || e.message, this.opts.secrets) } as BackupStatus),
    ).then(s => {
      this.status = { ...s, checkedAt: (this.opts.now?.() ?? new Date()).toISOString() };
      this.busy = null;
      return this.status;
    });
    return this.busy;
  }

  /** Check soon after start (Litestream needs a moment to send the first copy), then every 3 hours: each check spends bucket requests. */
  start(firstMs = 90_000, everyMs = 3 * 3600_000) {
    if (!this.opts.on || this.timer) return;
    this.timer = setTimeout(() => { void this.check(); this.timer = setInterval(() => void this.check(), everyMs); }, firstMs);
    this.timer.unref?.();
  }

  stop() { if (this.timer) { clearTimeout(this.timer); clearInterval(this.timer); this.timer = null; } }
}

/** The real `litestream generations` call, run the same way scripts/start.sh runs Litestream. */
export const litestreamList = (dbPath: string) => () => new Promise<string>((resolve, reject) => {
  execFile('bin/litestream', ['generations', '-config', 'litestream.yml', dbPath], { timeout: 60_000 }, (err, stdout, stderr) => {
    if (err) reject(Object.assign(err, { stderr: String(stderr) }));
    else resolve(String(stdout));
  });
});
