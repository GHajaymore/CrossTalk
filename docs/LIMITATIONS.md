# Known limitations

CrossTalk is a prototype for one person. These are the honest gaps.

## Content

- **Free models vary.** Discussions can be flat, repetitive or agreeable, and quality changes with
  whatever free models are on offer. Nothing a host says is fact-checked: every page and export says
  "AI-generated; not independently verified."
- **Sources only through the Scout.** Hosts are told not to invent statistics, studies or quotes, and
  they don't look anything up. Scout topics carry a 3-point brief linked to its sources; the hosts treat
  only that as fact. The Scout reads titles and summaries, never whole articles.
- **The Scout's reach is small.** Hacker News, Wikipedia most-read and the RSS feeds you list. Reddit
  isn't used (it needs a registered app and a terms check). The no-go filter is a keyword list, so it can
  miss things or drop a harmless story.
- **Free models have their own content rules**, and the app never tries to get around them.

- **The Mind-change meter depends on the model.** Hosts are asked to say how sure they are and add a
  hidden number on their first and last lines; a model that skips the number leaves that end of the
  meter empty. The number is what the host says, not a measurement.

## Voices and pictures

- **Browser voices depend on the device.** They sound different everywhere and can sound robotic.
  Headless browsers have none, so voice playback isn't covered by the automated tests.
- **Recorded voices** (`tools/voice`) are rendered on your machine, one episode at a time, and aren't
  part of the hosted version yet. There are no emotion or laughter cues yet.
- **Iris paints from her own lines.** Painting and Dreamscape are her sketch with brushwork, light and
  sky added in the browser, not new pictures, so they are only as rich as her drawing. A full
  illustration (Picture) needs an image model, and none is free yet. Her picture prompts are saved so
  past episodes can be redrawn.
- **Very old browsers** may show the painted styles without their washes (they need SVG filters).
- **Balance is built in, not guaranteed.** Each region reads several outlets that lean different
  ways, World mixes regions, and the ranker must cite more than one outlet where it can; each topic
  card shows how many sources and regions its brief draws on. A story only one outlet covers will
  still show "1 source".
- **Sites you add** must be public https websites. The server refuses private or internal addresses
  (also after redirects) and reads at most 1.5 MB from each. A site that changes where its name
  points between the check and the fetch could slip past; adding sites is for trusted users of your
  copy only.
- **The Scout's sources are free public feeds** (news sites' RSS, Google Trends, Reddit, Bluesky,
  Mastodon, Hacker News, Wikipedia). Sites change their feeds now and then; when one can't be read,
  the tray says so and the others still count. Reddit, Bluesky and Mastodon are opinions, reported as
  what people are saying. X/Twitter, TikTok and Instagram have no free access, so they aren't included.
- **Raise your hand** pauses the recording at the end of the current line; the host's invitation is a
  short written line (no request) in their device voice. If you don't speak within 15 seconds, the
  show carries on. Speaking on air uses one of your cues, like Take the mic.
- **The hosts are photo-real portraits of invented people, not video.** Each look is made once by a free
  image service (Pollinations), saved in the database and reused; it breathes, glances and leans, but
  the lips don't move. Only a short description is sent (skin tone, hair, glasses, outfit), never the
  host's name, job or the topic, and the prompt asks for a fictional person, never a celebrity. At most
  24 new photos a day. If the service is down, the drawn living portrait (with a talking mouth) takes
  its place. Set `PORTRAITS=off` to always use the drawn ones and send nothing out.
- **Voices come from the listener's device.** CrossTalk picks the most natural ones and suggests free
  better voices when a device only has basic ones; quality still varies by device.
- **Listening times are estimates** (about 18 seconds a turn at a normal pace). Real hosts vary their
  line length, and a Long episode uses about 25 of the 40 daily requests.
- **Long episodes in mock mode** use eight general sample lines for the extra beats; real hosts write them.
- **OpenRouter caps free-model requests per account per day**, across every app and key you use. When
  it's reached, CrossTalk says so plainly, doesn't spend a retry on it, and the episode waits; press
  Retry after the reset (about midnight UTC). OpenRouter raises the cap if you add credit; CrossTalk
  still uses only $0 models, so it's your choice and never needed.
