import { describe, expect, it } from 'vitest';
import { extractStance, hideStanceTag, mindChange, MAX_TURNS, type MockSettings } from '@crosstalk/shared';
import { ConversationController } from '../src/controller/controller';
import { openDb, Repo } from '../src/db/repo';
import { exportJson, exportMarkdown } from '../src/export';
import { buildPrompt } from '../src/prompts/buildPrompt';
import { MockProvider } from '../src/providers/mock';
import type { TurnOptions, TurnRequest } from '../src/providers/types';
import { draft, INSTANT } from './helpers';

describe('Mind-change meter', () => {
  it('takes the hidden tag out of a line, in any reasonable spelling', () => {
    expect(extractStance("I'm maybe 70% on yes. [stance: 70]")).toEqual({ text: "I'm maybe 70% on yes.", stance: 70 });
    expect(extractStance('Moved a bit. [Stance 55%]')).toEqual({ text: 'Moved a bit.', stance: 55 });
    expect(extractStance('Way past. [stance: 250]').stance).toBe(100);
    expect(extractStance('No tag here.')).toEqual({ text: 'No tag here.', stance: null });
    expect(hideStanceTag('Sure, about 60%. [sta')).toBe('Sure, about 60%.');
  });

  it("asks for it on each host's first and last lines only, and the tag never reaches the transcript", async () => {
    const repo = new Repo(openDb(':memory:'));
    const prompts = new Map<number, { system: string; user: string }>();
    class Recording extends MockProvider {
      async generateTurn(req: TurnRequest, o: TurnOptions) { prompts.set(req.seq, buildPrompt(req)); return super.generateTurn(req, o); }
    }
    const mock: MockSettings = { failOnce: false, fast: true };
    const controller = new ConversationController(repo, new Recording(() => mock, INSTANT), { maxTurns: MAX_TURNS, dailyLimit: 100, models: { A: 'a', B: 'b' } });
    const c = controller.create(draft());
    await controller.start(c.id);
    await controller.settled(c.id);

    for (const seq of [1, 2]) expect(prompts.get(seq)!.user).toMatch(/how sure you are right now, as a percentage/);
    for (const seq of [3, 8, 14]) expect(prompts.get(seq)!.user).not.toMatch(/\[stance/);
    const v = repo.view(c.id)!;
    const startA = v.turns[0].stance!;
    expect(prompts.get(15)!.user).toContain(`(you started at ${startA}% on yes)`);

    expect(v.turns.filter(t => t.stance != null).map(t => t.seq)).toEqual([1, 2, 15, 16]);
    expect(v.turns.some(t => /\[stance/i.test(t.text))).toBe(false);
    const m = mindChange(v.turns);
    expect(m.A.start).toBe(startA);
    expect(m.A.end).toBeLessThan(m.A.start!);
    expect(m.B.end).toBeGreaterThan(m.B.start!);

    expect(exportJson({ ...v, audio: null }, []).turns[0].stance).toBe(startA);
    expect(exportMarkdown(v)).toContain(`## Mind-change meter\n\n- ${v.speakers.A.name}: ${m.A.start}% on yes → ${m.A.end}%`);
  });
});

describe('Mind-change meter: review fixes', () => {
  it('only a stance tag being written is hidden while streaming, not other brackets', () => {
    expect(hideStanceTag('That is the [quote')).toBe('That is the [quote');
    expect(hideStanceTag('About 60%. [stance: 6')).toBe('About 60%.');
    expect(hideStanceTag('About 60%. [')).toBe('About 60%.');
  });
});

describe('Mind-change meter: trimming', () => {
  it('drops the number when trimming cuts the sentence that said it', async () => {
    const repo = new Repo(openDb(':memory:'));
    const long = Array(12).fill('This is a fairly long sentence that keeps going for a while.').join(' ');
    const provider = { name: 'fake', generateTurn: async (req: TurnRequest) => ({
      text: req.seq === 1 ? `${long} I am now about 55% on yes. [stance: 55]` : `Short line. About 40% for me. [stance: 40]`, usage: null }) };
    const controller = new ConversationController(repo, provider, { maxTurns: 2, dailyLimit: 100, models: { A: 'a', B: 'b' } });
    const c = controller.create(draft());
    await controller.start(c.id);
    await controller.settled(c.id);
    const [t1, t2] = repo.view(c.id)!.turns;
    expect(t1.text).not.toContain('55%');
    expect(t1.stance).toBeNull();
    expect(t2.stance).toBe(40);
  });
});
