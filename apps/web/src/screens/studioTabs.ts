// The Studio's three views, kept apart from the Studio itself so the app can read a link without loading it.
export type StudioTab = 'watch' | 'listen' | 'read';
export const STUDIO_TABS: [StudioTab, string, string][] = [
  ['watch', 'Watch', 'The set, live'],
  ['listen', 'Listen', 'Podcast player'],
  ['read', 'Read', 'Transcript & Iris'],
];
