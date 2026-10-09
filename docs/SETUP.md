# Setting up CrossTalk

Everything here is free. Mock mode needs no account and no key.

## What you need

- **Node.js 22 or newer** ([nodejs.org](https://nodejs.org)). Check with `node --version`.
- A modern browser. Microsoft Edge has the most natural free voices; Chrome and Safari work too.

## Run it in mock mode (no key)

```sh
npm install
npm run dev:mock
```

Open **http://localhost:5173**. The local server runs on http://127.0.0.1:8787 and saves episodes to
`apps/server/data/crosstalk.sqlite`. Mock mode speaks scripted sample text, so you can try every screen,
cue and branch without calling any model.

## Real models (still free)

1. Copy `.env.example` to `.env` (it's never committed).
2. Set `PROVIDER_MODE=openrouter`, your `OPENROUTER_API_KEY`, and three **different** free model IDs:
   `SPEAKER_A_MODEL`, `SPEAKER_B_MODEL` and `ARTIST_MODEL` (Iris). `docs/MODELS.md` explains how to pick them.
3. Run `npm run dev` (not `dev:mock`).
4. Open **Settings**: each model should show ✓. Anything not priced at $0 on OpenRouter's own list is
   blocked, and the reason is shown.

The key is read only by the local server. It never reaches the browser, the logs or an export.
The app stops at 40 model requests a day (`MAX_REQUESTS_PER_DAY`); a full real episode uses about 18 (16 turns, writing the host roles, and Iris). For more free requests a day, use Groq instead (`PROVIDER_MODE=groq`, see docs/MODELS.md).

## Topic Scout

The **Today** tray on Create shows 3–5 topics people are arguing about, each with a 3-point brief linked
to its sources. In mock mode it reads saved sample stories. In real mode it reads Hacker News, Wikipedia
most-read and any RSS feeds in `SCOUT_RSS_FEEDS`, then uses **1 request** to rank and brief them.

- It runs once a day at `SCOUT_TIME` (default `07:00`, server time; set `TZ` for your time zone), and
  once to catch up if the app starts later. **↻ Refresh topics** runs it again (with real AI, at most every 30 minutes, since it uses a free request), and **Show more** reveals the rest of the last run's topics for free.
- **Autopilot** (off by default) turns the top pick into an episode, at most once a day, about 18 requests.
- Tragedies, crime, health scares and private lives are always filtered out. Politics and Scandals are
  off until you turn them on, and never shown for Kids.

## Control room

**Control room** in the top bar is for you, the admin: an overview, live control with producer notes,
publishing approvals (nothing is ever published without your OK), Scout topics to pin or hide, and the
rules (blocked words, Mature, Heated, Politics in the Scout, listener cues per episode). The rules are
enforced by the server, not just the screen. Online it needs `ADMIN_CODE` (see `docs/DEPLOY.md`).

## Natural recorded voices (optional)

`tools/voice` renders an episode to an MP3 with free, open-source voices (Kokoro) that run on your
own machine. See `tools/voice/README.md`. The Studio plays the recording when one exists.

## Tests

| Command | What it checks |
| --- | --- |
| `npm test` | Unit and API tests (Vitest): the controller, cues, branches, the free-model guard, export, the lock |
| `npm run typecheck` | TypeScript in all three packages |
| `npm run e2e` | End-to-end in Chromium: create → run → stop → refresh, a challenge, a branch, Iris, export, the library, keyboard use, accessibility (axe) and a phone viewport |

Before the first `npm run e2e`, install Chromium once with `npx playwright install chromium`, or point
`CHROMIUM_PATH` at a Chromium you already have. The end-to-end run builds the app and starts it in mock
mode on port 8799 with a fresh database in `e2e/.data/`.

## Put it online

Free hosting on Render behind an access code: `docs/DEPLOY.md`.

## If something goes wrong

| You see | What to do |
| --- | --- |
| "Port 8787 is already in use" | CrossTalk is already running. Stop it (Ctrl+C in its terminal), or set `PORT` to another number. |
| "Daily request limit reached" | The app's own safety limit. It resets tomorrow (local date). |
| A model shows ✕ in Settings | It isn't free on OpenRouter right now, or its ID is wrong. Pick another (`docs/MODELS.md`). |
| "The model is busy right now" | Free models get busy. Wait a minute, then press Retry. |
| No sound | Your browser may have no voices installed; every turn stays readable. Try Edge, or render a recording. |
