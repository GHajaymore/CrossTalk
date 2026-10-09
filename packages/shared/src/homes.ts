// A host's home: where they're from shapes how they talk on air (scaled by the Temperature dial),
// their auto name, their invented face and, where the device has one, an English voice from there.
// Styles describe broadcast habits as tendencies, never as rules about people: no accents written
// out, no slang for show, no clichés. Everyone in a country looks different, so faces draw from a range.
import { SCOUT_COUNTRIES, SCOUT_REGIONS } from './constants';
import type { HomeStyle, PaintStyle } from './paint';
import type { Language } from './schemas';

export type HomeCode = keyof typeof SCOUT_COUNTRIES;

/** How hosts from a place often argue on air. `label` shows on the Create screen; `how` goes in the prompt. */
export const TALK_STYLES = {
  upbeat: { label: 'Direct and upbeat', how: 'you say where you stand early, back it with a personal story or a practical example, and push back openly but cheerfully.' },
  dry: { label: 'Understated and dry', how: 'you disagree politely ("I\'m not sure that\'s quite right"), use gentle irony, and let a well-chosen example do the arguing.' },
  plain: { label: 'Plain-spoken and relaxed', how: 'you call things as you see them, keep it informal, and puncture anything that sounds too grand.' },
  principled: { label: 'Lively and principled', how: 'you enjoy the argument itself, reach for ideas and history, and happily jump in on a weak point.' },
  structured: { label: 'Frank and structured', how: 'you say plainly when you disagree, lay out your reasons in order, and expect facts to settle it.' },
  warm: { label: 'Warm and expressive', how: 'you argue with feeling and humour, bring in family and neighbourhood examples, and keep it personal.' },
  quick: { label: 'Quick and passionate', how: 'you come in fast, argue hard and openly, and stay warm with your co-host the whole time.' },
  courteous: { label: 'Courteous and eloquent', how: 'you honour the other person\'s point before answering it, and make yours with a vivid story or image.' },
  spirited: { label: 'Warm and spirited', how: 'you argue with energy and humour, bring in community and everyday examples, and show respect even when you disagree strongly.' },
  thorough: { label: 'Animated and thorough', how: 'you build your case with examples and background, come in readily with a counterpoint, and keep it good-humoured.' },
  considered: { label: 'Considered and polite', how: 'you acknowledge the other view first, disagree gently ("that may be true, but…"), and let careful examples carry your point.' },
  pragmatic: { label: 'Friendly and pragmatic', how: 'you look for common ground, disagree with good humour, and keep coming back to what works in practice.' },
} as const;
export type TalkStyle = keyof typeof TALK_STYLES;

/** How strongly the style shows, following the episode's Temperature. */
export const STYLE_STRENGTH = {
  calm: 'Let it show lightly: mostly in your manners and your examples.',
  lively: 'Let it shape your manner and your examples.',
  heated: 'Lean into it: let it shape how quickly you come in, how you push back and how you hold your ground.',
} as const;

export type Home = {
  region: Exclude<keyof typeof SCOUT_REGIONS, 'local' | 'world'>;
  style: TalkStyle;
  /** An English voice from there (BCP 47), when devices commonly have one. Otherwise the usual voices. */
  voice: string | null;
  women: string[];
  men: string[];
  surnames: string[];
  /** Skin tones (0–5) and hair colours (0–5) an invented face is drawn from. */
  skins: number[];
  hair: number[];
};

const ALL = [0, 1, 2, 3, 4, 5];
const DARK_HAIR = [0, 1];
const MOST_HAIR = [0, 1, 2, 3];

