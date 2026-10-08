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
The app stops at 40 model requests a day (`MAX_REQUESTS_PER_DAY`); a full real episode uses about 18 (16 turns, writing the host roles, and Iris).

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
