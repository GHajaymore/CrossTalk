import { describe, expect, it } from 'vitest';
import { JOBS, MAX_TURNS } from '@crosstalk/shared';
import { ControllerError } from '../src/controller/controller';
import { draft, QUICK, setup, sleep, turnSaved } from './helpers';

describe('conversation controller', () => {
  it('ends a run after 16 completed turns', async () => {
    const { controller, repo } = setup();
    const c = controller.create(draft());
    await controller.start(c.id);
    await controller.settled(c.id);

    const v = repo.view(c.id)!;
    expect(v.run?.state).toBe('completed');
    expect(MAX_TURNS).toBe(16);
    expect(v.turns.map(t => t.seq)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(v.turns.map(t => t.speakerId).join('')).toBe('AB'.repeat(8));
    expect(v.turns.map(t => t.objective)).toEqual([...JOBS]);
    expect(v.turns[0].modelId).toBe('mock/wren-v1');
    expect(v.turns[1].modelId).toBe('mock/hale-v1');
    await expect(controller.start(c.id)).rejects.toThrow(ControllerError);
  });

  it('saves a turn only once for the same conversation and seq', () => {
    const { controller, repo } = setup();
    const c = controller.create(draft());
    const turn = { id: 't1', conversationId: c.id, seq: 1, speakerId: 'A' as const, modelId: 'm', objective: 'Frame', text: 'first', status: 'completed' as const, createdAt: new Date().toISOString(), stance: null };
    expect(repo.saveTurn(turn)).toBe(true);
    expect(repo.saveTurn({ ...turn, id: 't2', text: 'second' })).toBe(false);
    const turns = repo.listTurns(c.id);
    expect(turns).toHaveLength(1);
    expect(turns[0].text).toBe('first');
  });

  it('Stop prevents any further turns', async () => {
    const { controller, repo } = setup({ timing: QUICK });
    const c = controller.create(draft());
    const third = turnSaved(controller, c.id, 3);
    await controller.start(c.id);
    await third;
    controller.stop(c.id);
    await controller.settled(c.id);
    await sleep(100);

    const v = repo.view(c.id)!;
    expect(v.run?.state).toBe('cancelled');
    expect(v.run?.stopReason).toBe('by you');
    expect(v.turns.map(t => t.seq)).toEqual([1, 2, 3]);
    await expect(controller.start(c.id)).rejects.toThrow(/cancelled/);
    expect(controller.activeConversationId).toBeNull();
  });

  it('Pause waits for the turn boundary, then Resume finishes the run', async () => {
    const { controller, repo } = setup({ timing: QUICK });
    const c = controller.create(draft());
    const first = turnSaved(controller, c.id, 1);
    await controller.start(c.id);
    await first;
    controller.pause(c.id); // turn 2 is being written now
    await controller.settled(c.id);

    let v = repo.view(c.id)!;
    expect(v.run?.state).toBe('paused');
    expect(v.turns).toHaveLength(2);

    await controller.start(c.id);
    await controller.settled(c.id);
    v = repo.view(c.id)!;
    expect(v.run?.state).toBe('completed');
    expect(v.turns).toHaveLength(MAX_TURNS);
  });

  it('a failed turn saves nothing, keeps earlier turns, and Retry continues', async () => {
    const { controller, repo } = setup({ mock: { failOnce: true } });
    const c = controller.create(draft());
    await controller.start(c.id);
    await controller.settled(c.id);

    let v = repo.view(c.id)!;
    expect(v.run?.state).toBe('failed');
    expect(v.run?.stopReason).toMatch(/simulated/);
    expect(v.turns).toHaveLength(4);

    await controller.start(c.id);
    await controller.settled(c.id);
    v = repo.view(c.id)!;
    expect(v.run?.state).toBe('completed');
    expect(v.turns).toHaveLength(MAX_TURNS);
  });

  it('a restart marks a generating run as interrupted instead of rerunning it', async () => {
    const first = setup();
    const c = first.controller.create(draft());
    first.repo.insertRun({ id: 'r1', conversationId: c.id, state: 'generating', fromSeq: 1, toSeq: 8, startedAt: new Date().toISOString(), endedAt: null, stopReason: null, pauseRequested: false });

    // A new controller over the same database, as after a server restart.
    const { ConversationController } = await import('../src/controller/controller');
    const { MockProvider } = await import('../src/providers/mock');
    const restarted = new ConversationController(first.repo, new MockProvider(() => first.mock), { maxTurns: 8, dailyLimit: 40, models: { A: 'a', B: 'b' } });
    expect(restarted.recoverInterrupted()).toBe(1);
    await sleep(20);

    const v = first.repo.view(c.id)!;
    expect(v.run).toMatchObject({ state: 'paused', stopReason: 'interrupted' });
    expect(v.turns).toHaveLength(0);
    expect(restarted.activeConversationId).toBeNull();
  });

  it('allows only one generating run at a time', async () => {
    const { controller } = setup({ timing: QUICK });
    const a = controller.create(draft());
    const b = controller.create(draft('Will AI help independent businesses?'));
    await controller.start(a.id);
    await expect(controller.start(b.id)).rejects.toThrow(/Another discussion is generating/);
    controller.stop(a.id);
    await controller.settled(a.id);
  });

  it('pauses when the daily request limit is reached', async () => {
    const { controller, repo } = setup({ controller: { dailyLimit: 3 } });
    const c = controller.create(draft());
    await controller.start(c.id);
    await controller.settled(c.id);
    expect(repo.view(c.id)!.run).toMatchObject({ state: 'paused', stopReason: 'Daily request limit reached' });
    expect(repo.listTurns(c.id)).toHaveLength(3);
    await expect(controller.start(c.id)).rejects.toThrow(/Daily request limit/);
  });

  it('numbers episodes and stores the settings on the conversation', () => {
    const { controller } = setup();
    const one = controller.create({ ...draft(), format: 'live', audience: 'kids', temperature: 'heated' });
    const two = controller.create(draft());
    expect([one.episode, two.episode]).toEqual([1, 2]);
    expect(one).toMatchObject({ format: 'live', audience: 'kids', temperature: 'lively' });
    expect(one.speakers.A.name).not.toBe('');
  });
});