export const HOMES: Record<HomeCode, Home> = {
  US: { region: 'na', style: 'upbeat', voice: 'en-US', women: ['Maya', 'Claire', 'Jasmine', 'Rachel', 'Tessa', 'Brooke'], men: ['Marcus', 'Ethan', 'Caleb', 'Tyler', 'Derek', 'Andre'], surnames: ['Carter', 'Brooks', 'Hayes', 'Bennett'], skins: ALL, hair: ALL },
  CA: { region: 'na', style: 'upbeat', voice: 'en-CA', women: ['Leah', 'Sienna', 'Gabrielle', 'Megan'], men: ['Liam', 'Owen', 'Mathieu', 'Connor'], surnames: ['Tremblay', 'MacLeod', 'Gagnon', 'Fraser'], skins: ALL, hair: ALL },
  MX: { region: 'latam', style: 'warm', voice: null, women: ['Valeria', 'Ximena', 'Lucía', 'Fernanda'], men: ['Diego', 'Santiago', 'Emiliano', 'Rodrigo'], surnames: ['Hernández', 'Ortega', 'Ramírez', 'Castillo'], skins: [1, 2, 3, 4], hair: [0, 1, 2] },
  BR: { region: 'latam', style: 'warm', voice: null, women: ['Camila', 'Beatriz', 'Larissa', 'Juliana'], men: ['Thiago', 'Rafael', 'Lucas', 'Gustavo'], surnames: ['Silva', 'Oliveira', 'Souza', 'Carvalho'], skins: [1, 2, 3, 4, 5], hair: MOST_HAIR },
  AR: { region: 'latam', style: 'warm', voice: null, women: ['Florencia', 'Agustina', 'Martina', 'Valentina'], men: ['Facundo', 'Joaquín', 'Matías', 'Tomás'], surnames: ['Fernández', 'Gómez', 'Sosa', 'Romero'], skins: [0, 1, 2, 3], hair: MOST_HAIR },
  CO: { region: 'latam', style: 'warm', voice: null, women: ['Daniela', 'Mariana', 'Catalina', 'Paola'], men: ['Andrés', 'Camilo', 'Sebastián', 'Felipe'], surnames: ['Restrepo', 'Ospina', 'Vargas', 'Cárdenas'], skins: [1, 2, 3, 4, 5], hair: [0, 1, 2] },
  GB: { region: 'europe', style: 'dry', voice: 'en-GB', women: ['Harriet', 'Imogen', 'Eleanor', 'Phoebe'], men: ['Oliver', 'Callum', 'Hugo', 'Alfie'], surnames: ['Hughes', 'Whitaker', 'Patel', 'Ashworth'], skins: ALL, hair: ALL },
  IE: { region: 'europe', style: 'dry', voice: 'en-IE', women: ['Aoife', 'Niamh', 'Siobhán', 'Róisín'], men: ['Cian', 'Oisín', 'Darragh', 'Seán'], surnames: ['Byrne', 'Murphy', 'Kavanagh', 'Doyle'], skins: [0, 1, 2], hair: ALL },
  FR: { region: 'europe', style: 'principled', voice: null, women: ['Margaux', 'Juliette', 'Inès', 'Élodie'], men: ['Antoine', 'Julien', 'Mathis', 'Bastien'], surnames: ['Lefèvre', 'Girard', 'Bonnet', 'Mercier'], skins: [0, 1, 2, 3, 5], hair: ALL },
  DE: { region: 'europe', style: 'structured', voice: null, women: ['Lena', 'Johanna', 'Katrin', 'Miriam'], men: ['Jonas', 'Felix', 'Lukas', 'Matthias'], surnames: ['Becker', 'Hoffmann', 'Krüger', 'Weber'], skins: [0, 1, 2], hair: ALL },
  ES: { region: 'europe', style: 'principled', voice: null, women: ['Carmen', 'Paula', 'Nerea', 'Lucía'], men: ['Javier', 'Pablo', 'Álvaro', 'Iker'], surnames: ['García', 'Navarro', 'Ruiz', 'Moreno'], skins: [0, 1, 2], hair: MOST_HAIR },
  IT: { region: 'europe', style: 'principled', voice: null, women: ['Giulia', 'Chiara', 'Francesca', 'Elisa'], men: ['Matteo', 'Lorenzo', 'Davide', 'Marco'], surnames: ['Rossi', 'Esposito', 'Bianchi', 'Conti'], skins: [0, 1, 2], hair: MOST_HAIR },
  NL: { region: 'europe', style: 'structured', voice: null, women: ['Sanne', 'Femke', 'Lotte', 'Anouk'], men: ['Daan', 'Bram', 'Joost', 'Sem'], surnames: ['de Vries', 'Jansen', 'Bakker', 'Visser'], skins: [0, 1, 2, 4], hair: ALL },
  PL: { region: 'europe', style: 'structured', voice: null, women: ['Zofia', 'Agnieszka', 'Marta', 'Ewa'], men: ['Piotr', 'Kuba', 'Tomasz', 'Michał'], surnames: ['Nowak', 'Wójcik', 'Kaczmarek', 'Mazur'], skins: [0, 1], hair: ALL },
  UA: { region: 'europe', style: 'structured', voice: null, women: ['Oksana', 'Iryna', 'Daryna', 'Sofiia'], men: ['Taras', 'Andriy', 'Bohdan', 'Oleh'], surnames: ['Kovalenko', 'Shevchuk', 'Bondarenko', 'Melnyk'], skins: [0, 1], hair: ALL },
  TR: { region: 'mideast', style: 'quick', voice: null, women: ['Elif', 'Zeynep', 'Defne', 'Ayşe'], men: ['Emre', 'Can', 'Burak', 'Mert'], surnames: ['Yılmaz', 'Demir', 'Kaya', 'Aydın'], skins: [1, 2, 3], hair: MOST_HAIR },
  IL: { region: 'mideast', style: 'quick', voice: null, women: ['Noa', 'Tamar', 'Yael', 'Shira'], men: ['Eitan', 'Yonatan', 'Omer', 'Itai'], surnames: ['Levi', 'Mizrahi', 'Peretz', 'Friedman'], skins: [0, 1, 2, 3, 4], hair: MOST_HAIR },
  SA: { region: 'mideast', style: 'courteous', voice: null, women: ['Noura', 'Reem', 'Lama', 'Hessa'], men: ['Faisal', 'Khalid', 'Turki', 'Saud'], surnames: ['Al-Harbi', 'Al-Qahtani', 'Al-Otaibi', 'Al-Ghamdi'], skins: [2, 3, 4], hair: DARK_HAIR },
  AE: { region: 'mideast', style: 'courteous', voice: null, women: ['Mariam', 'Shamma', 'Latifa', 'Alia'], men: ['Rashid', 'Hamdan', 'Saeed', 'Majid'], surnames: ['Al-Mansoori', 'Al-Hashimi', 'Al-Suwaidi', 'Al-Falasi'], skins: [2, 3, 4], hair: DARK_HAIR },
  EG: { region: 'mideast', style: 'courteous', voice: null, women: ['Nour', 'Salma', 'Yasmin', 'Dina'], men: ['Karim', 'Youssef', 'Tarek', 'Hesham'], surnames: ['Hassan', 'Mansour', 'Fahmy', 'Saleh'], skins: [2, 3, 4], hair: DARK_HAIR },
  NG: { region: 'africa', style: 'spirited', voice: 'en-NG', women: ['Chiamaka', 'Funmilayo', 'Ngozi', 'Amina'], men: ['Chidi', 'Tunde', 'Emeka', 'Ibrahim'], surnames: ['Okafor', 'Adeyemi', 'Balogun', 'Eze'], skins: [4, 5], hair: [0] },
  KE: { region: 'africa', style: 'spirited', voice: 'en-KE', women: ['Wanjiru', 'Achieng', 'Njeri', 'Akinyi'], men: ['Kamau', 'Otieno', 'Kiprotich', 'Baraka'], surnames: ['Mwangi', 'Odhiambo', 'Mutua', 'Wekesa'], skins: [4, 5], hair: [0] },
  ZA: { region: 'africa', style: 'spirited', voice: 'en-ZA', women: ['Thandiwe', 'Lerato', 'Anika', 'Zanele'], men: ['Sipho', 'Thabo', 'Pieter', 'Kagiso'], surnames: ['Nkosi', 'Dlamini', 'van der Merwe', 'Mokoena'], skins: [0, 1, 3, 4, 5], hair: [0, 1, 2] },
  IN: { region: 'asia', style: 'thorough', voice: 'en-IN', women: ['Ananya', 'Kavya', 'Meera', 'Ishita'], men: ['Rohan', 'Vikram', 'Aditya', 'Siddharth'], surnames: ['Iyer', 'Sharma', 'Menon', 'Kulkarni'], skins: [2, 3, 4, 5], hair: DARK_HAIR },
  PK: { region: 'asia', style: 'thorough', voice: null, women: ['Ayesha', 'Hira', 'Mahnoor', 'Zainab'], men: ['Bilal', 'Hamza', 'Usman', 'Fahad'], surnames: ['Qureshi', 'Malik', 'Siddiqui', 'Chaudhry'], skins: [2, 3, 4], hair: DARK_HAIR },
  BD: { region: 'asia', style: 'thorough', voice: null, women: ['Nusrat', 'Tahmina', 'Farhana', 'Rumana'], men: ['Tanvir', 'Rafiq', 'Arif', 'Imran'], surnames: ['Rahman', 'Hossain', 'Chowdhury', 'Ahmed'], skins: [3, 4, 5], hair: DARK_HAIR },
  JP: { region: 'asia', style: 'considered', voice: null, women: ['Haruka', 'Yui', 'Sakura', 'Mio'], men: ['Haruto', 'Daiki', 'Sota', 'Kenta'], surnames: ['Sato', 'Nakamura', 'Watanabe', 'Kobayashi'], skins: [0, 1, 2], hair: DARK_HAIR },
  KR: { region: 'asia', style: 'considered', voice: null, women: ['Seo-yeon', 'Min-ji', 'Ha-eun', 'Su-bin'], men: ['Min-jun', 'Ji-hoon', 'Seo-jun', 'Hyun-woo'], surnames: ['Kim', 'Park', 'Choi', 'Jung'], skins: [0, 1, 2], hair: DARK_HAIR },
  SG: { region: 'asia', style: 'pragmatic', voice: 'en-SG', women: ['Hui Min', 'Siti', 'Kavitha', 'Rachel'], men: ['Wei Jie', 'Darren', 'Hafiz', 'Ravi'], surnames: ['Tan', 'Lim', 'Rahman', 'Nair'], skins: [1, 2, 3, 4], hair: DARK_HAIR },
  PH: { region: 'asia', style: 'pragmatic', voice: 'en-PH', women: ['Andrea', 'Bea', 'Isabel', 'Joy'], men: ['Paolo', 'Miguel', 'Carlo', 'Rafael'], surnames: ['Santos', 'Reyes', 'Cruz', 'Bautista'], skins: [2, 3, 4], hair: DARK_HAIR },
  ID: { region: 'asia', style: 'pragmatic', voice: null, women: ['Putri', 'Ayu', 'Dewi', 'Sari'], men: ['Budi', 'Rizky', 'Adi', 'Bayu'], surnames: ['Wijaya', 'Santoso', 'Pratama', 'Hidayat'], skins: [2, 3, 4], hair: DARK_HAIR },
  AU: { region: 'oceania', style: 'plain', voice: 'en-AU', women: ['Matilda', 'Georgia', 'Brooke', 'Mia'], men: ['Lachlan', 'Jack', 'Hamish', 'Cooper'], surnames: ['Mitchell', 'Nguyen', "O'Brien", 'Campbell'], skins: ALL, hair: ALL },
  NZ: { region: 'oceania', style: 'plain', voice: 'en-NZ', women: ['Aroha', 'Ruby', 'Hana', 'Isla'], men: ['Nikau', 'Tama', 'Finn', 'Hamish'], surnames: ['Ngata', 'Wilson', 'Parata', 'Taylor'], skins: [0, 1, 2, 3, 4], hair: ALL },
};

