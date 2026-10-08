// Product constants shared by the server and the web app. Values follow docs/PLAN.md.

export const PRESETS = [
  'Will AI help independent businesses?',
  'Should cities prioritize cars or pedestrians?',
  'Is a four-day workweek practical?',
  'What would an ideal future restaurant look like?',
  'Can technology improve golf without changing its character?',
] as const;

/**
 * The job of each turn, shown on the turn rail. Index 0 is turn 1; Speaker A takes odd turns.
 * Sixteen short turns so an episode flows like two friends talking, not two speeches.
 */
export const JOBS = [
  'Hello', 'First take', 'Frame', 'Push back', 'Story', 'React', 'Example', 'Test',
  'Big idea', 'Catch', 'Rethink', 'Curveball', 'Common ground', 'Still unsure', 'Takeaway', 'Sign-off',
] as const;

export const MAX_TURNS = 16;
export const DAILY_LIMIT_DEFAULT = 40;
/** The default listener cue limit; the Control room can set 0–6. */
export const CUE_LIMIT = 3;
/** Mind-change meter: the jobs where each host says how sure they are (first lines) and whether it moved (last lines). */
export const STANCE_START_JOBS = ['Hello', 'First take'] as const;
export const STANCE_END_JOBS = ['Takeaway', 'Sign-off'] as const;
/** A challenge or a guest line: a sentence or two. */
export const CUE_TEXT_MAX = 200;
/** A branch always generates this many new turns, with these jobs. */
export const BRANCH_TURNS = 4;
export const BRANCH_JOBS = ['New direction', 'Pressure test', 'Example', 'Close'] as const;
export const TOPIC_MAX = 200;
export const TITLE_MAX = 120;
export const NAME_MAX = 28;
export const LENS_MAX = 120;
export const ROLE_MAX = 80;

export const MODES = {
  explore: { label: 'Explore', help: 'They build on each other: one frames, the other widens, and both work through examples and trade-offs.' },
  debate: { label: 'Friendly Debate', help: 'They start from contrasting lenses and can concede or revise. No winner is declared.' },
} as const;

export const FORMATS = {
  recorded: { label: 'Recorded', help: 'Produced first, then you review it and publish when it is ready.' },
  live: { label: 'Live', help: 'Goes out as it happens: each turn is spoken aloud the moment it is finished. Your cues are part of the show.' },
} as const;

export const AUDIENCES = {
  kids: { label: 'Kids', help: 'Simple words, short turns, ages about 8 to 12. No frightening or grown-up themes, no politics.' },
  teens: { label: 'Teens', help: 'Ages about 13 to 17. Real topics, relatable examples, nothing explicit. Political topics stay balanced.' },
  general: { label: 'General', help: 'Everyday listeners. Clear and friendly.' },
  mature: { label: 'Mature', help: 'Grown-up themes discussed frankly: money, work, loss, relationships. Never explicit or graphic.' },
  expert: { label: 'Expert', help: 'Listeners who know the field. Technical terms, deeper trade-offs, no hand-holding.' },
} as const;

export const TEMPERATURES = {
  calm: { label: 'Calm', level: 1, help: 'Sober and measured. They concede easily and weigh things carefully.' },
  lively: { label: 'Lively', level: 2, help: 'Real back-and-forth. They push back and have some fun with it.' },
  heated: { label: 'Heated', level: 3, help: 'Blunt and passionate. They hold their ground longer, but never insult each other.' },
} as const;

export const TEMPERATURE_ORDER = ['calm', 'lively', 'heated'] as const;

export const PERSONAS = {
  optimist: { label: 'The Optimist', lens: 'Imaginative, practical, looks for opportunities' },
  skeptic: { label: 'The Skeptic', lens: 'Analytical, skeptical, watches for constraints' },
  professor: { label: 'The Professor', lens: 'Explains with evidence and history; careful with claims' },
  comedian: { label: 'The Comedian', lens: 'Makes the point through wit and everyday absurdities' },
  contrarian: { label: 'The Contrarian', lens: 'Takes the less popular side to stress-test the idea' },
  storyteller: { label: 'The Storyteller', lens: 'Argues through vivid stories and real-life scenes' },
  pragmatist: { label: 'The Pragmatist', lens: 'Cares about what works, what it costs and who does the work' },
  philosopher: { label: 'The Philosopher', lens: 'Asks what we value and why it matters' },
  custom: { label: 'Custom', lens: '' },
} as const;

export const ARTIST = { name: 'Iris', role: 'the Artist' } as const;

export const NOTICE = 'AI-generated; not independently verified.';
/** Shown instead of NOTICE on episodes made from a Scout topic. */
export const SCOUT_NOTICE = 'Brief from the linked sources; discussion AI-generated, not verified.';

/** Topic Scout (docs/PLAN.md, "Topic Scout and Autopilot"). */
export const SCOUT_CATS = {
  politics: 'Politics', tech: 'Technology', economy: 'Economy', business: 'Business', scandals: 'Scandals',
  global: 'Global affairs', science: 'Science', sports: 'Sports', culture: 'Culture & food', society: 'Cities & society',
} as const;
export const SCOUT_REGIONS = { local: 'Local', na: 'North America', europe: 'Europe', asia: 'Asia', world: 'World' } as const;
/** Sensitive categories: off by default, never for Kids, and always balanced and sourced. */
export const SENSITIVE_CATS = ['politics', 'scandals'] as const;
/** A full Autopilot episode: 16 turns, host roles and Iris. */
export const AUTOPILOT_REQUESTS = 18;
