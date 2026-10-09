import type { Conversation, Intervention, ScoutTopic, Speaker, SpeakerId, Turn } from '@crosstalk/shared';

/** Round two: what the hosts remember from the round before. */
export type LastRound = {
  /** The round being made now (2, 3…). */
  round: number;
  /** Where each host started and ended last round (0 no, 100 yes). */
  stances: Record<SpeakerId, { start: number | null; end: number | null }>;
  /** The lines that say where they got to: concessions, common ground, what was open, the takeaway. */
  lines: { speakerId: SpeakerId; job: string; text: string }[];
  /** What listeners challenged them with, or said on air. */
  listener: string[];
};

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
  /** Round two and later: the round before, so they pick up where they left off. */
  lastRound?: LastRound | null;
};

export type TurnOptions = {
  onToken: (text: string) => void;
  signal: AbortSignal;
};

/** Token counts and cost when the provider reports them. Missing means unknown, never zero. */
export type Usage = { tokensIn: number | null; tokensOut: number | null; costUsd: number | null };

/** Anything that can write a turn: MockProvider or OpenRouterProvider (OpenRouter or Groq). */
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
