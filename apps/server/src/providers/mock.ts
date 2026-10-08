import type { MockSettings } from '@crosstalk/shared';
import { mockTurnText } from './mockScripts';
import { AbortedError, ProviderError, type Provider, type TurnOptions, type TurnRequest } from './types';

export type MockTiming = {
  /** Pause before the first word, like a model thinking. */
  thinkMs: (fast: boolean) => number;
  /** Pause between words. */
  wordMs: (fast: boolean) => number;
};

export const DEFAULT_TIMING: MockTiming = {
  thinkMs: fast => (fast ? 150 : 650),
  wordMs: fast => (fast ? 8 : 26 + Math.random() * 40),
};

/** Turns that fail on purpose when the error switch is on. Fails turn 5 once per conversation. */
export const MOCK_FAIL_SEQ = 5;

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new AbortedError());
    if (ms <= 0) return resolve();
    const t = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, ms);
    const onAbort = () => { clearTimeout(t); reject(new AbortedError()); };
    signal.addEventListener('abort', onAbort, { once: true });
  });

/** Scripted turns with simulated streaming, delays and an error switch. Never calls the network. */
export class MockProvider implements Provider {
  readonly name = 'mock';
  private failedOnce = new Set<string>();

  constructor(private settings: () => MockSettings, private timing: MockTiming = DEFAULT_TIMING) {}

  async generateTurn(req: TurnRequest, { onToken, signal }: TurnOptions) {
    const { fast, failOnce } = this.settings();
    const { conversation: c, seq, speaker } = req;
    await wait(this.timing.thinkMs(fast), signal);

    const words = mockTurnText(c.topic, seq, speaker.id, c.temperature).split(' ');
    const failAt = failOnce && seq === MOCK_FAIL_SEQ && !this.failedOnce.has(c.id) ? Math.floor(words.length / 2) : -1;

    let text = '';
    for (let i = 0; i < words.length; i++) {
      if (i === failAt) {
        this.failedOnce.add(c.id);
        throw new ProviderError('Provider timed out (simulated). Earlier turns are saved.', false, null, 504);
      }
      const piece = (i ? ' ' : '') + words[i];
      text += piece;
      onToken(piece);
      await wait(this.timing.wordMs(fast), signal);
    }
    return { text, usage: null };
  }
}
