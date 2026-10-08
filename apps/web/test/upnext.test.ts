import { describe, expect, it } from 'vitest';
import type { ConversationView } from '@crosstalk/shared';
import type { ConversationSummary } from '../src/api/client';
import { pickUpNext } from '../src/studio/UpNext';

const ep = (id: string, episode: number, extra: Partial<ConversationSummary> = {}) =>
  ({ id, episode, title: id, parentId: null, round: 1, turnCount: 16, run: { state: 'completed' }, ...extra }) as unknown as ConversationSummary;
const view = (id: string, nextRound: string | null = null) =>
  ({ id, nextRound: nextRound && { id: nextRound, title: nextRound, episode: 9, round: 2 } }) as unknown as ConversationView;

describe('what Up next plays', () => {
  it('prefers the next round when it is ready', async () => {
    const all = [ep('newest', 5), ep('round2', 3, { round: 2 }), ep('one', 1)];
    expect((await pickUpNext(view('one', 'round2'), all))?.id).toBe('round2');
  });

  it('otherwise the newest finished episode, never this one, a branch or an unfinished one', async () => {
    const all = [
      ep('current', 6), ep('branch', 7, { parentId: 'x' }), ep('generating', 8, { run: { state: 'generating' } as ConversationSummary['run'] }),
      ep('empty', 9, { turnCount: 0 }), ep('older', 2), ep('newer', 4),
    ];
    expect((await pickUpNext(view('current', 'generating'), all))?.id).toBe('newer');
  });

  it('nothing when the shelf is done', async () => {
    expect(await pickUpNext(view('only'), [ep('only', 1)])).toBeNull();
  });
});
