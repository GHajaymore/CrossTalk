import type { RunState } from './schemas';

/**
 * Every allowed move between run states (docs/PLAN.md, "Run states").
 * Paused and failed runs can continue; completed and cancelled runs cannot.
 */
export const RUN_TRANSITIONS: Record<RunState, readonly RunState[]> = {
  idle: ['generating'],
  generating: ['paused', 'completed', 'cancelled', 'failed'],
  paused: ['generating', 'cancelled'],
  failed: ['generating', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const canTransition = (from: RunState, to: RunState) => RUN_TRANSITIONS[from].includes(to);

export class TransitionError extends Error {
  constructor(public from: RunState, public to: RunState) {
    super(`A ${from} run can't move to ${to}.`);
  }
}

export function assertTransition(from: RunState, to: RunState) {
  if (!canTransition(from, to)) throw new TransitionError(from, to);
}

export const isTerminal = (s: RunState) => RUN_TRANSITIONS[s].length === 0;
