import { useState } from 'react';

const KEY = 'ct_seen_new';
// Bump when there's something new to show; each listener sees it once until they close it.
const EDITION = '2026-10-10';

const ITEMS = [
  { icon: '📷', title: 'Real AI photos', text: 'With a free Cloudflare account, the hosts and Iris\'s pictures are real AI-made photographs. Settings → Pictures → Try the camera shows one in a minute.' },
  { icon: '🎨', title: 'Iris in three styles', text: 'A photograph, a dreamscape or a pencil sketch, each made by AI from her brief. While it\'s on its way she paints her own, stroke by stroke.' },
  { icon: '🏔️', title: 'Topic ideas by theme', text: 'Nature & outdoors, sports, work, science and more, or Surprise me. Every one a fair, two-sided question.' },
  { icon: '😄', title: 'They laugh together', text: 'When a host cracks a joke, the other one laughs along.' },
];

/** A short "what's new" card, once per edition, closed for good with one tap. */
export function WhatsNew() {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(KEY) !== EDITION; } catch { return false; } });
  if (!open) return null;
  const close = () => { setOpen(false); try { localStorage.setItem(KEY, EDITION); } catch { /* storage blocked */ } };
  return (
    <section className="whats-new" aria-label="What's new">
      <div className="wn-head"><span className="tag">New in CrossTalk</span><button className="link-btn" onClick={close}>Got it</button></div>
      <ul>{ITEMS.map(i => <li key={i.title}><span className="wn-icon" aria-hidden="true">{i.icon}</span><span><b>{i.title}</b> <span className="hint">{i.text}</span></span></li>)}</ul>
    </section>
  );
}
