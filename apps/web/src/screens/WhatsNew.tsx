import { useState } from 'react';

const KEY = 'ct_seen_new';
// Bump when there's something new to show; each listener sees it once until they close it.
const EDITION = '2026-10-09';

const ITEMS = [
  { icon: '🎬', title: 'Social clip', text: 'Any finished episode becomes a vertical video with live captions, the mind-change meter, Iris’s art and music composed for it. Read → Episode kit.' },
  { icon: '🖼', title: 'Iris print', text: 'Her painting as a print-ready A4 page, with listing text that says it’s AI-made. Read → Episode kit.' },
  { icon: '👏', title: 'React while you listen', text: 'Tap 👏 🤔 😂 😮 ❤️ on Watch or Listen. The hosts react back, and Iris draws the line you loved.' },
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
