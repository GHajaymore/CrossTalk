// Sample sources for mock mode and tests: invented stories, clearly marked, never fetched.
import type { Candidate } from './sources';

const sample = (path: string) => `https://example.com/sample/${path}`;

export const SAMPLE_HN: Candidate[] = [
  { id: 'hn:1', source: 'Hacker News', title: 'Ask HN: Do AI coding tools make junior developers worse?', url: sample('hn-ai-juniors'), excerpt: '412 points, 689 comments on Hacker News.', points: 412, comments: 689 },
  { id: 'hn:2', source: 'Hacker News', title: 'A city replaced parking downtown with a weekend pedestrian zone', url: sample('hn-car-free'), excerpt: '238 points, 301 comments on Hacker News.', points: 238, comments: 301 },
  { id: 'hn:3', source: 'Hacker News', title: 'The four-day week, one year later: what our numbers say', url: sample('hn-four-day'), excerpt: '520 points, 344 comments on Hacker News.', points: 520, comments: 344 },
  { id: 'hn:4', source: 'Hacker News', title: 'Three killed as delivery drone crashes into crowd', url: sample('hn-tragedy'), excerpt: '90 points, 40 comments on Hacker News.', points: 90, comments: 40 },
];

export const SAMPLE_WIKIPEDIA: Candidate[] = [
  { id: 'wp:Ball rollback', source: 'Wikipedia most-read', title: 'Golf ball distance rollback', url: sample('wp-golf-ball'), excerpt: "Governing bodies plan to limit how far professional golf balls fly, phasing in over several years.", views: 410_000 },
  { id: 'wp:High-speed rail', source: 'Wikipedia most-read', title: 'High-speed rail', url: sample('wp-high-speed-rail'), excerpt: 'A new high-speed line opened this week after years of delays and cost overruns.', views: 380_000 },
  { id: 'wp:Pop star death', source: 'Wikipedia most-read', title: 'Death of a pop star', url: sample('wp-death'), excerpt: 'A singer died suddenly on Tuesday.', views: 2_400_000 },
];

export const SAMPLE_RSS: Candidate[] = [
  { id: 'rss:food:0', source: 'RSS: sample food news', title: 'More restaurants swap tipping for a fixed service charge', url: sample('rss-service-fee'), excerpt: 'Several restaurants now add a set fee to every bill instead of asking for tips. Diners and staff disagree on whether it is fairer.' },
  { id: 'rss:city:0', source: 'RSS: sample local news', title: 'Council to vote on protected bike lanes downtown', url: sample('rss-bike-lanes'), excerpt: 'The plan would add a trial protected lane on the main shopping street. Some shops worry about losing parking.' },
  { id: 'rss:city:1', source: 'RSS: sample local news', title: 'Measles outbreak closes two schools', url: sample('rss-health'), excerpt: 'Health officials confirmed new cases.' },
];

export const SAMPLE_NEWS: Candidate[] = [
  { id: 'news:0:0', source: 'Sample World News', title: 'Countries weigh a shorter school year to save energy', url: sample('news-school-year'), excerpt: 'Several governments are considering trimming the school calendar. Parents and teachers are divided.', kind: 'news' },
  { id: 'news:1:0', source: 'Sample Tech News', title: 'Phone bans in classrooms spread to more schools', url: sample('news-phone-ban'), excerpt: 'More schools now collect phones at the door. Some students say it helps them focus; others call it unfair.', kind: 'news' },
];
export const SAMPLE_TRENDS: Candidate[] = [
  { id: 'trends:US:0', source: 'Google Trends (US)', title: 'People are searching for "remote work return to office"', url: sample('trends-rto'), excerpt: 'In the news: Big employers ask staff back four days a week', views: 500_000, kind: 'search' },
];
export const SAMPLE_REDDIT: Candidate[] = [
  { id: 'reddit:0:0', source: 'Reddit r/changemyview', title: 'CMV: Tipping culture has gone too far', url: sample('reddit-tipping'), excerpt: 'A popular post argues that tip prompts at self-checkout have gone too far; hundreds of replies disagree.', kind: 'social' },
];
export const SAMPLE_SOCIAL: Candidate[] = [
  { id: 'bsky:0', source: 'Bluesky trending', title: 'Trending on Bluesky: four-day week', url: sample('bsky-four-day'), excerpt: 'What people are posting about; opinions, not facts.', kind: 'social' },
];

