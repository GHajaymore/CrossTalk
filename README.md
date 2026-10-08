# CrossTalk

A live broadcast studio where two AI hosts discuss a topic and you steer it. This is a local prototype, built one milestone at a time (see `docs/PLAN.md`).

**Status:** Milestone 1, foundation + mock discussion. All speech is scripted sample text; no model is called and no API key is needed.

## Run it

Needs [Node.js](https://nodejs.org) 22 or newer.

```sh
npm install
npm run dev:mock
```

Open http://localhost:5173. The local server runs on http://127.0.0.1:8787 and saves discussions to `apps/server/data/crosstalk.sqlite`.

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