- **Up next keeps playing while the page stays open.** With device voices, some phones pause speech
  when the screen locks; rendered recordings carry on more reliably. It remembers what it played per
  browser tab, so a new visit can start the shelf again.
- **Round two in mock mode** opens properly (the hosts recall where they ended and quote what was left
  open), then follows the same sample script as round one. Real models write a new conversation that
  builds on a short memo of last round: where each host ended, their key lines and your challenges.
- **The episode page reads aloud with the reader's own device voices**, so it sounds like their phone,
  not the studio. A browser with no voices says so and the page still reads like a script. It leaves out
  producer notes (they're private); the Markdown and JSON exports keep them.
- **Presenter tiles show initials**, not moving faces. Lifelike presenters are a paid Phase 2 decision.

## Engine

- **One episode generates at a time**, app-wide.
- **3 cues per episode, one waiting at a time** (the Control room can set 0–6). A guest can type or talk.
- **A branch always gets 4 new turns.** An episode with branches can't be deleted until its branches are.
- **The daily limit is the app's own count**, not a billing guarantee. OpenRouter also limits free
  use per day on its side, so a run can pause before the app's limit.
- **Lowering `MAX_TURNS_PER_RUN`** shortens normal episodes, but the screen and prompts still say 16 turns.

## Bold features

- **Hot seat** asks the left host to defend the less popular side. Free models may still drift toward
  agreement; the listener's vote ("who moved you?") is the only verdict, never Iris's.
- **Call in by voice** uses the browser's own speech-to-text. It works in Chrome, Edge and Safari but not
  Firefox (the mic button simply doesn't appear). Chrome and Edge send the audio to their maker's speech
  service to transcribe it. You always see and can edit the words before they go on air.
- **The comic strip** is built from the episode's own lines and Iris's one sketch; she doesn't draw a new
  picture for every panel (that would need a request per panel, or an image model).
- **The episode poster** is drawn on your device. The fonts it uses come from the page, so a poster made
  offline may fall back to plain system fonts.

## Control room

- **One admin, one code.** The Control room's lock is a single shared `ADMIN_CODE`, not accounts.
- **The audit log lives in the app's database**, so on the free Render plan it is wiped with everything
  else on restart unless the free backup is set up (docs/DEPLOY.md → Keep episodes for good).
- **Publishing queues aren't connected yet.** Approving an episode puts it in the publish queue; nothing
  is sent anywhere until podcast, social and shop publishers exist (Phase 2), and never without approval.
- **Blocked words are matched as whole words**, so variants ("cryptocurrency" for "crypto") need their own line.

## Hosting (the free Render plan)

- It sleeps after 15 idle minutes; the next visit takes about a minute.
- Its disk is wiped on every restart or deploy. With the free Backblaze backup set up, episodes,
  Iris's sketches and settings come back on start-up. Without it, they're lost.
- The backup copies changes about every 10 seconds, so a crash can lose the last few seconds.
  Rendered recordings are files and aren't backed up.

## Before opening it to the public

The hosted version is open in mock mode and locked with one shared access code once real models are on. Letting other people in needs:

1. **Accounts and authentication**: per-person sign-in instead of one shared code, with sessions that
   can be revoked.
2. **Per-user limits**: request and episode limits per person, on top of the app-wide daily limit.
3. **Abuse prevention**: rate limits per address and account, bot protection on sign-up, and blocking
   for repeated misuse.
4. **Moderation**: checks on topics, cues and guest lines before they reach a model, rules enforced
   on the server (Control room, Milestone 8), and a way to report an episode.
5. **Privacy and retention**: a privacy notice, how long episodes and listener notes are kept,
   export and deletion on request, and consent before a guest's words are published.
6. **Secure hosting**: a persistent, backed-up database; secrets only in the host's settings; HTTPS
   everywhere (already required by `.app`); dependency updates; logs that never hold keys or listener
   text; and monitoring.
7. **Costs**: anything beyond free models (voices, presenters, image models) needs a budget and
   per-user caps first.
