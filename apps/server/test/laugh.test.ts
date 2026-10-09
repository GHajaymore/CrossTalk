import { describe, expect, it } from 'vitest';
import { extractTags, hideStanceTag, MAX_TURNS, startsLaughing, type MockSettings } from '@crosstalk/shared';
import { ConversationController } from '../src/controller/controller';
import { openDb, Repo } from '../src/db/repo';
import { exportJson } from '../src/export';
import { buildPrompt } from '../src/prompts/buildPrompt';
import { buildIrisPrompt } from '../src/artist/prompt';
import { MockProvider } from '../src/providers/mock';
import { scriptFor } from '../src/providers/mockScripts';
import type { TurnOptions, TurnRequest } from '../src/providers/types';
import { draft, INSTANT } from './helpers';

describe('hosts who laugh together', () => {
  it('takes the hidden joke tag out of a line, next to a stance tag, and hides it while it streams', () => {
    expect(extractTags('Picture a dog running the meeting. [funny]')).toEqual({ text: 'Picture a dog running the meeting.', stance: null, funny: true });
    expect(extractTags("About 70%, and that's my final answer. [stance: 70] [Funny]")).toEqual({ text: "About 70%, and that's my final answer.", stance: 70, funny: true });
    expect(extractTags('Just a line.').funny).toBe(false);
    expect(hideStanceTag('A dog in a tie. [fun')).toBe('A dog in a tie.');
    expect(hideStanceTag('A dog in a tie. [funny]')).toBe('A dog in a tie.');
    expect(hideStanceTag('A [fact] stays')).toBe('A [fact] stays');
  });

  it('knows a laugh from a yes in each language', () => {
    expect(startsLaughing('Ha, the café tables always show up first.')).toBe(true);
    expect(startsLaughing('Haha! Fair.')).toBe(true);
    expect(startsLaughing('Happy to.')).toBe(false);
    expect(startsLaughing('Ja, lo de la novedad es muy cierto.', 'es')).toBe(true);
    expect(startsLaughing('Ja, das stimmt.', 'de')).toBe(false); // German "ja" is yes
    expect(startsLaughing('हा, पहले हफ़्ते का नयापन सच है।', 'hi')).toBe(true);
    expect(startsLaughing('हाँ, अच्छी बात है।', 'hi')).toBe(false); // "haan" is yes
  });

  it('asks real hosts to tag their jokes; mock hosts tag the line the other one laughs at, and it is saved', async () => {
    const repo = new Repo(openDb(':memory:'));
    let system = '';
    class Recording extends MockProvider {
      async generateTurn(req: TurnRequest, o: TurnOptions) { system = buildPrompt(req).system; return super.generateTurn(req, o); }
    }
    const mock: MockSettings = { failOnce: false, fast: true };
    const controller = new ConversationController(repo, new Recording(() => mock, INSTANT), { maxTurns: MAX_TURNS, dailyLimit: 100, models: { A: 'a', B: 'b' } });
    const c = controller.create(draft());
    await controller.start(c.id);
    await controller.settled(c.id);
    expect(system).toMatch(/add the tag \[funny\]/);

    const v = repo.view(c.id)!;
    const script = scriptFor(v.topic);
    const expected = v.turns.filter(t => startsLaughing(script[t.seq] ?? '')).map(t => t.seq);
    expect(expected.length).toBeGreaterThan(0);
    expect(v.turns.filter(t => t.funny).map(t => t.seq)).toEqual(expected);
    expect(v.turns.some(t => /\[funny/i.test(t.text))).toBe(false);
    expect(exportJson({ ...v, audio: null }, []).turns.find(t => t.seq === expected[0])!.funny).toBe(true);
    // Iris sees the shared laugh as a warm moment, never a point scored.
    const iris = buildIrisPrompt(v, []);
    expect(iris.user).toContain(`Turn ${expected[0]} · ${v.speakers[v.turns[expected[0] - 1].speakerId].name}:`);
    expect(iris.user.split('\n').find(l => l.startsWith(`Turn ${expected[0]} `))).toContain('[shared a laugh]');
    expect(iris.user.match(/\[shared a laugh\]/g)).toHaveLength(expected.length);
    expect(iris.system).toContain('never a point scored');
  });
});