/** The episode languages people speak in each home, offered first when a host is from there. */
export const HOME_LANGUAGES: Partial<Record<HomeCode, Language[]>> = {
  MX: ['es'], AR: ['es'], CO: ['es'], ES: ['es'], US: ['es'], BR: ['pt'], FR: ['fr'], CA: ['fr'], DE: ['de'], IT: ['it'],
  IN: ['hi'], SA: ['ar'], AE: ['ar'], EG: ['ar'], JP: ['ja'], KR: ['ko'], SG: ['zh'], ID: ['id'],
};

/** Languages to offer first for these hosts: English, then their homes' languages. */
export function languagesFor(homes: (string | undefined)[]): Language[] {
  const out: Language[] = ['en'];
  for (const h of homes) for (const l of HOME_LANGUAGES[h as HomeCode] ?? []) if (!out.includes(l)) out.push(l);
  return out;
}

/** The art tradition Iris may paint in when a host is from here (Iris page → Styles from the hosts' homes). */
export const HOME_ART: Partial<Record<HomeCode, HomeStyle>> = {
  JP: 'inkwash', KR: 'inkwash', SG: 'inkwash',
  MX: 'folk', BR: 'folk', AR: 'folk', CO: 'folk',
  SA: 'tiles', AE: 'tiles', EG: 'tiles', TR: 'tiles',
  IN: 'miniature', PK: 'miniature', BD: 'miniature',
  NG: 'woven', KE: 'woven', ZA: 'woven',
};
/** The home styles that fit an episode's hosts, first host first, no repeats. */
export const homeStylesFor = (speakers: { A: { home?: string }; B: { home?: string } }): HomeStyle[] =>
  [...new Set([speakers.A.home, speakers.B.home].map(h => HOME_ART[h as HomeCode]).filter((x): x is HomeStyle => !!x))];

