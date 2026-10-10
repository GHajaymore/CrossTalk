import { useState } from 'react';

const KEY = 'ct_seen_new';
// Bump when there's something new to show; each listener sees it once until they close it.
const EDITION = '2026-10-13';

const ITEMS = [
  { icon: '📷', title: 'Photo of the day', text: 'Eight photo ideas a day on the Iris page, or your own words. Keep the best in My photos.' },
  { icon: '🎯', title: 'The crux', text: 'Each host names what would change their mind. See it on Read.' },
  { icon: '🖼️', title: 'Real AI photos', text: 'Iris briefs the camera like an editorial photographer.' },
  { icon: '🧭', title: 'Calmer pages', text: 'Topic ideas and the news in tabs; hosts and styles fold away until you change them.' },
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
