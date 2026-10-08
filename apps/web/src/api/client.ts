// Typed calls to the local server. The browser never talks to a model.
import type { AppConfig, Conversation, ConversationView, CreateConversation, MockSettings, Run } from '@crosstalk/shared';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export type ConversationSummary = Conversation & { run: Run | null; turnCount: number };

export const api = {
  config: () => call<AppConfig>('/config'),
  checkModels: () => call<AppConfig>('/guard/check', { method: 'POST' }),
  setMock: (m: MockSettings) => call<MockSettings>('/mock', { method: 'PUT', body: JSON.stringify(m) }),
  list: () => call<ConversationSummary[]>('/conversations'),
  get: (id: string) => call<ConversationView>(`/conversations/${id}`),
  create: (c: CreateConversation) => call<ConversationView>('/conversations', { method: 'POST', body: JSON.stringify(c) }),
  start: (id: string) => call<ConversationView>(`/conversations/${id}/start`, { method: 'POST' }),
  pause: (id: string) => call<ConversationView>(`/conversations/${id}/pause`, { method: 'POST' }),
  stop: (id: string) => call<ConversationView>(`/conversations/${id}/stop`, { method: 'POST' }),
  eventsUrl: (id: string) => `/api/conversations/${id}/events`,
};
