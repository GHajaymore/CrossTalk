// Chat completions with streaming, a timeout and cancellation, from one free service: OpenRouter or
// Groq (both speak the same OpenAI-style API). Always sends exactly one `model`: never a fallback
// `models` array or an auto router, so a model is never silently substituted.
import { z } from 'zod';
import { ROLE_MAX, wholeSentencesOf, wordsIn, type Audience, type Language } from '@crosstalk/shared';
import { buildPrompt, rolesPrompt } from '../prompts/buildPrompt';
import { AbortedError, ProviderError, type Provider, type TurnOptions, type TurnRequest, type Usage } from './types';

export const CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** A service that serves the hosts' models. */
export type ChatService = { id: 'openrouter' | 'groq'; label: string; url: string; keyName: string; resets: string };
export const SERVICES: Record<ChatService['id'], ChatService> = {
  openrouter: { id: 'openrouter', label: 'OpenRouter', url: CHAT_URL, keyName: 'OPENROUTER_API_KEY', resets: 'It resets once a day, around midnight UTC.' },
  groq: { id: 'groq', label: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', keyName: 'GROQ_API_KEY', resets: 'Groq counts each model over a rolling day, so it frees up gradually.' },
};

/** Some models think out loud in <think>…</think> before answering; that is never part of the line. */
export const stripThinking = (text: string) => text.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').replace(/^\s+/, '');
/** A reply cut off by the length limit is kept, trimmed to whole sentences, only if at least this many words remain. */
export const MIN_WORDS_AFTER_TRIM = 12;

/** Text up to the last sentence ending (. ? ! possibly followed by a closing quote or bracket). */
export function wholeSentences(text: string) {
  return wholeSentencesOf(text);
}

export type OpenRouterOptions = {
  apiKey: string;
  /** Which service to call. OpenRouter when left out. */
  service?: ChatService;
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
const dailyCapError = (svc: ChatService, status: number) => new ProviderError(
  `${svc.label}'s free-model limit for today is used up on this account (it counts every app and key). ${svc.resets} Press Retry after that; nothing is lost.`,
  false, null, status);

/** Turns an HTTP failure into a plain message and decides whether one retry is allowed. */
function httpError(svc: ChatService, status: number, detail: string, retryAfter: string | null): ProviderError {
  const said = detail ? ` (${detail.slice(0, 160)})` : '';
  const L = svc.label;
  if (status === 429 && isDailyCap(detail)) return dailyCapError(svc, status);
  if (status === 429) return new ProviderError(`Rate limited by ${L}${said}.`, true, retryAfterMs(retryAfter), status);
  if (status >= 500) return new ProviderError(`${L} had a server error ${status}${said}.`, true, null, status);
  if (status === 401) return new ProviderError(`${L} rejected the API key. Check ${svc.keyName}.`, false, null, status);
  if (status === 402) return new ProviderError(`${L} says the account balance is too low (402)${said}. Free models can fail this way when credits are negative.`, false, null, status);
  if (status === 404) return new ProviderError(`${L} couldn't find this model (404)${said}.`, false, null, status);
  return new ProviderError(`${L} refused the request (${status})${said}.`, false, null, status);
}

const RoleReply = z.object({ A: z.string().trim().min(3).max(ROLE_MAX), B: z.string().trim().min(3).max(ROLE_MAX) });

export class OpenRouterProvider implements Provider {
  readonly name: string;
  private f: typeof fetch;
  private svc: ChatService;

  constructor(private opts: OpenRouterOptions) {
    this.f = opts.fetch ?? fetch;
    this.svc = opts.service ?? SERVICES.openrouter;
    this.name = this.svc.id;
  }

  /**
   * Service-specific request fields. OpenRouter: short hidden thinking, and the cost in the usage
   * report. Groq: its gpt-oss models are asked to think briefly so the thinking doesn't use up the
   * turn's tokens. Other Groq models may refuse the field, so they never get it; any <think> text
   * they write is dropped instead.
   */
  private extras(stream: boolean, modelId: string) {
    if (this.svc.id === 'groq') return /(^|\/)gpt-oss/i.test(modelId) ? { reasoning_effort: 'low' } : {};
    if (this.svc.id !== 'openrouter') return {};
    return stream ? { reasoning: { effort: 'low', exclude: true }, usage: { include: true } } : { reasoning: { effort: 'low', exclude: true } };
  }

  /**
   * Two invented host roles that fit the topic (one short, non-streaming request).
   * Returns null on any problem, so the caller falls back to the keyword rule.
   */
  /** One non-streaming request; returns the reply text. Throws ProviderError on failure. */
  async complete(modelId: string, system: string, user: string, maxTokens: number, timeoutMs = 90_000): Promise<string> {
    let res: Response;
    try {
      res = await this.f(this.svc.url, {
        method: 'POST',
        signal: AbortSignal.timeout(Math.min(this.opts.timeoutMs * 2, timeoutMs)),
        headers: { Authorization: `Bearer ${this.opts.apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'CrossTalk (local prototype)' },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          max_tokens: maxTokens,
          ...this.extras(false, modelId),
        }),
      });
    } catch (e) {
      throw new ProviderError((e as Error).name === 'TimeoutError' ? `${this.svc.label} timed out.` : `Couldn't reach ${this.svc.label}.`, true);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let detail = '';
      try { detail = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? ''; } catch { /* not JSON */ }
      throw httpError(this.svc, res.status, detail, res.headers.get('retry-after'));
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return stripThinking(body.choices?.[0]?.message?.content ?? '');
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
      if (timeout.aborted) throw new ProviderError(`${this.svc.label} timed out after ${Math.round(this.opts.timeoutMs / 1000)} s.`, true, null, null);
      if (e instanceof ProviderError) throw e;
      throw new ProviderError(`Couldn't reach ${this.svc.label} (network error).`, true, null, null);
    };

    let res: Response;
    try {
      res = await this.f(this.svc.url, {
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
          // On OpenRouter keep it short and out of the reply; on Groq any <think> block is dropped below.
          ...this.extras(true, req.speaker.modelId),
        }),
      });
    } catch (e) { return fail(e); }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let detail = '';
      try { detail = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? ''; } catch { /* not JSON */ }
      throw httpError(this.svc, res.status, detail, res.headers.get('retry-after'));
    }
    if (!res.body) throw new ProviderError(`${this.svc.label} sent an empty response.`, true);

    let text = '';
    let raw = '';
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
            x_groq?: { usage?: { prompt_tokens?: number; completion_tokens?: number } };
          };
          try { chunk = JSON.parse(data); } catch { continue; }
          if (chunk.error) {
            const code = Number(chunk.error.code) || 0;
            if (code === 429 && isDailyCap(chunk.error.message ?? '')) throw dailyCapError(this.svc, code);
            throw new ProviderError(`${this.svc.label} stopped mid-turn: ${chunk.error.message ?? 'unknown error'}.`, code === 429 || code >= 500, null, code || null);
          }
          if (chunk.choices?.[0]?.finish_reason === 'length') cutOff = true;
          const piece = chunk.choices?.[0]?.delta?.content;
          if (piece) {
            raw += piece;
            // Show only what's after any <think> block, as it arrives.
            const shown = /^\s*<(t(h(i(n(k)?)?)?)?)?$/.test(raw) ? '' : stripThinking(raw);
            if (shown.length > text.length && shown.startsWith(text)) { onToken(shown.slice(text.length)); text = shown; }
          }
          const u = chunk.usage ?? chunk.x_groq?.usage;
          if (u) {
            usage = {
              tokensIn: u.prompt_tokens ?? null,
              tokensOut: u.completion_tokens ?? null,
              costUsd: typeof (u as { cost?: number }).cost === 'number' ? (u as { cost: number }).cost : null,
            };
          }
        }
      }
    } catch (e) { reader.cancel().catch(() => {}); return fail(e); }

    text = stripThinking(raw);
    if (!text.trim()) throw new ProviderError(`${this.svc.label} returned no text for this turn (the model may have used its whole allowance thinking).`, true);
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
