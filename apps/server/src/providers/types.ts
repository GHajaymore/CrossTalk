import type { Conversation, Intervention, ScoutTopic, Speaker, Turn } from '@crosstalk/shared';

export type TurnRequest = {
  conversation: Conversation;
  seq: number;
  speaker: Speaker;
  objective: string;
  history: Turn[];
  /** Listener cues: queued ones land on this turn; applied guest lines are part of the history. */
  cues?: Intervention[];
  /** The Scout's brief: the only facts the hosts know about recent events. */
  brief?: ScoutTopic | null;
};

export type TurnOptions = {
  onToken: (text: string) => void;
  signal: AbortSignal;
};

/** Token counts and cost when the provider reports them. Missing means unknown, never zero. */
export type Usage = { tokensIn: number | null; tokensOut: number | null; costUsd: number | null };

/** Anything that can write a turn: MockProvider or OpenRouterProvider. */
export interface Provider {
  readonly name: string;
  generateTurn(req: TurnRequest, opts: TurnOptions): Promise<{ text: string; usage: Usage | null }>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    /** Timeouts, 429 and 5xx may be retried once. */
    public retryable = false,
    /** From a 429's Retry-After header. */
    public retryAfterMs: number | null = null,
    public status: number | null = null,
  ) { super(message); }
}

export class AbortedError extends Error {
  constructor() { super('Aborted'); }
}
