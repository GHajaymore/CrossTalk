// Scripted turns for mock mode: two friends chatting, 16 short turns (docs/PLAN.md).
// One script per preset topic, plus a generic one for anything else.
// Speaker A speaks odd turns, Speaker B even turns. Scripts never use the hosts' names,
// because names are chosen per episode.
import { PRESETS, type SpeakerId, type Temperature } from '@crosstalk/shared';

const AI_BUSINESS = [
  "So today: will AI actually help independent businesses, or is it just another thing they're told they need? I'm leaning hopeful, which I suspect you're about to fix.",
  "You know me so well. I'm not against it. I just notice every new tool promised small shops they'd compete with the big chains, and somehow the big chains keep winning.",
  "Fair. Here's how I'd frame it, though. A small business is limited by one thing: the owner's hours. AI is cheapest exactly where they're stretched thinnest, the paperwork around the actual work.",
  "Sure, but if every competitor gets the same tools, those saved hours become the new normal, not a gift. Free product descriptions for one shop means free for the chain too. And they have more data.",
  "Okay, picture a two-person bike repair shop. The assistant answers the same twenty questions about opening hours, drafts the parts order from last month's invoices, and turns voice notes into quotes.",
  "Ha, the twenty questions thing is real. Every shop has a laminated sign for exactly those. But what happens when the assistant tells someone you're open on a holiday? A chain shrugs that off. A two-person shop loses a regular.",
  "True. So you keep it on the boring stuff where a mistake is cheap. Ordering, invoices, first drafts. The mechanic stays at the bench instead of on the phone, and that's what customers notice.",
  "Then the question is whether it pays for itself. Five tools at twenty dollars a month adds up on thin margins. I honestly don't know the typical payback, and I suspect most owners don't either.",
  "Here's the bit that excites me, though. AI shrinks the size you need to be to look professional. A solo baker can have clear allergen labels, a decent website, translated menus. That used to need an agency.",
  "Okay, but here's the catch: the platforms in the middle still set the rules. If customers find you through an app that sums you up in one line you didn't write, all that careful work gets flattened.",
  "Yeah, I hadn't really weighed that. You can polish everything and still be at the mercy of whoever ranks you. That's a real limit.",
  "And a curveball: owners who enjoy experimenting will pull ahead of equally good owners who don't. That gap has nothing to do with the quality of the bread.",
  "So where we land: it helps most with the invisible admin, and only if the saved time goes back into the thing customers love. And it doesn't fix who controls the storefront.",
  "What I'm still unsure about is who captures the gains once everyone has the same tools. My guess is the platforms. I'd love to be wrong.",
  "Takeaway for owners: pick one boring task that eats your week, try a tool on it for a month, and check every output. Cancel anything that doesn't pay for itself.",
  "And own your customer list, whatever you do. That's us for today. Go support a local shop, maybe one with a laminated sign.",
];

