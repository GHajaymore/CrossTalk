// Typed calls to the local server. The browser never talks to a model.
import type { AppConfig, ArtistNotes, BranchInput, Conversation, ConversationView, CreateConversation, CueInput, GalleryEpisode, IrisFeedback, MockSettings, PaintStyle, Overview, ReactionKind, Rules, Run, ScoutPrefs, ScoutStatus, ScoutTopic } from '@crosstalk/shared';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const body = await res.json().catch(() => ({}));
  // A hosted CrossTalk is locked: any 401 sends you back to the access-code screen.
  if (res.status === 401 && (body as { locked?: boolean }).locked) dispatchEvent(new Event('crosstalk:locked'));
  if (res.status === 403 && (body as { adminLocked?: boolean }).adminLocked) dispatchEvent(new Event('crosstalk:admin-locked'));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export type Access = { required: boolean; ok: boolean };
export type ScoutView = { prefs: ScoutPrefs; status: ScoutStatus; topics: ScoutTopic[] };
export type ConversationSummary = Conversation & { run: Run | null; turnCount: number; artist?: ArtistNotes | null; branchCount: number };

export const api = {
  config: () => call<AppConfig>('/config'),
  checkModels: () => call<AppConfig>('/guard/check', { method: 'POST' }),
  checkBackup: () => call<AppConfig>('/backup/check', { method: 'POST' }),
  setMock: (m: MockSettings) => call<MockSettings>('/mock', { method: 'PUT', body: JSON.stringify(m) }),
  access: () => call<Access>('/access'),
  unlock: (code: string) => call<Access>('/access', { method: 'POST', body: JSON.stringify({ code }) }),
  lock: () => call<Access>('/access', { method: 'DELETE' }),
  list: () => call<ConversationSummary[]>('/conversations'),
  get: (id: string) => call<ConversationView>(`/conversations/${id}`),
  create: (c: CreateConversation) => call<ConversationView>('/conversations', { method: 'POST', body: JSON.stringify(c) }),
  start: (id: string) => call<ConversationView>(`/conversations/${id}/start`, { method: 'POST' }),
  raiseHand: (id: string) => call<ConversationView>(`/conversations/${id}/hand`, { method: 'POST' }),
  pause: (id: string) => call<ConversationView>(`/conversations/${id}/pause`, { method: 'POST' }),
  stop: (id: string) => call<ConversationView>(`/conversations/${id}/stop`, { method: 'POST' }),
  rename: (id: string, title: string) => call<ConversationView>(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  remove: (id: string) => call<unknown>(`/conversations/${id}`, { method: 'DELETE' }),

  // Control room
  adminSignIn: (code: string) => call<AppConfig['admin']>('/admin/access', { method: 'POST', body: JSON.stringify({ code }) }),
  overview: () => call<Overview>('/admin/overview'),
  rules: () => call<Rules>('/admin/rules'),
  setRules: (r: Rules) => call<Rules>('/admin/rules', { method: 'PUT', body: JSON.stringify(r) }),
  note: (id: string, text: string) => call<ConversationView>(`/admin/conversations/${id}/note`, { method: 'POST', body: JSON.stringify({ text }) }),
  publish: (id: string, state: 'approved' | 'held') => call<ConversationView>(`/admin/conversations/${id}/publish`, { method: 'POST', body: JSON.stringify({ state }) }),
  topicFlags: (id: string, flags: { pinned?: boolean; hidden?: boolean }) => call<ScoutView>(`/admin/topics/${id}`, { method: 'POST', body: JSON.stringify(flags) }),
  scout: () => call<ScoutView>('/scout'),
  setScoutPrefs: (p: ScoutPrefs) => call<ScoutView>('/scout/prefs', { method: 'PUT', body: JSON.stringify(p) }),
  runScout: () => call<ScoutView>('/scout/run', { method: 'POST' }),
  verdict: (id: string, verdict: 'held' | 'won' | 'torn') => call<ConversationView>(`/conversations/${id}/verdict`, { method: 'POST', body: JSON.stringify({ verdict }) }),
  addCue: (id: string, cue: CueInput) => call<ConversationView>(`/conversations/${id}/cues`, { method: 'POST', body: JSON.stringify(cue) }),
  cancelCue: (id: string, cueId: string) => call<ConversationView>(`/conversations/${id}/cues/${cueId}`, { method: 'DELETE' }),
  branch: (id: string, b: BranchInput) => call<ConversationView>(`/conversations/${id}/branch`, { method: 'POST', body: JSON.stringify(b) }),
  askIris: (id: string) => call<ConversationView>(`/conversations/${id}/artist`, { method: 'POST' }),
  irisFeedback: () => call<IrisFeedback[]>('/iris/feedback'),
  sendIrisFeedback: (f: { conversationId: string | null; rating: 'up' | 'down'; note: string }) => call<IrisFeedback[]>('/iris/feedback', { method: 'POST', body: JSON.stringify(f) }),
  nextRound: (id: string) => call<ConversationView>(`/conversations/${id}/round`, { method: 'POST' }),
  setYou: (id: string, patch: { start?: number | null; end?: number | null }) => call<ConversationView>(`/conversations/${id}/you`, { method: 'PUT', body: JSON.stringify(patch) }),
  react: (id: string, seq: number, kind: ReactionKind) => call<{ reactions: NonNullable<ConversationView['reactions']> }>(`/conversations/${id}/reactions`, { method: 'POST', body: JSON.stringify({ seq, kind }) }),
  setArtStyle: (id: string, style: PaintStyle) => call<ConversationView>(`/conversations/${id}/artist/style`, { method: 'PUT', body: JSON.stringify({ style }) }),
  irisGallery: () => call<GalleryEpisode[]>('/iris/gallery'),
  irisStyles: () => call<{ styles: PaintStyle[]; homeStyles: boolean }>('/iris/styles'),
  setIrisStyles: (styles: PaintStyle[]) => call<{ styles: PaintStyle[]; homeStyles: boolean }>('/iris/styles', { method: 'PUT', body: JSON.stringify({ styles }) }),
  setIrisHomeStyles: (homeStyles: boolean) => call<{ styles: PaintStyle[]; homeStyles: boolean }>('/iris/home-styles', { method: 'PUT', body: JSON.stringify({ homeStyles }) }),
  forgetIrisFeedback: (id: string) => call<IrisFeedback[]>(`/iris/feedback/${id}`, { method: 'DELETE' }),
  eventsUrl: (id: string) => `/api/conversations/${id}/events`,
};
