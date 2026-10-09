import { homeOf, LANGUAGES, normalSeqFor, startsLaughing, turnTotal, type MockSettings } from '@crosstalk/shared';
import { mockBranchText, mockCueLead, mockLongText, mockRoundOpening, mockStance, mockTurnText, openQuote, PUSH_BACK_TURNS, scriptFor } from './mockScripts';
import { MOCK_LANGS } from './mockScriptsLocal';
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
    const { conversation: c, seq, speaker, objective, cues = [], lastRound = null } = req;
    await wait(this.timing.thinkMs(fast), signal);

    const normalSeq = normalSeqFor(seq, c.length);
    // Spanish and Hindi have a whole sample episode; other languages greet in theirs, then play the English one.
    const L = MOCK_LANGS[c.language ?? 'en'];
    const base = c.branchSeq && seq > c.branchSeq ? (L ? L.branch(objective, (c.branchDirection ?? '').trim().replace(/[.?!।]*$/, '')) : mockBranchText(objective, c.branchDirection ?? ''))
      : normalSeq ? (L ? (PUSH_BACK_TURNS.has(normalSeq) ? L.heat[c.temperature] : '') + L.script(c.topic.trim())[normalSeq - 1] : mockTurnText(c.topic, normalSeq, speaker.id, c.temperature))
      : (L?.long[objective] ?? mockLongText(objective));
    const leads = cues.filter(x => x.status === 'queued' && x.appliesBeforeSeq <= seq).map(x => {
      const up = x.toTemp === 'heated' || (x.toTemp === 'lively' && x.fromTemp === 'calm');
      return L ? L.cue(x.kind, (x.text ?? '').trim(), x.targetSeq, up) : mockCueLead(x.kind, x.text, x.targetSeq, up);
    });
    // Hot seat: the hosts name their roles on their first lines.
    const seat = c.mode === 'hotseat' && seq === 1 ? L?.hotseat[0] ?? "I'm in the hot seat today, arguing the side most people reject. "
      : c.mode === 'hotseat' && seq === 2 ? L?.hotseat[1] ?? 'And my job is to talk you out of it, fairly. ' : '';
    // A host with a home says where they're joining from on their first line.
    const from = homeOf(speaker.home);
    const greet = seq === 1 && !lastRound && c.language && c.language !== 'en' ? `${LANGUAGES[c.language].hello} ` : '';
    const hi = from && !lastRound && (objective === 'Hello' || objective === 'First take') ? (L ? L.from(from.country) : `Coming to you from ${from.country} today. `) : '';
    const open = lastRound?.lines.find(l => l.job === 'Still unsure')?.text ?? null;
    const roundOpening = lastRound ? (L ? L.round(lastRound.round, seq, openQuote(open) ?? null) : mockRoundOpening(lastRound.round, seq, open)) : null;
    const stance = mockStance(c.topic, speaker.id, objective, lastRound?.stances[speaker.id].end ?? null, L?.stance);
    // The sample episodes have a few jokes: the line the other host answers with a laugh is tagged.
    const nextSeq = seq < turnTotal(c) ? normalSeqFor(seq + 1, c.length) : null;
    const nextLine = normalSeq && nextSeq && !c.branchSeq && !roundOpening ? (L ? L.script(c.topic.trim()) : scriptFor(c.topic))[nextSeq - 1] : undefined;
    const funny = nextLine && startsLaughing(nextLine, c.language ?? 'en') ? ' [funny]' : '';
    const words = (greet + hi + seat + leads.join('') + (roundOpening ?? base) + stance + funny).split(' ');
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
