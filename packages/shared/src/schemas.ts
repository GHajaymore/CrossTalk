import { z } from 'zod';
import { AUDIENCES, CUE_TEXT_MAX, SCOUT_CATS, SCOUT_REGIONS, SCOUT_SOURCES, TITLE_MAX, FORMATS, LENGTHS, LENS_MAX, MODES, NAME_MAX, PERSONAS, ROLE_MAX, TEMPERATURES, TOPIC_MAX } from './constants';

const keys = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

export const Mode = z.enum(keys(MODES));
export const Format = z.enum(keys(FORMATS));
export const Length = z.enum(keys(LENGTHS));
export type Length = z.infer<typeof Length>;
export const Audience = z.enum(keys(AUDIENCES));
export const Temperature = z.enum(keys(TEMPERATURES));
export const PersonaKey = z.enum(keys(PERSONAS));
export const SpeakerId = z.enum(['A', 'B']);

export type Mode = z.infer<typeof Mode>;
export type Format = z.infer<typeof Format>;
export type Audience = z.infer<typeof Audience>;
export type Temperature = z.infer<typeof Temperature>;
export type PersonaKey = z.infer<typeof PersonaKey>;
export type SpeakerId = z.infer<typeof SpeakerId>;

/** What the Create screen sends for each seat. `autoName` / `autoPersona` mean "let the server choose". */
export const SpeakerDraft = z.object({
  name: z.string().trim().max(NAME_MAX),
  autoName: z.boolean(),
  persona: PersonaKey,
  autoPersona: z.boolean(),
  /** Only used for the Custom personality. Treated as content, never as instructions. */
  lens: z.string().trim().max(LENS_MAX),
  /** The host's invented job or background, fitted to the topic (e.g. "Chef who runs a small bistro"). */
  role: z.string().trim().max(ROLE_MAX).default(''),
  /** Let the app write a role that fits the topic. */
  autoRole: z.boolean().default(true),
});
export type SpeakerDraft = z.infer<typeof SpeakerDraft>;

/** The speaker snapshot stored on a conversation, so later config changes never rewrite history. */
export const Speaker = SpeakerDraft.extend({
  id: SpeakerId,
  name: z.string().min(1).max(NAME_MAX),
  modelId: z.string().min(1),
});
export type Speaker = z.infer<typeof Speaker>;
export type Speakers = { A: Speaker; B: Speaker };

export const CreateConversation = z.object({
  topic: z.string().trim().min(1, 'Add a topic first.').max(TOPIC_MAX),
  mode: Mode,
  format: Format,
  audience: Audience,
  temperature: Temperature,
  speakers: z.object({ A: SpeakerDraft, B: SpeakerDraft }),
  /** A topic picked from the Scout's Today tray: its brief goes to the hosts as the only facts. */
  scoutTopicId: z.string().nullable().optional(),
  /** Normal (16 turns) when left out. */
  length: Length.optional(),
});
export type CreateConversation = z.infer<typeof CreateConversation>;

// ---- Topic Scout ----
export const ScoutCat = z.enum(keys(SCOUT_CATS));
export type ScoutCat = z.infer<typeof ScoutCat>;
export const ScoutRegion = z.enum(keys(SCOUT_REGIONS));
export const ScoutSourceKey = z.enum(keys(SCOUT_SOURCES));
export type ScoutSourceKey = z.infer<typeof ScoutSourceKey>;
export type ScoutRegion = z.infer<typeof ScoutRegion>;

export const ScoutPrefs = z.object({
  cats: z.array(ScoutCat),
  regions: z.array(ScoutRegion),
  rank: z.enum(['split', 'buzz']),
  /** Your city or region for "Local". Typed by you; the app never detects your location. */
  place: z.string().trim().max(60),
  autopilot: z.boolean(),
  /** Which sources to read; all of them when left out (older saved preferences). */
  sources: z.array(ScoutSourceKey).default(['news', 'trends', 'reddit', 'social', 'hn', 'wikipedia']),
});
export type ScoutPrefs = z.infer<typeof ScoutPrefs>;

