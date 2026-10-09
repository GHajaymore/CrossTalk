import { DAILY_LIMIT_DEFAULT, MAX_TURNS } from '@crosstalk/shared';

const int = (v: string | undefined, d: number) => (v && /^\d+$/.test(v.trim()) ? Number(v.trim()) : d);
const str = (v: string | undefined) => (v ?? '').trim();
export const ACCESS_CODE_MIN = 8;

export type ServerConfig = ReturnType<typeof loadConfig>;

/**
 * Reads settings from the environment (and the repo's .env file, loaded in index.ts).
 * Never throws for missing real-mode settings: the server starts and the UI explains what's missing.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const mode = str(env.PROVIDER_MODE).toLowerCase() || 'mock';
  if (mode !== 'mock' && mode !== 'openrouter' && mode !== 'groq') {
    throw new Error(`PROVIDER_MODE=${mode} isn't supported. Use mock, openrouter or groq.`);
  }
  // Real models come from one free service: OpenRouter (free ":free" models) or Groq (its Free plan).
  const real = mode !== 'mock';
  const groq = mode === 'groq';
  const models = real
    ? { A: str(env.SPEAKER_A_MODEL), B: str(env.SPEAKER_B_MODEL) }
    // Mock IDs, shown in the UI like real model IDs. Not real models.
    : { A: 'mock/wren-v1', B: 'mock/hale-v1' };
  const artistModel = real ? str(env.ARTIST_MODEL) || null : null;
  const keyName = groq ? 'GROQ_API_KEY' : 'OPENROUTER_API_KEY';
  const apiKey = real ? str(env[keyName]) : '';

  // Problems that block every real run until fixed. Each names what to change.
  const problems: string[] = [];
  if (real) {
    if (!apiKey) problems.push(`${keyName} is not set.`);
    // Groq has no price list to check, so its Free plan (no card on the account) is what keeps every
    // request free. The owner confirms it once; without that, nothing runs.
    if (groq && str(env.GROQ_PLAN).toLowerCase() !== 'free') problems.push('Set GROQ_PLAN=free to confirm your Groq account is on the Free plan (no card added), so no request can ever be charged.');
    if (!models.A) problems.push('SPEAKER_A_MODEL is not set.');
    if (!models.B) problems.push('SPEAKER_B_MODEL is not set.');
    if (models.A && models.A === models.B) problems.push('Speaker A and Speaker B must use different models.');
    if (artistModel && (artistModel === models.A || artistModel === models.B)) problems.push('ARTIST_MODEL must differ from both speaker models.');
  }

  // Reachable from other machines (e.g. hosted on Render) with real models means it must be locked with an
  // access code: that's where a key and the free request budget live. Mock mode has neither, so it stays
  // open (owner's decision, Oct 8, 2026); the lock returns by itself with real models (openrouter or groq).
  const host = str(env.HOST) || '127.0.0.1';
  const accessCode = real ? str(env.ACCESS_CODE) : '';
  const local = host === '127.0.0.1' || host === 'localhost' || host === '::1';
  if (real && !local && accessCode.length < ACCESS_CODE_MIN) {
    throw new Error(`HOST=${host} with real models makes CrossTalk reachable from other machines, so ACCESS_CODE must be set (at least ${ACCESS_CODE_MIN} characters).`);
  }
  if (accessCode && accessCode.length < ACCESS_CODE_MIN) throw new Error(`ACCESS_CODE must be at least ${ACCESS_CODE_MIN} characters.`);
  // The Control room is always locked online, in every mode: ADMIN_CODE, or ACCESS_CODE if that's all there is.
  if (str(env.ADMIN_CODE) && str(env.ADMIN_CODE).length < ACCESS_CODE_MIN) throw new Error(`ADMIN_CODE must be at least ${ACCESS_CODE_MIN} characters.`);
  const adminCode = [str(env.ADMIN_CODE), str(env.ACCESS_CODE)].find(c => c.length >= ACCESS_CODE_MIN) ?? null;

  return {
    providerMode: mode as 'mock' | 'openrouter' | 'groq',
    /** The env var the key is read from, for messages (never the key itself). */
    keyName,
    host,
    accessCode: accessCode || null,
    /** Reachable from other machines (hosted). */
    hosted: !local,
    /** Set by scripts/start.sh while Litestream is backing up the database. */
    backup: str(env.CROSSTALK_BACKUP) === 'on',
    adminCode,
    // The built web app, served by this server when it exists (one process to host).
    webDir: str(env.WEB_DIR) || new URL('../../web/dist', import.meta.url).pathname,
    port: int(env.PORT, 8787),
    dbPath: str(env.DB_PATH) || new URL('../data/crosstalk.sqlite', import.meta.url).pathname,
    dailyLimit: int(env.MAX_REQUESTS_PER_DAY, DAILY_LIMIT_DEFAULT),
    maxTurns: Math.min(int(env.MAX_TURNS_PER_RUN, MAX_TURNS), MAX_TURNS),
    models,
    artistModel,
    apiKey,
    allowPaidModels: str(env.ALLOW_PAID_MODELS).toLowerCase() === 'true',
    // Room for a 70-120 word reply plus a short hidden "thinking" step that many free models take first.
    maxOutputTokens: int(env.MAX_OUTPUT_TOKENS_PER_TURN, 1000),
    requestTimeoutMs: int(env.REQUEST_TIMEOUT_MS, 60_000),
    // Topic Scout: when it runs each day (server time; set TZ for your time zone), and which RSS feeds it reads.
    scoutTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(str(env.SCOUT_TIME)) ? str(env.SCOUT_TIME) : '07:00',
    scoutFeeds: str(env.SCOUT_RSS_FEEDS).split(',').map(x => x.trim()).filter(x => /^https?:\/\//.test(x)),
    // Photo portraits of the hosts (a free image service). PORTRAITS=off keeps the drawn ones only.
    portraits: str(env.PORTRAITS).toLowerCase() !== 'off',
    irisPictures: str(env.IRIS_PICTURES).toLowerCase() !== 'off',
    problems,
  };
}

// Tests never serve a web build, whether or not one has been built.
export const mockConfig = (over: Partial<ServerConfig> = {}): ServerConfig => ({ ...loadConfig({ PROVIDER_MODE: 'mock' }), webDir: '', ...over });
