// Keeps an episode from sounding canned: the stock podcast phrases already said on the show, and the
// words a host keeps leaning on, so the next line can find fresh ones. English episodes only (the lists
// are English).

/** Filler and stock phrases that make AI talk sound samey once they come round a second time. */
export const STOCK_PHRASES = [
  'honestly', 'i mean', 'fair point', 'good point', 'great point', 'fair enough', 'absolutely', 'exactly', 'totally',
  'that said', 'at the end of the day', 'to be fair', 'i hear you', "you're right", "here's the thing", 'the thing is',
  "let's be real", 'for sure', 'i love that', 'game changer', 'it depends', 'spot on', 'i get that', 'you know what',
  'in my experience', 'at its core', 'the reality is', 'interesting point', 'great question', 'deep dive', 'unpack',
] as const;

const norm = (t: string) => ` ${t.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ')} `;

/** The stock phrases already said on this show, most-used first. */
export function usedStock(texts: string[]): string[] {
  const all = texts.map(norm).join(' ');
  return STOCK_PHRASES
    .map(p => ({ p, n: all.split(` ${p} `).length - 1 }))
    .filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .map(x => x.p);
}

const STOP = new Set(`about above after again against because before being below between could doing during every from further having here itself just more most other ought over same should some such than that their theirs them themselves then there these they this those through under until very were what when where which while whom why with would your yours really still maybe think thing things people actually something someone going point right yeah okay make makes made much many even also into only well like just want need lot`.split(/\s+/));

/** Words (5+ letters) this host has used three times or more that aren't the topic's own words. */
export function petWords(texts: string[], topic: string, min = 3): string[] {
  const topical = new Set(norm(topic).trim().split(' ').filter(w => w.length >= 5).map(w => w.replace(/s$/, '')));
  const counts = new Map<string, number>();
  for (const w of norm(texts.join(' ')).trim().split(' ')) {
    if (w.length < 5 || STOP.has(w) || w.includes("'")) continue;
    const stem = w.replace(/s$/, '');
    if (topical.has(stem)) continue;
    counts.set(stem, (counts.get(stem) ?? 0) + 1);
  }
  return [...counts].filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
}

/** The freshness note for the next line, or '' when there's nothing to steer away from. */
export function freshnessNote(showTexts: string[], ownTexts: string[], topic: string): string {
  const stock = usedStock(showTexts).slice(0, 8);
  const pets = petWords(ownTexts, topic);
  return [
    stock.length ? `Already said on this show, so don't use them again: ${stock.map(s => `"${s}"`).join(', ')}. Find your own way in.` : '',
    pets.length ? `Words you've leaned on: ${pets.map(s => `"${s}"`).join(', ')}. Use fresh ones.` : '',
  ].filter(Boolean).join(' ');
}
