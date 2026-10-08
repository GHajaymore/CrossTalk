# CrossTalk

A live broadcast studio where two AI hosts discuss a topic and you steer it. This is a local prototype, built one milestone at a time (see `docs/PLAN.md`).

**Status:** Milestone 6, polish. Two hosts, 16 short turns, listener cues (challenge, go deeper, take the mic, temperature), branches, Iris the Artist, an episodes library, export, and an offline episode page to keep or send. Iris sketches, paints and dreams up each episode. Start round two and the same hosts pick up where they ended. Listen plays on: when one episode ends, Up next starts the next. Pick Short (~3 min), Normal (~5 min) or Long (~8 min) episodes. The hosts are living portraits that talk, blink, glance and react. Raise your hand and the next host invites you on air. The Scout finds topics from news outlets across viewpoints and regions, Google Trends, Reddit, Bluesky, Mastodon, Hacker News, Wikipedia and sites you add, favouring your interests and countries. Say where you stand before and after, and see yourself on the mind-change meter next to the hosts. Mock mode (scripted text, no API key) always works; real mode uses free models through OpenRouter. Full setup: `docs/SETUP.md`.

## Run it

Needs [Node.js](https://nodejs.org) 22 or newer.

```sh
npm install
npm run dev:mock
```

Open http://localhost:5173. The local server runs on http://127.0.0.1:8787 and saves discussions to `apps/server/data/crosstalk.sqlite`.

### Real models (free)

1. Copy `.env.example` to `.env` and fill in `PROVIDER_MODE=openrouter`, your `OPENROUTER_API_KEY` and two free model IDs. `docs/MODELS.md` explains how to pick them.
2. Run `npm run dev` (not `dev:mock`).
3. Open **Settings** in the app: both models should show ✓ Free. If not, runs are blocked and the reason is shown.

The key stays on the local server and is never sent to the browser. Only models priced at $0 can run unless you set `ALLOW_PAID_MODELS=true` (don't).

## Put it online

Free hosting on Render at crosstalk.ajailabs.app, locked with an access code: see [docs/DEPLOY.md](docs/DEPLOY.md).

## Other commands

| Command | What it does |
| --- | --- |
| `npm test` | Runs the Vitest suite |
| `npm run typecheck` | Type-checks all three packages |
| `npm run e2e` | End-to-end and accessibility tests in Chromium (see `docs/SETUP.md`) |
| `npm run build` | Builds the web app |
| `npm start` | Runs the server, serving the built app |

## Layout

```
apps/web         React + Vite: Create, Studio (Watch, Listen, Read), Episodes, Iris, Settings
apps/server      Fastify: conversation controller, providers, Iris, SQLite, export, access lock
packages/shared  Zod schemas, types, constants, auto names and personalities
e2e/             Playwright end-to-end and accessibility tests
tools/voice      Free recorded voices (Kokoro) for an episode
docs/            Brief, plan, setup, models, limitations, acceptance, deploy, Iris
```

*AI-generated; not independently verified.*
