// Groq's guard. Groq publishes no prices through its API, so what keeps every request free is the
// account's Free plan (no card), which the owner confirms with GROQ_PLAN=free (see config.ts).
// This check makes sure each model is one Groq actually serves to this key right now, fail-closed:
// if the list can't be read, nothing runs.
import type { Verdict } from './freeModelGuard';

export const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models';

type GroqModel = { id: string; active?: boolean };

export class GroqModelGuard {
  verdicts: Verdict[] = [];
  checkedAt: string | null = null;
  private cache: { at: number; ids: Set<string> } | null = null;

  constructor(private fetchFn: typeof fetch, private apiKey: string, private ttlMs = 10 * 60_000, private now: () => number = Date.now) {}

  private async list(): Promise<{ ids: Set<string> | null; error: string | null }> {
    if (this.cache && this.now() - this.cache.at < this.ttlMs) return { ids: this.cache.ids, error: null };
    try {
      const res = await this.fetchFn(GROQ_MODELS_URL, { headers: { Authorization: `Bearer ${this.apiKey}` }, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return { ids: null, error: `HTTP ${res.status}` };
      const body = (await res.json()) as { data?: GroqModel[] };
      if (!Array.isArray(body.data)) return { ids: null, error: 'unexpected response' };
      const ids = new Set(body.data.filter(m => m.active !== false).map(m => m.id));
      this.cache = { at: this.now(), ids };
      return { ids, error: null };
    } catch (e) {
      return { ids: null, error: (e as Error).name === 'TimeoutError' ? 'timed out' : 'network error' };
    }
  }

  async check(modelIds: string[]): Promise<Verdict[]> {
    const { ids, error } = await this.list();
    this.verdicts = modelIds.map(modelId => !ids
      ? { modelId, ok: false, reason: `Couldn't read Groq's model list (${error}), so the model can't be checked.` }
      : ids.has(modelId)
        ? { modelId, ok: true, reason: 'Served by Groq on your Free plan.' }
        : { modelId, ok: false, reason: "Not on Groq's list of models for this key. Check the ID on console.groq.com/docs/models." });
    this.checkedAt = new Date(this.now()).toISOString();
    return this.verdicts;
  }
}
