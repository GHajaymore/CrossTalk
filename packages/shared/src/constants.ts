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

/** The longest episode (Long). Normal is 16, Short is 8. */
export const MAX_TURNS = 24;

/** Episode length. Every length keeps the shape: opening stances, a story, the catch, a rethink, the takeaway. */
// Minutes are listening time at a normal pace: a turn is about 45 spoken words, roughly 18 seconds.
export const LENGTHS = {
  short: { label: 'Short', minutes: 3, turns: 8, help: '8 turns: the opening, a story, the catch, a rethink and the takeaway. About 9 free requests with Iris.' },
  normal: { label: 'Normal', minutes: 5, turns: 16, help: '16 short turns: the whole back-and-forth. About 17 free requests with Iris.' },
  long: { label: 'Long', minutes: 8, turns: 24, help: '24 turns: everything in Normal, plus a second story, the hardest case, a middle path and what changed their minds. About 25 free requests with Iris.' },
} as const;
/**
 * The language an episode is spoken in. English by default. `native` is how it's written in itself;
 * `hello` opens a mock episode so you can hear the voice; `invite` and `later` are a host's lines when you raise your hand; `rtl` languages are written right to left.
 */
export const LANGUAGES = {
  en: { label: 'English', native: 'English', hello: '', invite: '', later: '' },
  es: { label: 'Spanish', native: 'Español', hello: '¡Hola y bienvenidos a CrossTalk!', invite: 'Tenemos a alguien con la mano levantada. Adelante, estás al aire.', later: 'No pasa nada, quizá más tarde. ¿Dónde estábamos?' },
  hi: { label: 'Hindi', native: 'हिन्दी', hello: 'नमस्ते, क्रॉसटॉक में आपका स्वागत है!', invite: 'लगता है किसी श्रोता ने हाथ उठाया है। बोलिए, आप ऑन एयर हैं।', later: 'कोई बात नहीं, शायद बाद में। तो, हम कहाँ थे?' },
  pt: { label: 'Portuguese', native: 'Português', hello: 'Olá, bem-vindos ao CrossTalk!', invite: 'Temos alguém com a mão levantada. Pode falar, você está no ar.', later: 'Tudo bem, talvez mais tarde. Onde estávamos?' },
  fr: { label: 'French', native: 'Français', hello: 'Bonjour et bienvenue sur CrossTalk !', invite: "On a quelqu'un qui lève la main. Allez-y, vous êtes à l'antenne.", later: 'Pas de souci, peut-être plus tard. On en était où ?' },
  de: { label: 'German', native: 'Deutsch', hello: 'Hallo und willkommen bei CrossTalk!', invite: 'Da hat sich jemand gemeldet. Bitte, Sie sind auf Sendung.', later: 'Kein Problem, vielleicht später. Wo waren wir?' },
  ar: { label: 'Arabic', native: 'العربية', hello: 'مرحبًا بكم في كروس توك!', invite: 'يبدو أن أحد المستمعين رفع يده. تفضل، أنت على الهواء.', later: 'لا بأس، ربما لاحقًا. أين كنا؟', rtl: true },
  ja: { label: 'Japanese', native: '日本語', hello: 'こんにちは、クロストークへようこそ！', invite: 'リスナーの方が手を挙げています。どうぞ、オンエアです。', later: '大丈夫です、また後で。どこまで話しましたっけ？' },
  ko: { label: 'Korean', native: '한국어', hello: '안녕하세요, 크로스토크에 오신 것을 환영합니다!', invite: '손을 드신 청취자분이 계시네요. 말씀하세요, 방송 중입니다.', later: '괜찮아요, 나중에 하셔도 돼요. 어디까지 얘기했죠?' },
  zh: { label: 'Chinese', native: '中文', hello: '大家好，欢迎收听 CrossTalk！', invite: '有位听众举手了。请说，您正在直播中。', later: '没关系，等会儿再说。我们刚才说到哪儿了？' },
  it: { label: 'Italian', native: 'Italiano', hello: 'Ciao e benvenuti a CrossTalk!', invite: "C'è qualcuno con la mano alzata. Prego, sei in onda.", later: 'Nessun problema, magari più tardi. Dove eravamo?' },
  id: { label: 'Indonesian', native: 'Bahasa Indonesia', hello: 'Halo, selamat datang di CrossTalk!', invite: 'Ada pendengar yang mengangkat tangan. Silakan, Anda sedang mengudara.', later: 'Tidak apa-apa, mungkin nanti. Sampai mana kita tadi?' },
} as const satisfies Record<string, { label: string; native: string; hello: string; invite: string; later: string; rtl?: boolean }>;
/** Languages with a whole sample episode in mock mode; the others greet in theirs, then play the English one. */
export const MOCK_FULL_LANGUAGES = ['es', 'hi'] as const;
export const isRtl = (lang: string) => !!(LANGUAGES as Record<string, { rtl?: boolean }>)[lang]?.rtl;

