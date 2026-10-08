import { MAX_TURNS, type MockSettings } from '@crosstalk/shared';
import { ConversationController, type ControllerOptions } from '../src/controller/controller';
import { openDb, Repo } from '../src/db/repo';
import { MockProvider, type MockTiming } from '../src/providers/mock';

export const INSTANT: MockTiming = { thinkMs: () => 0, wordMs: () => 0 };
export const QUICK: MockTiming = { thinkMs: () => 1, wordMs: () => 1 };

export const draft = (topic = 'Is a four-day workweek practical?') => ({
  topic, mode: 'explore' as const, format: 'recorded' as const, audience: 'general' as const, temperature: 'lively' as const,
  speakers: {
    A: { name: '', autoName: true, persona: 'optimist' as const, autoPersona: true, lens: '', role: '', autoRole: true },
    B: { name: '', autoName: true, persona: 'skeptic' as const, autoPersona: true, lens: '', role: '', autoRole: true },
  },
});

export function setup(opts: { timing?: MockTiming; mock?: Partial<MockSettings>; controller?: Partial<ControllerOptions>; file?: string } = {}) {
  const repo = new Repo(openDb(opts.file ?? ':memory:'));
  const mock: MockSettings = { failOnce: false, fast: true, ...opts.mock };
  const provider = new MockProvider(() => mock, opts.timing ?? INSTANT);
  const controller = new ConversationController(repo, provider, {
    maxTurns: MAX_TURNS, dailyLimit: 40, models: { A: 'mock/wren-v1', B: 'mock/hale-v1' }, ...opts.controller,
  });
  return { repo, provider, controller, mock };
}

/** Resolves once the given turn has been saved. */
export const turnSaved = (c: ConversationController, id: string, seq: number) =>
  new Promise<void>(resolve => {
    const off = c.subscribe(id, e => { if (e.type === 'turn-end' && e.seq === seq) { off(); resolve(); } });
  });

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
