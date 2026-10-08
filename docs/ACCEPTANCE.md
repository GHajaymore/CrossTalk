# Acceptance tests

The 17 acceptance tests from `docs/BRIEF.md` §13, each with how it was verified. "Unit" tests run with
`npm test` (Vitest), "E2E" with `npm run e2e` (Playwright, Chromium, mock mode). "Manual" means checked
by hand, and why it isn't automated.

Last full run (Oct 8, 2026, after Milestone 8): `npm test` 19 files, 154 tests passed · `npm run e2e` 12 passed.

| # | Test | Verified by |
|---|---|---|
| 1 | Starts locally with documented commands | `docs/SETUP.md` (`npm install`, `npm run dev:mock`). **E2E:** every run builds and starts the app with `npm run build && npm start` before testing. |
| 2 | Mock mode works without credentials | **E2E:** the whole suite runs in mock mode with no key. **Unit:** every controller, cue and branch test uses the mock provider. |
| 3 | Real mode uses two distinct configured models | **Unit:** `realMode.test.ts` "runs a full discussion with two free models"; the same model in both seats is reported as a problem and blocks real runs ("reports what is missing instead of crashing"). **Manual:** real 16-turn episode recorded Oct 8 with two different free models. |
| 4 | A normal run ends after its last turn | Episodes have **16 short turns** since Oct 8 (owner's decision, `docs/PLAN.md`), not 8. **Unit:** `controller.test.ts` "ends a run after 16 completed turns"; branches end after their 4 new turns (`participation.test.ts`). |
| 5 | Stop prevents further scheduled turns | **Unit:** "Stop prevents any further turns" (and Stop cancels a waiting cue). **E2E:** "create → run → stop → refresh keeps every finished turn". |
| 6 | Partial failures don't erase completed turns | **Unit:** "a failed turn saves nothing, keeps earlier turns, and Retry continues"; a stopped turn never half-saves. |
| 7 | Refresh restores completed history | **E2E:** stop, reload, the same turns and status are back. **Unit:** a server restart marks the run interrupted instead of rerunning it. |
| 8 | A challenge changes the next response's context | **Unit:** `participation.test.ts` "a challenge lands in the very next prompt, once" (checks the exact prompt). **E2E:** "a challenge lands on the next turn as a cue card". |
| 9 | A branch preserves the original | **Unit:** "leaves the parent byte-identical and generates exactly 4 new turns"; branch of a branch. **E2E:** "branch from turn 4 leaves the original untouched". |
| 10 | Voice playback uses the configured speaker voices where available | **Manual:** voice per seat in the Studio and Settings, previewed and played on a device with voices. Not automated: headless Chromium has no speech voices. Recorded episodes play their own natural voices (seeking checked in Chromium). |
| 11 | Audio and generation controls work independently | **Manual:** listened while generation was paused and generated while listening (Milestone 3 demo); playback keeps going when switching Studio tabs. Playback lives in the browser and generation on the server, with separate controls. |
| 12 | Export includes models, turns, interventions and branch metadata | **Unit:** `export.test.ts` (JSON schema v1 and Markdown); `episodePage.test.ts` (the offline episode page: everything escaped, no network, producer notes left out). **E2E:** "export downloads Markdown and JSON with models, turns and cues". |
| 13 | API keys don't appear in frontend assets or normal logs | **Unit:** `webBundle.test.ts` (source and a fresh build with the key set), `realMode.test.ts` "never appears in logs or in any response", `export.test.ts` (not in exports). |
| 14 | Paid models are blocked by the free-only guard | **Unit:** `guard.test.ts` (paid, unknown, `:free`-only, routers, unreadable price list) and `realMode.test.ts` "blocks a paid model by name, before any chat request". |
| 15 | Request limits block generation with a clear message | **Unit:** "pauses when the daily request limit is reached"; retries never pass the limit. The Studio shows a "Daily limit reached" banner with the count and when turns can start again, and Start is disabled. |
| 16 | The mobile interface stays usable | **E2E:** phone viewport (Pixel 7): every screen without sideways scroll, the Listen player, and the cue sheet. |
| 17 | Critical flows pass automated tests | `npm test` and `npm run e2e`, plus **E2E** accessibility (axe, no serious or critical WCAG 2.1 A/AA issues on any screen), keyboard-only use and reduced motion. |
