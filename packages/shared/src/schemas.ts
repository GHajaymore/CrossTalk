import { z } from 'zod';
import { AUDIENCES, FORMATS, LENS_MAX, MODES, NAME_MAX, PERSONAS, ROLE_MAX, TEMPERATURES, TOPIC_MAX } from './constants';

const keys = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

export const Mode = z.enum(keys(MODES));
export const Format = z.enum(keys(FORMATS));
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
});
export type CreateConversation = z.infer<typeof CreateConversation>;

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

export const Intervention = z.object({
  id: z.string(),
  kind: z.enum(['challenge', 'deeper', 'temp', 'guest']),
  text: z.string().nullable(),
  appliesBeforeSeq: z.number().int(),
  status: z.enum(['queued', 'applied', 'cancelled']),
});
export type Intervention = z.infer<typeof Intervention>;

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
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Conversation = z.infer<typeof Conversation>;

/** A conversation with everything the Studio needs to draw it. */
export type ConversationView = Conversation & {
  turns: Turn[];
  run: Run | null;
  /** Cue cards. Always empty until Milestone 4. */
  interventions: Intervention[];
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
};

export const MockSettings = z.object({
  /** Fail turn 5 halfway through, once per conversation. */
  failOnce: z.boolean(),
  /** Stream fast, for demos and tests. */
  fast: z.boolean(),
});
export type MockSettings = z.infer<typeof MockSettings>;
