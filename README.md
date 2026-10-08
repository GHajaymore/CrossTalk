# CrossTalk

A live broadcast studio where two AI hosts discuss a topic and you steer it. This is a local prototype, built one milestone at a time (see `docs/PLAN.md`).

**Status:** Milestone 2, real two-model discussion. Mock mode (scripted text, no API key) still works; real mode uses two free models through OpenRouter.

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

## Other commands

| Command | What it does |
| --- | --- |
| `npm test` | Runs the Vitest suite |
| `npm run typecheck` | Type-checks all three packages |
| `npm run build` | Builds the web app |

## Layout

```
apps/web         React + Vite: Create and Studio screens, the studio set component
apps/server      Fastify: conversation controller, mock provider, SQLite
packages/shared  Zod schemas, types, constants, auto names and personalities
docs/            Brief, plan, prototype and handoff
```

*AI-generated; not independently verified.*
