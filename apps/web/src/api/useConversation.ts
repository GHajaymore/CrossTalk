import { useEffect, useRef, useState } from 'react';
import type { ConversationView, LiveTurn, StreamEvent } from '@crosstalk/shared';
import { api } from './client';

/**
 * Follows one conversation over Server-Sent Events: full snapshots on every change,
 * live tokens in between. `pulse` changes on every streamed word (drives the voice meter).
 */
export function useConversation(id: string | null, onChange?: () => void) {
  const [view, setView] = useState<ConversationView | null>(null);
  const [live, setLive] = useState<LiveTurn | null>(null);
  const [pulse, setPulse] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const changed = useRef(onChange);
  changed.current = onChange;

  useEffect(() => {
    setView(null); setLive(null); setError(null);
    if (!id) return;
    const es = new EventSource(api.eventsUrl(id));
    es.onmessage = msg => {
      const e = JSON.parse(msg.data) as StreamEvent;
      if (e.type === 'snapshot') {
        const v = e.conversation;
        setView(v);
        setError(null);
        setLive(v.run?.state === 'generating' ? e.live : null);
        changed.current?.();
      } else if (e.type === 'turn-start') {
        setLive({ seq: e.seq, speakerId: e.speakerId, objective: e.objective, modelId: e.modelId, text: '' });
      } else if (e.type === 'token') {
        setLive(l => (l && l.seq === e.seq ? { ...l, text: l.text + e.text } : l));
        setPulse(0.16 + Math.random() * 0.25);
      }
    };
    es.onerror = () => {
      // EventSource reconnects on its own; tell the user if the server is gone.
      api.get(id).then(v => setView(v)).catch(err => setError(err.message === 'Conversation not found.' ? err.message : 'Lost the connection to the local server. Retrying…'));
    };
    return () => es.close();
  }, [id]);

  return { view, live, pulse, error, setView };
}
