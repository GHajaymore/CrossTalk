import { useState } from 'react';
import { EDITION as WHATS_NEW_EDITION, WhatsNew } from './WhatsNew';

const KEY = 'ct_welcomed';

// Three steps, each with the place on the page it's about.
const STEPS = [
  { title: 'Pick a question', text: 'Type one worth two points of view, or tap 💡 Ideas or 📰 In the news for one.', target: 'topic' },
  { title: 'Shape it, then record', text: 'Choose the mode, length and mood, then ● Start recording. Two AI hosts talk it through in about 5 minutes, and you can cut in with a question.', target: 'shape-h' },
  { title: 'Meet Iris', text: 'When they finish, Iris, the artist in the booth, says what stayed with her and makes a picture of that moment. Tell her what you think and she learns your taste.', target: 'booth-note' },
];

/**
 * First visit: a three-step welcome, once, easy to skip. After that (or for anyone who has used the app
 * before), the usual What's new card.
 */
export function Welcome() {
  const [step, setStep] = useState<number | null>(() => {
    try {
      if (localStorage.getItem(KEY)) return null;
      // Someone who already saw a What's new card isn't new here.
      return localStorage.getItem('ct_seen_new') ? null : 0;
    } catch { return null; }
  });
  if (step === null) return <WhatsNew />;
  const done = () => {
    setStep(null);
    // A new visitor has nothing to catch up on, so this edition's What's new is skipped too.
    try { localStorage.setItem(KEY, '1'); localStorage.setItem('ct_seen_new', WHATS_NEW_EDITION); } catch { /* storage blocked */ }
  };
  const s = STEPS[step];
  const show = () => {
    const el = document.getElementById(s.target) ?? document.querySelector<HTMLElement>(`.${s.target}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (el instanceof HTMLTextAreaElement) el.focus({ preventScroll: true });
  };
  return (
    <section className="welcome" aria-label="Welcome to CrossTalk">
      <div className="wn-head">
        <span className="tag">Welcome · step {step + 1} of {STEPS.length}</span>
        <button className="link-btn" onClick={done}>Skip</button>
      </div>
      <div className="welcome-step" aria-live="polite">
        <b>{s.title}</b>
        <p>{s.text}</p>
      </div>
      <div className="welcome-actions">
        <span className="welcome-dots" aria-hidden="true">{STEPS.map((_, i) => <i key={i} className={i === step ? 'on' : undefined} />)}</span>
        <button className="btn sm ghost" onClick={show}>Show me</button>
        {step > 0 && <button className="btn sm ghost" onClick={() => setStep(step - 1)}>Back</button>}
        {step < STEPS.length - 1
          ? <button className="btn sm primary" onClick={() => setStep(step + 1)}>Next</button>
          : <button className="btn sm primary" onClick={done}>Let's go</button>}
      </div>
    </section>
  );
}