/** Which of Normal's 16 turns each short turn plays. Odd stays odd, so each host keeps their seat. */
export const SHORT_PLAN = [1, 2, 5, 10, 11, 14, 15, 16] as const;
/** Long: Normal's first 12 turns, eight deeper ones, then Normal's last 4. Each host keeps their seat. */
export const LONG_JOBS = [
  'Hello', 'First take', 'Frame', 'Push back', 'Story', 'React', 'Example', 'Test', 'Big idea', 'Catch', 'Rethink', 'Curveball',
  'Dig in', 'Counterpoint', 'Second story', 'Hard case', 'Middle path', 'Stress test', 'What changed', 'Open question',
  'Common ground', 'Still unsure', 'Takeaway', 'Sign-off',
] as const;
export const DAILY_LIMIT_DEFAULT = 40;
/** The default listener cue limit; the Control room can set 0–6. */
export const CUE_LIMIT = 3;
/** The pause reason when a listener raised their hand: the next host invites them in. */
export const HAND_RAISED = 'hand raised';
/** How long the hosts wait for someone they invited in before carrying on. */
export const HAND_WAIT_S = 15;
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
  hotseat: { label: 'Hot seat', help: 'One host defends the less popular answer as strongly as it can honestly be argued; the other tries to win them over. At the end, you say who moved you.' },
} as const;

/** Hot seat: the listener's verdict at the end (never Iris's, never the hosts'). */
export const VERDICTS = {
  held: 'The hot seat held',
  won: 'The challenger won me over',
  torn: "I'm torn",
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

/**
 * How a host sounds. Device voices can't really act, so each style is a small change of pace and
 * pitch, plus a line in the host's prompt about how they speak. Auto follows their personality.
 */
/** Reactions a listener can tap while an episode plays. The label says what each one means (never the emoji alone). */
export const REACTIONS = {
  clap: { emoji: '👏', label: 'Applause' },
  hmm: { emoji: '🤔', label: 'Makes me think' },
  funny: { emoji: '😂', label: 'Funny' },
  wow: { emoji: '😮', label: 'Surprising' },
  love: { emoji: '❤️', label: 'Love this' },
} as const;
/** At most this many reactions per episode, so a stuck finger can't flood it. */
export const REACTIONS_MAX = 300;

export const VOICE_STYLES = {
  warm: { label: 'Warm', help: 'Unhurried and friendly, a little lower.', rate: 0.96, pitch: 0.94, speak: 'warm and unhurried: friendly, generous phrasing' },
  energetic: { label: 'Energetic', help: 'Quicker and brighter.', rate: 1.08, pitch: 1.06, speak: 'energetic and quick: short punchy sentences' },
  calm: { label: 'Calm', help: 'Slower and steady.', rate: 0.9, pitch: 0.98, speak: 'calm and measured: steady, considered phrasing' },
} as const;

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
/** Where the Scout looks. All free, no accounts or keys. Social ones are opinions, never facts. */
export const SCOUT_SOURCES = {
  news: 'News sites', trends: 'Google Trends', reddit: 'Reddit', social: 'Bluesky & Mastodon', hn: 'Hacker News', wikipedia: 'Wikipedia',
} as const;
/** In real mode, a manual Refresh (one request) waits this long after the last one. */
export const SCOUT_REFRESH_WAIT_MIN = 30;
export const SCOUT_REGIONS = {
  local: 'Local', na: 'North America', latam: 'Latin America', europe: 'Europe', mideast: 'Middle East', africa: 'Africa', asia: 'Asia', oceania: 'Oceania', world: 'World',
} as const;
/** Countries you can follow (Google Trends covers each). Codes are ISO 3166. */
export const SCOUT_COUNTRIES = {
  US: 'United States', CA: 'Canada', MX: 'Mexico', BR: 'Brazil', AR: 'Argentina', CO: 'Colombia',
  GB: 'United Kingdom', IE: 'Ireland', FR: 'France', DE: 'Germany', ES: 'Spain', IT: 'Italy', NL: 'Netherlands', PL: 'Poland', UA: 'Ukraine',
  TR: 'Türkiye', IL: 'Israel', SA: 'Saudi Arabia', AE: 'United Arab Emirates', EG: 'Egypt',
  NG: 'Nigeria', KE: 'Kenya', ZA: 'South Africa',
  IN: 'India', PK: 'Pakistan', BD: 'Bangladesh', JP: 'Japan', KR: 'South Korea', SG: 'Singapore', PH: 'Philippines', ID: 'Indonesia',
  AU: 'Australia', NZ: 'New Zealand',
} as const;
/** Your own news sites (RSS links) the Scout also reads. */
export const SCOUT_MAX_FEEDS = 5;
export const SCOUT_INTERESTS_MAX = 160;
/** Sensitive categories: off by default, never for Kids, and always balanced and sourced. */
export const SENSITIVE_CATS = ['politics', 'scandals'] as const;
/** A full Autopilot episode: 16 turns, host roles and Iris. */
export const AUTOPILOT_REQUESTS = 18;