/** What a model might answer for the samples, in the same JSON shape. Goes through the same checks. */
export const SAMPLE_RANKING = {
  topics: [
    { question: 'Do AI coding tools make junior developers better or worse?', category: 'tech', region: 'world', arguability: 88,
      bullets: [
        { text: 'A widely shared thread asks whether new developers learn less when tools write code for them.', sourceId: 'hn:1' },
        { text: 'Replies point to faster onboarding and fewer blocked days, but worry about shallow understanding.', sourceId: 'hn:1' },
        { text: 'Few studies yet separate short-term output from long-term skill.', sourceId: 'hn:1' },
      ] },
    { question: 'Should downtowns go car-free on weekends?', category: 'society', region: 'na', arguability: 82,
      bullets: [
        { text: 'A city turned downtown parking into a weekend pedestrian zone.', sourceId: 'hn:2' },
        { text: 'Shop owners are split between more foot traffic and lost parking.', sourceId: 'hn:2' },
        { text: 'A council vote on protected bike lanes shows the same divide locally.', sourceId: 'rss:city:0' },
      ] },
    { question: 'Is a fixed service charge fairer than tipping?', category: 'culture', region: 'na', arguability: 85,
      bullets: [
        { text: 'More restaurants add a set fee to every bill instead of asking for tips.', sourceId: 'rss:food:0' },
        { text: 'Some diners say prices now feel hidden; some staff say pay is steadier.', sourceId: 'rss:food:0' },
        { text: 'How the fee must be shown differs from place to place.', sourceId: 'rss:food:0' },
      ] },
    { question: 'Should pro golf limit how far the ball flies?', category: 'sports', region: 'world', arguability: 70,
      bullets: [
        { text: 'Governing bodies plan to limit how far professional balls fly.', sourceId: 'wp:Ball rollback' },
        { text: 'The change would be phased in over several years.', sourceId: 'wp:Ball rollback' },
        { text: 'Supporters say it protects classic courses; critics say it splits the game.', sourceId: 'wp:Ball rollback' },
      ] },
    { question: 'Are high-speed trains worth what they cost?', category: 'economy', region: 'world', arguability: 66,
      bullets: [
        { text: 'A new high-speed line opened after years of delays and cost overruns.', sourceId: 'wp:High-speed rail' },
        { text: 'Riders praise the time saved; taxpayers question the bill.', sourceId: 'wp:High-speed rail' },
        { text: 'Long-term ridership is the number everyone is waiting for.', sourceId: 'invented:source' },
      ] },
    { question: 'Should schools ban phones in class?', category: 'society', region: 'world', arguability: 78,
      bullets: [
        { text: 'More schools now collect phones at the door.', sourceId: 'news:1:0' },
        { text: 'Some students say it helps them focus; others call it unfair.', sourceId: 'news:1:0' },
      ] },
    { question: 'Should offices bring everyone back four days a week?', category: 'business', region: 'na', arguability: 80,
      bullets: [
        { text: 'People are searching for "remote work return to office" today.', sourceId: 'trends:US:0' },
        { text: 'Big employers are asking staff back four days a week, according to the headlines people are reading.', sourceId: 'trends:US:0' },
      ] },
    { question: 'Has tipping culture gone too far?', category: 'culture', region: 'world', arguability: 74,
      bullets: [
        { text: 'People on Reddit are arguing that tip prompts at self-checkout have gone too far.', sourceId: 'reddit:0:0' },
        { text: 'Hundreds of replies push back, saying tips are how many workers get paid.', sourceId: 'reddit:0:0' },
      ] },
  ],
};