const CITIES = [
  "Today's one gets people properly worked up: should cities put cars or pedestrians first? I've got a practical answer, but I suspect you've got a philosophical one.",
  "Guilty. Before we talk lanes and parking, I want to know who a street is actually for. The people who live on it, or the people driving through it?",
  "See, I'd start with space. A street is a fixed width. Every metre goes to moving cars, parked cars, or people on foot. So the question is which trips this particular street should serve.",
  "But counting trips favours whoever travels most, and that's usually commuters passing through. A kid walking to school makes one short trip. Does that count less than fifty drivers saving a minute?",
  "Okay, picture a main street through a small town. Four lanes, two moving, two parked. They swap one parking lane for wider pavement and a delivery bay. Traffic still moves, just slower, and the cafés put tables out.",
  "Ha, the café tables always show up first. I like it. But who lost their parking space? And did the shop owners, who swear all their customers drive, get a say?",
  "They should, and they're often wrong about it, but not always. Which is why I'd test it with paint and planters for one summer before anyone pours concrete.",
  "Fine, but what would have to be true for the test to be fair? Think of someone who can't walk far, or the plumber hauling tools. If it quietly makes the centre harder for them, a nicer pavement isn't fairer.",
  "That's why I like trials, though. Count footfall, sales and journey times. You get evidence instead of slogans, and sometimes the result surprises both sides.",
  "Here's the catch: trials measure what's easy to count. Whether older residents feel cut off doesn't show up in a spreadsheet. And traffic pushed off one street lands on another, often a poorer one.",
  "Yeah, that's fair. I'd been treating the spreadsheet as the whole story. Where the traffic goes has to be part of the test.",
  "And my curveball: what if the street works fine and we're solving the wrong problem? Sometimes the real issue is a bus that comes every forty minutes.",
  "Ha, the forty-minute bus, villain of every city story. Okay, where we agree: it's street by street, never all cars or all people, and the folks with the least choice get the most weight.",
  "Agreed. What I still don't know is how long habits take to settle. A summer trial might just measure people being annoyed.",
  "Takeaway: pick one street, run a reversible trial with measures agreed up front, and invite the people who'd lose out to judge the result.",
  "And check the bus timetable first. That's us. Walk, drive or cycle home safely, everyone.",
];

const FOUR_DAY = [
  "Okay, today's question is one I genuinely can't make up my mind on: is a four-day workweek actually practical? My gut says yes, for a lot of jobs. Talk me out of it.",
  "Happily. Well, half happily. Who doesn't love a three-day weekend? My worry is simpler: the work doesn't know it's Friday. Someone still has to pick up the phone.",
  "Right, and I think that's the real question. Not whether it's nice, but which jobs are measured by what you produce, and which are measured by just being there.",
  "Sure, but most jobs are both. An engineer ships features and also gets paged at four on a Friday. I'd bet the four-day week quietly turns into four long days plus an unofficial fifth.",
  "Okay, picture a twelve-person accounting firm outside tax season. They close Fridays, but one person each week covers the phones and takes Monday off instead. Output's tracked by files closed, not hours.",
  "Ha, I like that, mostly because someone actually wrote down who covers what. Most teams never have. But that's a small firm in a slow season. Easy mode.",
  "Fair. So take a harder one: a busy dental clinic. You can't close Fridays, so you stagger. Half the team is off Friday, half off Monday. Patients don't notice, and staff still get the long weekend.",
  "Okay, but what has to be true for that to work? Enough people to split, and enough slack that ten-hour days don't wreck everyone. If you're already stretched thin, it just makes Thursday miserable.",
  "That's my favourite part, though. To even try it, you have to ask what every meeting and report is for. Teams that try it cut meetings first, and even if they go back to five days, they keep that.",
  "Here's the catch nobody puts in the press release: who absorbs the friction? Salaried folks get a day back. Hourly staff might lose pay, or get exhausting shifts. Managers quietly cover the gaps.",
  "Yeah, that's a real hit. If it only works for people with laptops and a salary, it's a perk, not a policy. Fair point.",
  "And my curveball: what about the customer? If your competitor answers the phone on Friday and you don't, does anyone actually care? Or do we just assume they do?",
  "Honestly, I think we agree more than it sounded. It's a design problem, not a perk. You need a coverage plan, a number you trust, and a real trial with a way back.",
  "Agreed. What I'm still unsure about is how much of the gain is the extra day, and how much is just finally cleaning up the work. Early adopters chose this. Reluctant companies might see nothing.",
  "So, takeaway for anyone listening: try it on one team for three months, measure before and after, and treat going back to five days as a perfectly fine result.",
  "And check what happens to your hourly people before you celebrate. That's it from us. Thanks for listening, and enjoy your weekend, however long it is.",
];