/** One "what happened" bullet, always tied to a source the Scout actually read. */
export type ScoutBullet = { text: string; url: string; source: string };

export type ScoutTopic = {
  id: string;
  runId: string;
  date: string;
  question: string;
  category: ScoutCat;
  region: ScoutRegion;
  /** The larger side of the split, 50–100: 50 is evenly divided. */
  split: number;
  /** How much people are talking about it, 0–100 within the day's candidates. */
  buzz: number;
  bullets: ScoutBullet[];
  sources: string[];
  createdAt: string;
  /** Control room: pinned topics come first; hidden ones never reach a tray or Autopilot. */
  pinned: boolean;
  hidden: boolean;
};

// ---- Control room ----
export const Rules = z.object({
  /** Words and phrases that keep a topic off air; the Scout drops matching stories. */
  blocked: z.array(z.string().trim().min(1).max(60)).max(200),
  allowMature: z.boolean(),
  allowHeated: z.boolean(),
  /** Politics and Scandals in the Scout. */
  allowPolitics: z.boolean(),
  /** Listener cues per episode, 0–6. */
  cueLimit: z.number().int().min(0).max(6),
});
export type Rules = z.infer<typeof Rules>;

export const NoteInput = z.object({
  text: z.string().transform(s => s.replace(/\s+/g, ' ').trim()).pipe(z.string().min(1, 'Write the note first.').max(CUE_TEXT_MAX)),
});

export type Overview = {
  episodes: number; finishedPct: number | null; cuesPerEpisode: number; irisArtworks: number; waiting: number;
  requestsToday: number; dailyLimit: number;
  topics: { category: string; count: number }[];
  audit: { at: string; action: string; detail: string }[];
};

export type ScoutStatus = {
  /** When the Scout runs each day, server time (SCOUT_TIME). */
  time: string;
  running: boolean;
  /** Real mode: when a manual Refresh is next allowed (it uses a request); null when it is now. */
  refreshAfter: string | null;
  lastRun: {
    id: string; date: string; startedAt: string; state: 'ok' | 'failed'; error: string | null;
    sourcesOk: string[]; sourcesFailed: string[]; autopilotConversationId: string | null; autopilotNote: string | null;
  } | null;
};

export const RunState = z.enum(['idle', 'generating', 'paused', 'completed', 'cancelled', 'failed']);
export type RunState = z.infer<typeof RunState>;

export const Turn = z.object({
  id: z.string(),
  conversationId: z.string(),
  seq: z.number().int().min(1),
  speakerId: SpeakerId,
  modelId: z.string(),
  objective: z.string(),
  text: z.string(),
  status: z.literal('completed'),
  createdAt: z.string(),
  /** Mind-change meter: how sure the host said they were, 0 (firmly no) to 100 (firmly yes). Only on their first and last lines. */
  stance: z.number().int().min(0).max(100).nullable().default(null),
});
export type Turn = z.infer<typeof Turn>;

export const Run = z.object({
  id: z.string(),
  conversationId: z.string(),
  state: RunState,
  fromSeq: z.number().int(),
  toSeq: z.number().int(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  /** Why the run is not generating: "by you", "interrupted", or a failure message. */
  stopReason: z.string().nullable(),
  /** True once Pause was pressed; the run pauses at the next turn boundary. */
  pauseRequested: z.boolean(),
});
export type Run = z.infer<typeof Run>;

// 'note' is a producer note from the Control room: it lands like a cue but never uses the listener's cues.
export const CueKind = z.enum(['challenge', 'deeper', 'temp', 'guest', 'note']);
export type CueKind = z.infer<typeof CueKind>;

/** A listener's cue: a note passed across the desk that lands at the next turn boundary. */
export const Intervention = z.object({
  id: z.string(),
  kind: CueKind,
  /** The challenge, or the guest's words on the mic. */
  text: z.string().nullable(),
  /** Go deeper: the turn to dig into. */
  targetSeq: z.number().int().nullable(),
  /** Temperature: the move from one setting to the next. */
  fromTemp: Temperature.nullable(),
  toTemp: Temperature.nullable(),
  appliesBeforeSeq: z.number().int(),
  status: z.enum(['queued', 'applied', 'cancelled']),
  createdAt: z.string(),
  /** In a branch: a cue that landed in the original episode, before the cut. Read-only here. */
  fromOriginal: z.boolean().default(false),
});
export type Intervention = z.infer<typeof Intervention>;

// Cue text is a line said on air: kept on one line.
const cueText = z.string().transform(s => s.replace(/\s+/g, ' ').trim()).pipe(z.string().min(1, 'Write your cue first.').max(CUE_TEXT_MAX, `Keep it under ${CUE_TEXT_MAX} characters.`));
/** What the Cue panel sends. */
export const CueInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('challenge'), text: cueText }),
  z.object({ kind: z.literal('guest'), text: cueText }),
  z.object({ kind: z.literal('deeper'), targetSeq: z.number().int().min(1) }),
  z.object({ kind: z.literal('temp'), direction: z.enum(['up', 'down']) }),
]);
export type CueInput = z.infer<typeof CueInput>;

