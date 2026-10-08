# Handoff to Claude Code: CrossTalk, Milestone 1

From the planning session in the "Cross Talk" claude.ai project, Oct 7, 2026. Read this first, then `docs/PLAN.md`, `docs/BRIEF.md` and `docs/prototype.html`.

## What the owner wants

CrossTalk is a live broadcast studio where two AI hosts discuss a topic and the listener steers it (cues, branching, guest turns). Iris, a third AI, listens and responds with a short perspective and a titled sketch. The long-term goal is a podcast, social clips posted with the owner's approval, and selling Iris's art. The owner wants it to feel extraordinary, not like a chatbot. The design is settled in `docs/prototype.html`, so match it rather than reinterpret it.

The owner is not a developer. He works through the Claude desktop app in Cloud sessions, often checks in from his phone, and prefers plain explanations, sensible defaults and short questions only when truly needed.

## Hard rules

- `docs/PLAN.md` wins wherever it differs from `docs/BRIEF.md`.
- Everything stays **free**: mock mode for Milestone 1, free models only later, no paid image, speech or video services.
- One milestone at a time. Stop at the end of Milestone 1 and wait for approval before committing, pushing or starting Milestone 2.
- Only report tests you actually ran, with their real output.
- No API keys in the web app or logs; never commit `.env`; never invent model IDs.
- Nothing is ever published or posted automatically.
- Never imitate a real person's name, voice or face.

## Milestone 1 scope

Foundation + mock discussion, as in `docs/PLAN.md` → Milestones → 1, including:

- npm workspaces (`apps/web`, `apps/server`, `packages/shared`), TypeScript, React + Vite, Fastify, SQLite (`better-sqlite3`), Zod, Vitest.
- **Create** and **Studio** screens matching `docs/prototype.html`:
  - the **studio set** (video-podcast look: presenter tiles with mic, name bar and voice meter, active-speaker highlight, guest tile, REC light and timer, YouTube-style captions, Iris status, room light by Temperature);
  - the two speakers facing each other across the table with a centre line; cue cards on that line; the turn rail; the dock with separate Generation and Listen controls;
  - Format (Recorded/Live), Audience, Temperature and Personality settings, auto personalities and **auto host names**, stored on the conversation.
- MockProvider with scripted turns (reuse the prototype's mock scripts), simulated streaming, delays and an error switch.
- Conversation controller and run state machine (idle, generating, paused, completed, cancelled, failed); Pause and Stop at turn boundaries; turns saved as they finish; refresh restores history; a restart marks a run interrupted instead of rerunning it.
- Tests: state transitions, idempotent turn saving, a run ends after 8 turns, Stop prevents further turns.

**The studio is the centrepiece.** The owner wants CrossTalk to look like a real video podcast, and later each host tile will show a lifelike AI-generated presenter moving and talking in real time (Phase 2, behind a `PresenterProvider` interface). So build the studio as **one self-contained component** with a clear interface (speakers, who's speaking, voice level, caption, run state), and give each host tile a slot where a `<video>` element can replace the initials later. Keep styling in design tokens.

Out of scope for Milestone 1: real models, voices, cues and branching, Iris, Scout, Control room, Library, export. Placeholders that look like the prototype are fine when clearly marked.

## Repo tidy-up (first step)

The repo root has upload leftovers. Before coding:

1. Delete the old `PLAN.md` and `prototype.html`.
2. Rename the highest-numbered `PLAN_N.md` to `PLAN.md` and `prototype_N.html` to `prototype.html`. If there are no numbered copies, keep the files as they are.
3. Move `PLAN.md`, `BRIEF.md`, `prototype.html`, `HANDOFF.md` and `Cross Talk Prompt.docx` into `docs/`.
4. Create `CLAUDE.md` from the rules at the end of `docs/PLAN.md`, a short `README.md`, and a `.gitignore` excluding `.env`, `node_modules`, build output and the SQLite file.

## Report back with

1. What works, in plain words.
2. Tests run and their actual results.
3. How the owner can see it (he has no local setup yet; offer the simplest way, and say what he'd need to install).
4. Known limitations.
5. A side-by-side check against `docs/prototype.html`, listing any differences left.
6. Changed files.

Then ask: "Approve Milestone 1 and commit?"