const RESTAURANT = [
  "Today we're dreaming a little: what would an ideal future restaurant look like? I keep picturing a family sitting down, and nobody has to wave for the bill.",
  "See, I picture a robot bringing me soup and then asking me to rate the soup. Five stars or the soup gets it.",
  "Ha, no robots required. I think the ideal place removes the small frictions that spoil a meal, so the people working there can spend their attention on the part only people can do.",
  "I'd push back on removing all friction, though. Waiting for a waiter is annoying, sure. But the waiter remembering your name is the reason you go back.",
  "Okay, let me paint a place I can picture clearly. Twelve tables, one set menu that changes weekly, chosen when you book. The kitchen knows the numbers ahead, so almost nothing goes to waste.",
  "Lovely. Also a place I can't wander into on a Tuesday because I'm hungry. Pre-ordering assumes people plan ahead, and I've met people.",
  "Fair. So imagine the other half of the street: quick, flexible, cheap, with machines doing more of the cooking. You don't need one ideal restaurant. You need each place to be honest about what it is.",
  "Okay, but what has to be true for the fancy one to survive? Diners who book, staff who stay, and a landlord who doesn't double the rent. That last one is doing a lot of work.",
  "Here's the part I love, though. When the planning happens in the background, servers stop taking orders and start telling stories. Where the fish came from, why the dessert is sour on purpose.",
  "And here's the catch: the cook. Low waste and set menus are great until you're the one on a split shift for wages that haven't moved in years. Automation might take the steady jobs and leave the stressful ones.",
  "That's a fair hit. A beautiful menu doesn't mean much if the kitchen can't keep its cooks. I'd been telling the diner's story, not theirs.",
  "Curveball: what if the ideal future restaurant is just your own kitchen and a really good app? I'm only half joking.",
  "Ha, only half. Okay, where we agree: use technology for planning and waste, and keep people for welcome and judgement. The meal should feel hosted, not processed.",
  "Agreed. What I can't work out is whether that model pays staff fairly, and whether it can still feed the walk-ins. The spontaneous Tuesday crowd is real.",
  "Takeaway for anyone running a place: borrow one idea, maybe a weekly set menu or smarter bookings, and try it for a season. Keep what makes both guests and cooks happier.",
  "And keep the bread basket. Some traditions are load-bearing. That's us. Go eat somewhere with a waiter who knows your name.",
];

const GOLF = [
  "Today's question is close to my heart: can technology make golf better without changing what makes it golf? I'm optimistic, but I know you've got a bag full of worries.",
  "A whole bag, yes. My gut says every gadget looked small and harmless when it arrived, and somehow the game still drifted. Nobody can point to the day it changed.",
  "So let's define it. I'd say golf's character is three things: you play the ball as it lies, you keep your own score honestly, and the course is the opponent.",
  "Nice definition. But rangefinders were once seen as cheating, and now they're everywhere. Drivers and balls have made long courses feel short. Each step seemed reasonable at the time.",
  "Okay, picture a beginner at the range with a launch monitor. It shows their misses come from the club face, not their swing. Two lessons later, they're enjoying a round instead of hunting for balls.",
  "Ha, the ball-hunting phase. Deep in the bushes, pretending it's a nature walk. But that's at the range. What happens when the tech follows them onto the course?",
  "Fair. On the course, I'd say help with learning, never with deciding. A watch that tells you the yardage, fine. A watch that reads the green and picks your line, no.",
  "Then here's the test: who draws that line? Rules bodies already limit some devices in competition, so the line exists. But for a Saturday round at the local club, it's basically vibes.",
  "Here's what excites me, though. Tech could protect the course. Sensors that save water, and data that helps designers place hazards so skill decides the hole, not just distance.",
  "And the catch: pace. Every screen is something to stare at instead of the course or your friends. Rounds already take four hours, and checking data makes them longer.",
  "Yeah, that one stings, because pace is part of the character too. I'll give you that completely.",
  "My curveball: equipment makers profit from every upgrade, so they're never neutral. And people who love the quiet, walking side of golf aren't the ones testing new gadgets.",
  "So where we agree: tech fits when it helps people learn and keeps the course a fair test. It doesn't when it makes decisions for you mid-round.",
  "What I'm still unsure of is whether distance has already changed the game more than either of us would like to admit.",
  "Takeaway: welcome tech at the range and in the greenkeeper's shed, be cautious on the course, and judge each gadget by whether a beginner would still recognise the game.",
  "And keep up the pace. That's us. See you on the first tee, and please, play the ball as it lies.",
];

