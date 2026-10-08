import type { SpeakerId } from '@crosstalk/shared';

/** One thing to say: a turn, voiced as its speaker. */
export type SpeechItem = { key: string; speakerId: SpeakerId; text: string };

export type SpeechHandlers = {
  /** A new piece of text started (for captions). */
  onChunk?: (item: SpeechItem, text: string) => void;
  /** Roughly every spoken word (for the voice meter). */
  onWord?: (item: SpeechItem) => void;
  /** A whole item finished. */
  onItemEnd?: (item: SpeechItem) => void;
  /** Everything finished, or playback was stopped. */
  onDone?: () => void;
};

export type PlaybackState = 'idle' | 'speaking' | 'paused';

/** Speech is a presentation layer, separate from generation. Browser voices now; studio voices later. */
export interface SpeechProvider {
  readonly available: boolean;
  speak(items: SpeechItem[], handlers: SpeechHandlers): void;
  pause(): void;
  resume(): void;
  stop(): void;
}
