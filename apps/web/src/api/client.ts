// Typed calls to the local server. The browser never talks to a model.
import type { AppConfig, ArtistNotes, BranchInput, Conversation, ConversationView, CreateConversation, CueInput, IrisFeedback, MockSettings, Run } from '@crosstalk/shared';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const body = await res.json().catch(() => ({}));
  // A hosted CrossTalk is locked: any 401 sends you back to the access-code screen.
  if (res.status === 401 && (body as { locked?: boolean }).locked) dispatchEvent(new Event('crosstalk:locked'));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export type Access = { required: boolean; ok: boolean };
export type ConversationSummary = Conversation & { run: Run | null; turnCount: number; artist?: ArtistNotes | null; branchCount: number };

export const api = {
  config: () => call<AppConfig>('/config'),
  checkModels: () => call<AppConfig>('/guard/check', { method: 'POST' }),
  setMock: (m: MockSettings) => call<MockSettings>('/mock', { method: 'PUT', body: JSON.stringify(m) }),
  access: () => call<Access>('/access'),
  unlock: (code: string) => call<Access>('/access', { method: 'POST', body: JSON.stringify({ code }) }),
  lock: () => call<Access>('/access', { method: 'DELETE' }),
  list: () => call<ConversationSummary[]>('/conversations'),
  get: (id: string) => call<ConversationView>(`/conversations/${id}`),
  create: (c: CreateConversation) => call<ConversationView>('/conversations', { method: 'POST', body: JSON.stringify(c) }),
  start: (id: string) => call<ConversationView>(`/conversations/${id}/start`, { method: 'POST' }),
  pause: (id: string) => call<ConversationView>(`/conversations/${id}/pause`, { method: 'POST' }),
  stop: (id: string) => call<ConversationView>(`/conversations/${id}/stop`, { method: 'POST' }),
  rename: (id: string, title: string) => call<ConversationView>(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  remove: (id: string) => call<unknown>(`/conversations/${id}`, { method: 'DELETE' }),

  addCue: (id: string, cue: CueInput) => call<ConversationView>(`/conversations/${id}/cues`, { method: 'POST', body: JSON.stringify(cue) }),
  cancelCue: (id: string, cueId: string) => call<ConversationView>(`/conversations/${id}/cues/${cueId}`, { method: 'DELETE' }),
  branch: (id: string, b: BranchInput) => call<ConversationView>(`/conversations/${id}/branch`, { method: 'POST', body: JSON.stringify(b) }),
  askIris: (id: string) => call<ConversationView>(`/conversations/${id}/artist`, { method: 'POST' }),
  irisFeedback: () => call<IrisFeedback[]>('/iris/feedback'),
  sendIrisFeedback: (f: { conversationId: string | null; rating: 'up' | 'down'; note: string }) => call<IrisFeedback[]>('/iris/feedback', { method: 'POST', body: JSON.stringify(f) }),
  forgetIrisFeedback: (id: string) => call<IrisFeedback[]>(`/iris/feedback/${id}`, { method: 'DELETE' }),
  eventsUrl: (id: string) => `/api/conversations/${id}/events`,
};