const generic = (topic: string) => [
  `Today's question: "${topic}" It sounds like a yes-or-no, but I think there's a lot hiding in it. Where's your gut on this?`,
  "Honestly, my gut says it depends, which is a boring answer, so let me do better. I want to know what's working today before we change anything.",
  "Good place to start. I'd frame it as who benefits first, who pays first, and what would have to be true for the benefits to last.",
  "Sure, but changes often break things nobody measured. If we can't describe what works now, we can't tell an improvement from just a change.",
  "Okay, picture one place and one small group trying it for a single season. Week one is novelty and friction. By month two, routines settle and the real effects show up.",
  "Ha, the week-one novelty is so true. But small trials attract people who want it to work. Early results almost always look better than a wider rollout.",
  "Fair. So you'd want to run it somewhere a bit reluctant too. If it works there, that tells you a lot more.",
  "And ask what happens at the edges: the person with less money, less time, less say. If it only works for the motivated middle, that matters.",
  "Here's what I find most valuable, though: deciding forces everyone to say what they actually value and what they'd give up. Even if nothing changes, people leave clearer.",
  "The catch is time. A lot of effects arrive slowly, after habits and prices adjust. Short trials miss them, and some decisions are hard to undo.",
  "Yeah, good point. Anything hard to reverse deserves way more caution than something you can quietly roll back.",
  "My curveball: who isn't in the room when this gets decided? That's usually where the surprises come from.",
  "So where we agree: this deserves a trial mindset, not a verdict, and we should name who bears the costs.",
  "What I'm still unsure about is how well small, voluntary experiments predict the real thing. I'm comfortable saying it depends. Less comfortable saying on what.",
  "Takeaway: start small, measure something specific before and after, and prefer choices you can reverse while the evidence is thin.",
  "And protect the people at the edges. That's us for today. Thanks for listening.",
];

/** Preset topic → script, in the same order as PRESETS. */
export const PRESET_SCRIPTS: Record<string, string[]> = Object.fromEntries(
  [AI_BUSINESS, CITIES, FOUR_DAY, RESTAURANT, GOLF].map((s, i) => [PRESETS[i].toLowerCase(), s]),
);

export function scriptFor(topic: string): string[] {
  const t = topic.trim();
  return PRESET_SCRIPTS[t.toLowerCase()] ?? generic(t);
}

/** Temperature colours the push-back moments, so mock runs hint at the setting. */
const HEAT_LEADS: Record<Temperature, string> = {
  calm: "Fair, and I'll go gently here. ",
  lively: '',
  heated: 'Oh, come on. ',
};
/** Turns where the second host pushes back: Push back, Test, Catch. */
const PUSH_BACK_TURNS = new Set([4, 8, 10]);

export function mockTurnText(topic: string, seq: number, _speakerId: SpeakerId, temperature: Temperature) {
  const base = scriptFor(topic)[seq - 1] ?? 'Let me pick up where we left off.';
  return (PUSH_BACK_TURNS.has(seq) ? HEAT_LEADS[temperature] : '') + base;
}

/** Long episodes: the eight deeper beats between Normal's middle and its ending. Topic-neutral, for mock mode. */
const LONG_LINES: Record<string, string> = {
  'Dig in': "Let me stay on that curveball for a second, because I think it changes the picture more than it sounds.",
  Counterpoint: "I'm not sure it does. The people living with this every day would say the basics haven't changed one bit.",
  'Second story': "Here's another scene, then. Picture someone trying this for the first time on a busy Monday, with nobody around to help.",
  'Hard case': "And that's the hard case, the one where good intentions fall apart. Who catches them when it goes wrong?",
  'Middle path': "Maybe the answer is a middle path: start small, keep a way back, and let the people affected set the pace.",
  'Stress test': "I'd stress-test that, though. Small pilots always look good, because the keenest people volunteer first.",
  'What changed': "Fair. Honestly, this has shifted me a bit. I came in surer than I am now, mostly because of that hard case.",
  'Open question': "Same here. The question I can't shake is who keeps paying for it once the novelty wears off.",
};
export const mockLongText = (job: string) => LONG_LINES[job] ?? 'Let me pick up where we left off.';

