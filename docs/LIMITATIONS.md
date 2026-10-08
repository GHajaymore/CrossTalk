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
- **Iris draws simple line sketches.** Picture, Painting and Dreamscape need a free image model on a
  GPU (next phase). Her picture prompts are saved so past episodes can be redrawn.
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
- **The episode poster** is drawn on your device. The fonts it uses come from the page, so a poster made
  offline may fall back to plain system fonts.

## Control room

- **One admin, one code.** The Control room's lock is a single shared `ADMIN_CODE`, not accounts.
- **The audit log lives in the app's database**, so on the free Render plan it is wiped with everything
  else on restart.
- **Publishing queues aren't connected yet.** Approving an episode puts it in the publish queue; nothing
  is sent anywhere until podcast, social and shop publishers exist (Phase 2), and never without approval.
- **Blocked words are matched as whole words**, so variants ("cryptocurrency" for "crypto") need their own line.

## Hosting (the free Render plan)

- It sleeps after 15 idle minutes; the next visit takes about a minute.
- Its disk is wiped on every restart or deploy, so hosted episodes don't last. Keeping them needs a
  host with a persistent disk.

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