/** Rename an episode in the library. */
export const RenameInput = z.object({
  title: z.string().transform(s => s.replace(/\s+/g, ' ').trim()).pipe(z.string().min(1, 'Give it a title.').max(TITLE_MAX, `Keep it under ${TITLE_MAX} characters.`)),
});

/** Branch from a finished turn in a new direction. */
export const BranchInput = z.object({
  fromSeq: z.number().int().min(1),
  direction: z.string().transform(s => s.replace(/\s+/g, ' ').trim()).pipe(z.string().min(1, 'Say where the branch should go.').max(CUE_TEXT_MAX, `Keep it under ${CUE_TEXT_MAX} characters.`)),
});
export type BranchInput = z.infer<typeof BranchInput>;

export const Conversation = z.object({
  id: z.string(),
  title: z.string(),
  topic: z.string(),
  mode: Mode,
  format: Format,
  audience: Audience,
  temperature: Temperature,
  episode: z.number().int(),
  speakers: z.object({ A: Speaker, B: Speaker }),
  parentId: z.string().nullable(),
  branchTurnId: z.string().nullable(),
  /** A branch continues from this turn of its parent, which it reads but never changes. */
  branchSeq: z.number().int().nullable(),
  /** The new direction the listener gave the branch. */
  branchDirection: z.string().nullable(),
  /** The Scout topic this episode came from, if any. */
  scoutTopicId: z.string().nullable().default(null),
  /** Publishing (Control room): every finished episode waits for the owner's OK. Nothing is ever posted without 'approved'. */
  publish: z.enum(['waiting', 'approved', 'held']).nullable().default(null),
  /** Hot seat: who moved the listener, in their own vote. */
  verdict: z.enum(['held', 'won', 'torn']).nullable().default(null),
  /** Where do you stand? The listener's own 0 (no) to 100 (yes), before listening and after. */
  youStart: z.number().int().min(0).max(100).nullable().default(null),
  youEnd: z.number().int().min(0).max(100).nullable().default(null),
  /** Round two: the episode this one follows (same hosts, same question), and which round it is. */
  roundOf: z.string().nullable().default(null),
  /** Short (8 turns), Normal (16) or Long (24). */
  length: Length.default('normal'),
  round: z.number().int().min(1).default(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Conversation = z.infer<typeof Conversation>;

/** When each turn starts and ends in a rendered audio file, in seconds. */
export type AudioTiming = { seq: number; speakerId: SpeakerId; start: number; end: number };
/** A rendered episode recording (natural voices), if one exists. */
export type EpisodeAudio = { url: string; durationSec: number; voices: { A: string; B: string }; timings: AudioTiming[] };

/** Iris, the Artist: a listener's perspective and a titled sketch, made after an episode ends. */
export const ArtistNotes = z.object({
  conversationId: z.string(),
  state: z.enum(['listening', 'done', 'failed']),
  modelId: z.string(),
  perspective: z.string(),
  momentSeq: z.number().int(),
  /** A quote of 20 words or fewer from the turn she drew. */
  caption: z.string(),
  artTitle: z.string(),
  artStyle: z.enum(['sketch', 'picture', 'painting', 'dreamscape']),
  /** Checked SVG line art, or null if her drawing failed the safety check. */
  sketchSvg: z.string().nullable(),
  /** Saved for a painted version later. */
  imagePrompt: z.string(),
  error: z.string().nullable(),
  /** How many times she has drawn this episode. */
  version: z.number().int(),
  createdAt: z.string(),
});
export type ArtistNotes = z.infer<typeof ArtistNotes>;

/** What the listener told Iris about her work. She reads recent notes before every drawing. */
export const IrisFeedbackInput = z.object({
  conversationId: z.string().nullable(),
  rating: z.enum(['up', 'down']),
  note: z.string().trim().max(300),
});
export type IrisFeedback = z.infer<typeof IrisFeedbackInput> & { id: string; artTitle: string | null; createdAt: string };

export type BranchSummary = { id: string; title: string; branchSeq: number; direction: string; state: RunState | 'idle'; createdAt: string };

/** A conversation with everything the Studio needs to draw it. */
export type ConversationView = Conversation & {
  turns: Turn[];
  run: Run | null;
  /** Cue cards, in the order they were given (cancelled ones left out). */
  interventions: Intervention[];
  /** The original this branch was cut from. */
  parent: { id: string; title: string; episode: number } | null;
  /** Branches cut from this conversation. */
  branches: BranchSummary[];
  /** Round two: the round this follows, and the round that follows it (if made yet). */
  prevRound: { id: string; title: string; episode: number; round: number } | null;
  nextRound: { id: string; title: string; episode: number; round: number } | null;
  /** The Scout's brief, when the topic came from the Today tray. */
  brief: ScoutTopic | null;
  /** The rendered recording, when tools/voice has made one. */
  audio?: EpisodeAudio | null;
  /** Iris's notes for this episode, once she has listened. */
  artist?: ArtistNotes | null;
};

/** Events sent from the server over Server-Sent Events. */
/** The turn being written right now, as far as it has got. */
export type LiveTurn = { seq: number; speakerId: SpeakerId; objective: string; modelId: string; text: string };

export type StreamEvent =
  | { type: 'snapshot'; conversation: ConversationView; live: LiveTurn | null }
  | { type: 'turn-start'; seq: number; speakerId: SpeakerId; objective: string; modelId: string }
  | { type: 'token'; seq: number; text: string }
  | { type: 'turn-end'; seq: number };

export type ModelVerdict = { modelId: string; ok: boolean; reason: string };

export type AppConfig = {
  providerMode: 'mock' | 'openrouter';
  models: { A: string; B: string };
  artistModel: string | null;
  dailyLimit: number;
  requestsToday: number;
  nextEpisode: number;
  activeConversationId: string | null;
  mock: MockSettings;
  /** Real mode only. Whether a key is configured; the key itself never leaves the server. */
  apiKeySet: boolean;
  allowPaidModels: boolean;
  maxOutputTokens: number;
  /** Settings that block real runs until fixed (missing key, same model twice…). */
  problems: string[];
  /** The free-model guard's latest verdict per model. Empty in mock mode or before the first check. */
  guard: { checkedAt: string | null; verdicts: ModelVerdict[] };
  usageToday: { attempts: number; tokensIn: number; tokensOut: number; costUsd: number | null };
  /** The Control room's rules, which Create, the Studio and the Scout follow. */
  rules: Rules;
  /** Whether the Control room needs its admin code here (online), and whether this device has it. */
  admin: { required: boolean; ok: boolean; configured: boolean };
  /** Where episodes and Iris's sketches are kept: this computer's disk, a disk with a cloud backup, or a disk the host wipes. */
  storage: 'local' | 'backed-up' | 'forgets';
};

export const MockSettings = z.object({
  /** Fail turn 5 halfway through, once per conversation. */
  failOnce: z.boolean(),
  /** Stream fast, for demos and tests. */
  fast: z.boolean(),
});
export type MockSettings = z.infer<typeof MockSettings>;
