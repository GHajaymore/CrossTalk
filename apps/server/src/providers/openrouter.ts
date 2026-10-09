// OpenRouter chat completions with streaming, a timeout and cancellation.
// Always sends exactly one `model`: never the fallback `models` array or an auto router,
// so a model is never silently substituted.
import { z } from 'zod';
import { ROLE_MAX, wholeSentencesOf, wordsIn, type Audience, type Language } from '@crosstalk/shared';
import { buildPrompt, rolesPrompt } from '../prompts/buildPrompt';
import { AbortedError, ProviderError, type Provider, type TurnOptions, type TurnRequest, type Usage } from './types';

export const CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
/** A reply cut off by the length limit is kept, trimmed to whole sentences, only if at least this many words remain. */
export const MIN_WORDS_AFTER_TRIM = 12;

/** Text up to the last sentence ending (. ? ! possibly followed by a closing quote or bracket). */
export function wholeSentences(text: string) {
  return wholeSentencesOf(text);
}

export type OpenRouterOptions = {
  apiKey: string;
  maxOutputTokens: number;
  timeoutMs: number;
  fetch?: typeof fetch;
};

const retryAfterMs = (h: string | null) => {
  if (!h) return null;
  const s = Number(h);
  if (Number.isFinite(s)) return Math.max(0, s * 1000);
  const at = Date.parse(h);
  return Number.isNaN(at) ? null : Math.max(0, at - Date.now());
};

/**
 * OpenRouter's daily cap on free-model requests for the whole account. Not "busy": waiting a minute
 * or retrying won't help until it resets, so it's never retried automatically.
 */
const isDailyCap = (detail: string) => /per[- ]day|daily/i.test(detail);
const dailyCapError = (status: number) => new ProviderError(
  "OpenRouter's free-model limit for today is used up on this account (it counts every app and key). It resets once a day, around midnight UTC. Press Retry after that; nothing is lost.",
  false, null, status);

/** Turns an HTTP failure into a plain message and decides whether one retry is allowed. */
function httpError(status: number, detail: string, retryAfter: string | null): ProviderError {
  const said = detail ? ` (${detail.slice(0, 160)})` : '';
  if (status === 429 && isDailyCap(detail)) return dailyCapError(status);
  if (status === 429) return new ProviderError(`Rate limited by OpenRouter${said}.`, true, retryAfterMs(retryAfter), status);
  if (status >= 500) return new ProviderError(`OpenRouter had a server error ${status}${said}.`, true, null, status);
  if (status === 401) return new ProviderError('OpenRouter rejected the API key. Check OPENROUTER_API_KEY.', false, null, status);
  if (status === 402) return new ProviderError(`OpenRouter says the account balance is too low (402)${said}. Free models can fail this way when credits are negative.`, false, null, status);
  if (status === 404) return new ProviderError(`OpenRouter couldn't find this model (404)${said}.`, false, null, status);
  return new ProviderError(`OpenRouter refused the request (${status})${said}.`, false, null, status);
}

const RoleReply = z.object({ A: z.string().trim().min(3).max(ROLE_MAX), B: z.string().trim().min(3).max(ROLE_MAX) });

export class OpenRouterProvider implements Provider {
  readonly name = 'openrouter';
  private f: typeof fetch;

  constructor(private opts: OpenRouterOptions) {
    this.f = opts.fetch ?? fetch;
  }

