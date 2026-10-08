import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition, RunState, TransitionError, type RunState as RS } from '../src';

const ALL = RunState.options;
const ALLOWED: [RS, RS][] = [
  ['idle', 'generating'],
  ['generating', 'paused'], ['generating', 'completed'], ['generating', 'cancelled'], ['generating', 'failed'],
  ['paused', 'generating'], ['paused', 'cancelled'],
  ['failed', 'generating'], ['failed', 'cancelled'],
];

describe('run state machine', () => {
  it('allows exactly the moves in the plan', () => {
    for (const from of ALL) for (const to of ALL) {
      const expected = ALLOWED.some(([f, t]) => f === from && t === to);
      expect(canTransition(from, to), `${from} → ${to}`).toBe(expected);
    }
  });

  it('rejects moves out of completed and cancelled', () => {
    for (const to of ALL) {
      expect(() => assertTransition('completed', to)).toThrow(TransitionError);
      expect(() => assertTransition('cancelled', to)).toThrow(TransitionError);
    }
  });

  it('rejects skipping straight from idle to completed', () => {
    expect(() => assertTransition('idle', 'completed')).toThrow("A idle run can't move to completed.");
  });
});
