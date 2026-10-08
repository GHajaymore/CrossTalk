// Iris, the Artist: listens to a finished episode, writes a perspective and draws a titled sketch.
// One request after each completed run (never during it). Her failure never changes the discussion.
// She learns: the listener's recent notes on her work go into every new request.
import { z } from 'zod';
import type { ArtistNotes, ConversationView, IrisFeedback } from '@crosstalk/shared';
import type { Repo } from '../db/repo';
import { buildIrisPrompt } from './prompt';
import { mockSketch } from './mockSketches';
import { safeSvg } from './svgSafety';

/** Whatever answers Iris's request: a model, or the scripted mock. Returns the raw reply text. */
export interface ArtistBackend {
  readonly modelId: string;
  draw(prompt: { system: string; user: string }, episode: ConversationView, feedback: IrisFeedback[]): Promise<string>;
}

const Reply = z.object({
  perspective: z.string().trim().min(20).max(1500),
  momentSeq: z.coerce.number().int(),
  caption: z.string().trim().max(300),
  artTitle: z.string().trim().min(1).max(80),
  sketchSvg: z.string().default(''),
  imagePrompt: z.string().trim().max(500).default(''),
});

const words = (t: string) => t.split(/\s+/).filter(Boolean);
const norm = (t: string) => t.toLowerCase().replace(/[‘’“”"'.,!?;:—–-]/g, ' ').replace(/\s+/g, ' ').trim();
const firstSentence = (t: string) => {
  const s = (t.match(/^.*?[.?!](\s|$)/)?.[0] ?? t).trim();
  return words(s).length > 20 ? words(s).slice(0, 20).join(' ') + '…' : s;
};

export type IrisOptions = {
  now?: () => Date;
  /** May she make a request today? (the daily limit) */
  canRequest: () => boolean;
  countRequest: () => void;
  /** Real mode: settings and free-model check for her model. Returns why she can't draw, or null. */
  preflight?: () => Promise<string | null>;
  onChange: (conversationId: string) => void;
};

export class Iris {
  private busy = new Set<string>();
  private now: () => Date;
  constructor(private repo: Repo, private backend: ArtistBackend | null, private opts: IrisOptions) {
    this.now = opts.now ?? (() => new Date());
  }

  get modelId() { return this.backend?.modelId ?? ''; }

  /** Resolves when she has finished with this episode (for tests). */
  private pending = new Map<string, Promise<void>>();
  settled(conversationId: string) { return this.pending.get(conversationId) ?? Promise.resolve(); }

  /** Listen to a completed episode. Once per episode unless `again` (Ask Iris again). */
  listen(conversationId: string, again = false): Promise<void> {
    if (this.busy.has(conversationId)) return this.settled(conversationId);
    const p = this.run(conversationId, again).finally(() => { this.busy.delete(conversationId); this.pending.delete(conversationId); });
    this.busy.add(conversationId);
    this.pending.set(conversationId, p);
    return p;
  }

  private async run(conversationId: string, again: boolean) {
    const view = this.repo.view(conversationId);
    if (!view || view.run?.state !== 'completed' || !view.turns.length) return;
    const prev = view.artist;
    if (prev && !again) return;
    const version = (prev?.version ?? 0) + 1;
    const base: ArtistNotes = {
      conversationId, state: 'listening', modelId: this.modelId, perspective: '', momentSeq: 0, caption: '', artTitle: '',
      artStyle: 'sketch', sketchSvg: null, imagePrompt: '', error: null, version, createdAt: this.now().toISOString(),
    };
    const fail = (error: string) => { this.repo.saveArtist({ ...base, state: 'failed', error }); this.opts.onChange(conversationId); };

    this.repo.saveArtist(base);
    this.opts.onChange(conversationId);
    if (!this.backend) return fail('Iris needs a free model: set ARTIST_MODEL in the server settings (see docs/MODELS.md).');
    if (!this.opts.canRequest()) return fail('Daily request limit reached. Ask Iris again tomorrow.');
    const blocked = await this.opts.preflight?.();
    if (blocked) return fail(blocked);

    const feedback = this.repo.listFeedback(10);
    let raw: string;
    try {
      this.opts.countRequest();
      raw = await this.backend.draw(buildIrisPrompt(view, feedback), view, feedback);
    } catch (e) {
      return fail(`Iris couldn't finish: ${e instanceof Error ? e.message : 'the model failed'}. Try again.`);
    }

    let reply: z.infer<typeof Reply>;
    try {
      const json = raw.match(/\{[\s\S]*\}/)?.[0];
      if (!json) throw new Error('no JSON');
      reply = Reply.parse(JSON.parse(json));
    } catch {
      return fail("Iris's reply couldn't be read. Try again.");
    }

    const turn = view.turns.find(t => t.seq === reply.momentSeq) ?? view.turns[Math.floor(view.turns.length / 2)];
    // The caption must be a real quote from that turn, 20 words or fewer.
    const caption = reply.caption && words(reply.caption).length <= 20 && norm(turn.text).includes(norm(reply.caption.replace(/…$/, '')))
      ? reply.caption : firstSentence(turn.text);
    const svg = safeSvg(reply.sketchSvg);

    this.repo.saveArtist({
      ...base, state: 'done', perspective: reply.perspective, momentSeq: turn.seq, caption,
      artTitle: reply.artTitle.replace(/^["“]|["”]$/g, ''), sketchSvg: svg.ok ? svg.svg : null, imagePrompt: reply.imagePrompt,
      error: svg.ok ? null : `Her sketch didn't pass the safety check (${svg.reason}), so only her perspective is shown.`,
    });
    this.opts.onChange(conversationId);
  }
}

/** Mock Iris: no model call. Picks a moment, writes a perspective, draws a scene, and shows she read your notes. */
export const mockArtist: ArtistBackend = {
  modelId: 'mock/iris-v1',
  async draw(_prompt, c, feedback) {
    const pick = c.turns.find(t => t.objective === 'Rethink') ?? c.turns.find(t => t.objective === 'Catch') ?? c.turns[Math.floor(c.turns.length / 2)];
    const who = c.speakers[pick.speakerId].name;
    const other = c.speakers[pick.speakerId === 'A' ? 'B' : 'A'].name;
    const lastNote = feedback.find(f => f.note);
    const sketch = mockSketch(c.topic);
    const perspective = [
      `What stayed with me was the moment ${who} gave ground to ${other}. The talk got honest right there, because someone changed their mind out loud.`,
      `I wish they had spent a turn on the people who never get asked about this.`,
      lastNote ? `You told me "${lastNote.note.slice(0, 80)}", so I tried to keep that in mind.` : '',
      `My question for you: what would it take to change your mind?`,
    ].filter(Boolean).join(' ');
    return JSON.stringify({ perspective, momentSeq: pick.seq, caption: firstSentence(pick.text), artTitle: sketch.title, sketchSvg: sketch.svg, imagePrompt: `A painted scene of: ${firstSentence(pick.text)}` });
  },
};