  /**
   * Two invented host roles that fit the topic (one short, non-streaming request).
   * Returns null on any problem, so the caller falls back to the keyword rule.
   */
  /** One non-streaming request; returns the reply text. Throws ProviderError on failure. */
  async complete(modelId: string, system: string, user: string, maxTokens: number, timeoutMs = 90_000): Promise<string> {
    let res: Response;
    try {
      res = await this.f(CHAT_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(Math.min(this.opts.timeoutMs * 2, timeoutMs)),
        headers: { Authorization: `Bearer ${this.opts.apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'CrossTalk (local prototype)' },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          max_tokens: maxTokens,
          reasoning: { effort: 'low', exclude: true },
        }),
      });
    } catch (e) {
      throw new ProviderError((e as Error).name === 'TimeoutError' ? 'OpenRouter timed out.' : "Couldn't reach OpenRouter.", true);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let detail = '';
      try { detail = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? ''; } catch { /* not JSON */ }
      throw httpError(res.status, detail, res.headers.get('retry-after'));
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return body.choices?.[0]?.message?.content ?? '';
  }

  async generateRoles(topic: string, audience: Audience, modelId: string): Promise<[string, string] | null> {
    const { system, user } = rolesPrompt(topic, audience);
    try {
      const text = await this.complete(modelId, system, user, 600, 45_000);
      const json = text.match(/\{[\s\S]*\}/)?.[0];
      if (!json) return null;
      const parsed = RoleReply.safeParse(JSON.parse(json));
      return parsed.success ? [parsed.data.A.replace(/[<>]/g, ''), parsed.data.B.replace(/[<>]/g, '')] : null;
    } catch {
      return null;
    }
  }

  async generateTurn(req: TurnRequest, { onToken, signal }: TurnOptions) {
    if (signal.aborted) throw new AbortedError();
    const { system, user } = buildPrompt(req);
    const timeout = AbortSignal.timeout(this.opts.timeoutMs);
    const both = AbortSignal.any([signal, timeout]);
    const fail = (e: unknown): never => {
      if (signal.aborted) throw new AbortedError();
      if (timeout.aborted) throw new ProviderError(`OpenRouter timed out after ${Math.round(this.opts.timeoutMs / 1000)} s.`, true, null, null);
      if (e instanceof ProviderError) throw e;
      throw new ProviderError("Couldn't reach OpenRouter (network error).", true, null, null);
    };

    let res: Response;
    try {
      res = await this.f(CHAT_URL, {
        method: 'POST',
        signal: both,
        headers: {
          Authorization: `Bearer ${this.opts.apiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'CrossTalk (local prototype)',
        },
        body: JSON.stringify({
          model: req.speaker.modelId,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          stream: true,
          max_tokens: this.opts.maxOutputTokens,
          // Many free models "think" before they speak, and that counts against max_tokens.
          // Keep it short and out of the reply; models without thinking ignore this.
          reasoning: { effort: 'low', exclude: true },
          usage: { include: true },
        }),
      });
    } catch (e) { return fail(e); }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let detail = '';
      try { detail = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? ''; } catch { /* not JSON */ }
      throw httpError(res.status, detail, res.headers.get('retry-after'));
    }
    if (!res.body) throw new ProviderError('OpenRouter sent an empty response.', true);

    let text = '';
    let usage: Usage | null = null;
    let cutOff = false;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith('data:')) continue; // comments such as ": OPENROUTER PROCESSING"
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          let chunk: {
            error?: { message?: string; code?: number };
            choices?: { delta?: { content?: string }; finish_reason?: string | null }[];
            usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
          };
          try { chunk = JSON.parse(data); } catch { continue; }
          if (chunk.error) {
            const code = Number(chunk.error.code) || 0;
            if (code === 429 && isDailyCap(chunk.error.message ?? '')) throw dailyCapError(code);
            throw new ProviderError(`OpenRouter stopped mid-turn: ${chunk.error.message ?? 'unknown error'}.`, code === 429 || code >= 500, null, code || null);
          }
          if (chunk.choices?.[0]?.finish_reason === 'length') cutOff = true;
          const piece = chunk.choices?.[0]?.delta?.content;
          if (piece) { text += piece; onToken(piece); }
          if (chunk.usage) {
            usage = {
              tokensIn: chunk.usage.prompt_tokens ?? null,
              tokensOut: chunk.usage.completion_tokens ?? null,
              costUsd: typeof chunk.usage.cost === 'number' ? chunk.usage.cost : null,
            };
          }
        }
      }
    } catch (e) { reader.cancel().catch(() => {}); return fail(e); }

    if (!text.trim()) throw new ProviderError('OpenRouter returned no text for this turn (the model may have used its whole allowance thinking).', true);
    if (cutOff) {
      // Never save half a sentence: keep whole sentences if enough is left, otherwise try again.
      const whole = wholeSentences(text);
      if (wordsIn(whole) < MIN_WORDS_AFTER_TRIM) {
        throw new ProviderError('The reply was cut off by the length limit before it said enough.', true);
      }
      return { text: whole, usage };
    }
    return { text: text.trim(), usage };
  }
}
