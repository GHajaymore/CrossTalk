// Fail-closed free-model guard (docs/PLAN.md, Cost safety).
// A model passes only if OpenRouter's own model list shows a price of exactly zero AND it is one of
// OpenRouter's ":free" variants. A ":free" suffix alone never passes, and neither does a $0 price alone:
// some $0 models without ":free" still need purchased credits (OpenRouter answers 402).
// OpenRouter's own routers (openrouter/...) pick models for you, so they never pass.

export type ModelPricing = { prompt?: string; completion?: string; request?: string };
export type ModelInfo = { id: string; pricing?: ModelPricing };
export type Verdict = { modelId: string; ok: boolean; reason: string };

export const MODELS_URL = 'https://openrouter.ai/api/v1/models';

/** Exactly zero, and only when written as a number. Missing or unreadable prices are not free. */
const isZero = (v: string | undefined) => v !== undefined && v.trim() !== '' && Number(v) === 0;

export function judge(modelId: string, list: ModelInfo[] | null, listError: string | null, allowPaid: boolean): Verdict {
  if (!list) {
    return allowPaid
      ? { modelId, ok: true, reason: `Couldn't read OpenRouter's model list (${listError}); allowed because ALLOW_PAID_MODELS=true.` }
      : { modelId, ok: false, reason: `Couldn't read OpenRouter's model list (${listError}), so the price can't be checked.` };
  }
  const m = list.find(x => x.id === modelId);
  if (!m) {
    return allowPaid
      ? { modelId, ok: true, reason: 'Not on OpenRouter\'s model list; allowed because ALLOW_PAID_MODELS=true.' }
      : { modelId, ok: false, reason: 'Not on OpenRouter\'s model list. Check the ID on openrouter.ai/models.' };
  }
  if (modelId.startsWith('openrouter/')) {
    return { modelId, ok: false, reason: "OpenRouter's automatic router picks models for you, which CrossTalk never allows. Pick one specific model." };
  }
  const p = m.pricing ?? {};
  const free = isZero(p.prompt) && isZero(p.completion) && (p.request === undefined || isZero(p.request));
  if (free && modelId.endsWith(':free')) return { modelId, ok: true, reason: 'Free: $0 for prompt and completion.' };
  if (free && !allowPaid) {
    return { modelId, ok: false, reason: 'Priced at $0 but not one of OpenRouter\'s ":free" models, so it can still need purchased credits. Pick its ":free" version.' };
  }
  if (free) return { modelId, ok: true, reason: '$0, but not a ":free" model; allowed because ALLOW_PAID_MODELS=true.' };
  const price = `prompt ${p.prompt ?? 'unknown'}, completion ${p.completion ?? 'unknown'} per token`;
  return allowPaid
    ? { modelId, ok: true, reason: `Paid (${price}); allowed because ALLOW_PAID_MODELS=true.` }
    : { modelId, ok: false, reason: `Not free (${price}). Pick a model priced at $0.` };
}

export class FreeModelGuard {
  private cache: { at: number; list: ModelInfo[] } | null = null;
  verdicts: Verdict[] = [];
  checkedAt: string | null = null;

  constructor(
    private fetchFn: typeof fetch,
    private allowPaid: boolean,
    private ttlMs = 10 * 60_000,
    private now: () => number = Date.now,
  ) {}

  private async list(): Promise<{ list: ModelInfo[] | null; error: string | null }> {
    if (this.cache && this.now() - this.cache.at < this.ttlMs) return { list: this.cache.list, error: null };
    try {
      const res = await this.fetchFn(MODELS_URL, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return { list: null, error: `HTTP ${res.status}` };
      const body = (await res.json()) as { data?: ModelInfo[] };
      if (!Array.isArray(body.data)) return { list: null, error: 'unexpected response' };
      this.cache = { at: this.now(), list: body.data };
      return { list: body.data, error: null };
    } catch (e) {
      return { list: null, error: (e as Error).name === 'TimeoutError' ? 'timed out' : 'network error' };
    }
  }

  async check(modelIds: string[]): Promise<Verdict[]> {
    const { list, error } = await this.list();
    this.verdicts = modelIds.map(id => judge(id, list, error, this.allowPaid));
    this.checkedAt = new Date(this.now()).toISOString();
    return this.verdicts;
  }

  /** A message naming each blocked model and why, or null when every model passes. */
  static blockMessage(verdicts: Verdict[]) {
    const bad = verdicts.filter(v => !v.ok);
    return bad.length ? `Blocked by the free-model check: ${bad.map(v => `${v.modelId}: ${v.reason}`).join(' ')}` : null;
  }
}
