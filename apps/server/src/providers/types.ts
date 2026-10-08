import type { Conversation, Speaker, Turn } from '@crosstalk/shared';

export type TurnRequest = {
  conversation: Conversation;
  seq: number;
  speaker: Speaker;
  objective: string;
  history: Turn[];
};

export type TurnOptions = {
  onToken: (text: string) => void;
  signal: AbortSignal;
};

/** Anything that can write a turn. Mock now; OpenRouter in Milestone 2. */
export interface Provider {
  readonly name: string;
  generateTurn(req: TurnRequest, opts: TurnOptions): Promise<{ text: string }>;
}

export class ProviderError extends Error {}

export class AbortedError extends Error {
  constructor() { super('Aborted'); }
}