/** Branch turns: the listener steered the show somewhere new. */
export function mockBranchText(job: string, direction: string) {
  const d = direction.trim().replace(/[.?!]*$/, '');
  switch (job) {
    case 'New direction': return `Okay, let's go where our listener pointed: ${d}. Honestly, that changes how I see a lot of what we just said.`;
    case 'Pressure test': return "Let me poke at that, though. If we really go that way, what breaks first, and who's the first to notice?";
    case 'Example': return 'Picture an ordinary Tuesday under this new idea. Some of it runs smoother than you\'d expect, and some of it quietly lands on the people with the least say.';
    default: return "So that's where this branch took us. I'm glad we followed it; it showed something the first version missed. Thanks for steering us here.";
  }
}

/** How a host opens a turn that answers a listener's cue. */
export function mockCueLead(kind: 'challenge' | 'deeper' | 'guest' | 'temp' | 'note', text: string | null, targetSeq: number | null, up = true) {
  const t = (text ?? '').trim();
  switch (kind) {
    case 'challenge': return `Fair challenge from a listener: "${t}" Honestly, part of that lands, so let me answer it straight. `;
    case 'deeper': return `I want to stay on line ${targetSeq} a bit longer, because there's more in it than we gave it. `;
    case 'guest': return `Thanks for jumping on the mic. "${t}" That's worth taking seriously, and here's my honest reply. `;
    case 'temp': return up ? "Right, I'll say it more bluntly. " : "Let me take the heat down a notch. ";
    case 'note': return "Let me keep this to what we actually know. ";
  }
}

/** Round two: the opening pair, in place of the first round's. It quotes what was left open last time. */
export function mockRoundOpening(round: number, seq: number, open: string | null) {
  // The sentence that says what was open, not a stray "Agreed."
  const sentences = open?.match(/[^.?!]+[.?!]+/g)?.map(x => x.trim()) ?? [];
  const quote = sentences.find(x => /unsure|don't know|open/i.test(x)) ?? sentences.sort((x, y) => y.length - x.length)[0];
  if (seq === 1) return `Round ${round}! Last time we left this one properly open, so let's pick it back up.${quote ? ` You said, and I quote: "${quote}" Let's start there.` : ''}`;
  if (seq === 2) return "Good, because I've been chewing on it since. I still think the answer depends on who carries the cost.";
  return null;
}

/** Mock Mind-change meter: each host says how sure they are at the start, and where they landed. They move toward each other. */
export function mockStance(topic: string, speakerId: SpeakerId, job: string, lastEnd: number | null = null) {
  const seed = [...topic].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 997, 7);
  // Round two: they start where they ended, and move a little less this time.
  const start = lastEnd ?? (speakerId === 'A' ? 62 + (seed % 20) : 22 + (seed % 20));
  const shift = lastEnd != null ? 3 + (seed % 5) : null;
  const end = Math.max(0, Math.min(100, speakerId === 'A' ? start - (shift ?? 10 + (seed % 8)) : start + (shift ?? 8 + (seed % 9))));
  if ((job === 'Hello' || job === 'First take') && lastEnd != null) return ` I finished last round at about ${start}% on yes, and that's where I'm starting. [stance: ${start}]`;
  if (job === 'Hello' || job === 'First take') return ` I'd put myself at about ${start}% on yes. [stance: ${start}]`;
  if (job === 'Takeaway' || job === 'Sign-off') return ` For the record, I've moved: about ${end}% on yes now. [stance: ${end}]`;
  return '';
}
