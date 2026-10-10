import { useState } from 'react';
import { TOPIC_IDEAS, type TopicTheme } from '@crosstalk/shared';

const THEMES = Object.keys(TOPIC_IDEAS) as TopicTheme[];
const KEY = 'ct_topic_theme';

/** Topic ideas by theme: pick a theme, then a question, or let it surprise you. */
export function TopicIdeas({ topic, onPick }: { topic: string; onPick: (q: string) => void }) {
  const [theme, setTheme] = useState<TopicTheme>(() => {
    try { const t = localStorage.getItem(KEY); return t && t in TOPIC_IDEAS ? t as TopicTheme : 'work'; } catch { return 'work'; }
  });
  const choose = (t: TopicTheme) => { setTheme(t); try { localStorage.setItem(KEY, t); } catch { /* private window */ } };
  const surprise = () => {
    const all = THEMES.flatMap(t => TOPIC_IDEAS[t].questions.map(q => [t, q] as const)).filter(([, q]) => q !== topic);
    const [t, q] = all[Math.floor(Math.random() * all.length)];
    choose(t);
    onPick(q);
  };
  return (
    <div className="topic-ideas">
      <div className="ti-head">
        <span className="tag">Ideas</span>
        <button className="link-btn" onClick={surprise}>🎲 Surprise me</button>
      </div>
      <div className="ti-themes" role="group" aria-label="Topic themes">
        {THEMES.map(t => (
          <button key={t} className="chip sm" aria-pressed={theme === t} onClick={() => choose(t)}>
            <span aria-hidden="true">{TOPIC_IDEAS[t].icon}</span> {TOPIC_IDEAS[t].label}
          </button>
        ))}
      </div>
      <div className="chips ti-questions" role="group" aria-label={`${TOPIC_IDEAS[theme].label} topics`}>
        {TOPIC_IDEAS[theme].questions.map(q => <button key={q} className="chip" aria-pressed={topic === q} onClick={() => onPick(q)}>{q}</button>)}
      </div>
    </div>
  );
}