/** What Iris may use for one episode: your ticked styles, plus its hosts' home styles while those are on. */
export const episodeStyles = (ticked: readonly PaintStyle[], speakers: { A: { home?: string }; B: { home?: string } }, homeStylesOn = true): PaintStyle[] =>
  [...ticked, ...(homeStylesOn ? homeStylesFor(speakers) : [])];

export const HOME_CODES = Object.keys(HOMES) as HomeCode[];
/** A stored home code, or null for "Anywhere" (and for anything that isn't one). */
export const homeOf = (code: string | null | undefined): (Home & { code: HomeCode; country: string }) | null =>
  code && code in HOMES ? { ...HOMES[code as HomeCode], code: code as HomeCode, country: SCOUT_COUNTRIES[code as HomeCode] } : null;

// First names CrossTalk itself hands out, so a photo can show a woman or a man to match. Anything
// else (a name you type, or one that's used for anyone) leaves it open.
const WOMEN = new Set([
  ...Object.values(HOMES).flatMap(h => h.women),
  'Maya', 'Juniper', 'Ava', 'Nora', 'Della', 'June', 'Hazel', 'Ruby', 'Opal', 'Elena', 'Ingrid', 'Clara', 'Sofia', 'Freya', 'Margot',
  'Aiko', 'Mei', 'Priya', 'Hana', 'Sana', 'Amara', 'Zara', 'Lina', 'Isla', 'Ines', 'Bea', 'Poppy', 'Luna', 'Zoe', 'Nova',
]);
const MEN = new Set([
  ...Object.values(HOMES).flatMap(h => h.men),
  'Hale', 'Theo', 'Elias', 'Miles', 'Grant', 'Beau', 'Cole', 'Silas', 'Reid', 'Luca', 'Mateo', 'Henrik', 'Émile', 'Nico', 'Anders',
  'Ravi', 'Kenji', 'Arjun', 'Jin', 'Dev', 'Leo', 'Kofi', 'Omar', 'Tariq', 'Milo', 'Otto', 'Ezra', 'Jax',
]);
/** 'w' or 'm' for a first name CrossTalk knows, else null. Titles like "Dr." are skipped. */
export function nameLook(name: string): 'w' | 'm' | null {
  const first = name.replace(/^(Dr\.|Prof\.)\s+/, '').trim();
  const pick = (n: string) => (WOMEN.has(n) ? 'w' : MEN.has(n) ? 'm' : null);
  return pick(first) ?? pick(first.split(/\s+/)[0]);
}

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** An auto name from a host's home: steady for the same topic and seat, never sharing a first letter with `avoid`. */
export function homeName(code: HomeCode, topic: string, seat: 'A' | 'B', expert: boolean, avoid = ''): string {
  const h = hash(`${topic.trim().toLowerCase()}|${seat}|${code}`);
  const home = HOMES[code];
  const pool = (h >>> 2) % 2 ? [...home.women, ...home.men] : [...home.men, ...home.women];
  let i = h % pool.length;
  for (let n = 0; n < pool.length && avoid && pool[i][0] === avoid[0]; n++) i = (i + 1) % pool.length;
  return expert ? `${seat === 'A' ? 'Dr.' : 'Prof.'} ${pool[i]} ${home.surnames[(h >>> 4) % home.surnames.length]}` : pool[i];
}
