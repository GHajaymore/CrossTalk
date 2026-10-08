export function clock(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** The last few words, for a caption that follows streaming text. */
export function tail(text: string, words = 22) {
  const w = text.split(' ');
  return (w.length > words ? '… ' : '') + w.slice(-words).join(' ');
}

export function lastSentence(text: string) {
  const parts = text.split(/(?<=[.?!])\s+/);
  return parts[parts.length - 1] ?? '';
}

/** Rough spoken length: about 2.6 words a second. */
export const spokenSeconds = (texts: string[]) => texts.reduce((n, t) => n + t.split(' ').length, 0) / 2.6;
