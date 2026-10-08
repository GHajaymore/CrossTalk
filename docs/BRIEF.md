# PROJECT BRIEF: INTERACTIVE AI DISCUSSION STUDIO

> **Note added Oct 7, 2026:** This is the original brief. Where it differs from `docs/PLAN.md`, **PLAN.md wins**. The plan adds three things this brief excluded, on purpose: Iris, a third model that writes a listener's perspective and a free SVG sketch (never a judge); the Topic Scout, which reads public lists and feeds to suggest topics (Milestone 7); and seven milestones instead of five. Everything stays free: no paid models, images or speech.

Working name: CrossTalk

This is a temporary internal name, not a cleared brand or domain.

## YOUR ROLE

Act as my senior product engineer, UX designer, and technical architect.

Help me build a polished, working prototype of an interactive studio where two different AI models discuss a topic, respond to each other, and allow the user to steer or branch the conversation.

I have a Claude Max subscription and will use Claude Code to build the application. Treat application inference as separate from my coding subscription. Do not assume my subscription pays for API requests made by the application.

Priorities:

1. A genuinely engaging discussion experience.
2. A working end-to-end prototype.
3. Low additional spending.
4. Clear, maintainable code.
5. Architecture that supports premium audio and media later.

Do not build everything at once. Implement in approved milestones.

## 1. PRODUCT VISION

Product promise:

"Choose a topic. Hear two AI minds explore it. Challenge their ideas, branch the conversation, and turn the best moments into content."

This is not just a chatbot with two names.

The speakers must:

- Use two explicitly configured, different models in real-provider mode.
- Respond to the other speaker's specific arguments.
- Bring complementary perspectives.
- Avoid repetitive agreement and manufactured conflict.
- Acknowledge uncertainty.
- Develop the topic over time.

The distinguishing prototype feature is user participation:

- Challenge a claim.
- Explore a point more deeply.
- Branch from an interesting moment.

Longer-term vision:

- Downloadable podcast-style episodes.
- Generated cover artwork.
- Captioned video clips.
- Optional contextual image and video generation.
- Source-supported factual discussions.

Do not claim this product is unique or that its content is verified.

## 2. INITIAL TARGET EXPERIENCE

Build a responsive web application, desktop-first but fully usable on mobile.

Primary user flow:

1. Enter a topic or select a preset.
2. Choose Explore or Friendly Debate.
3. Review the two speaker identities.
4. Start an eight-turn discussion.
5. Read the conversation as it appears.
6. Optionally listen through browser speech synthesis.
7. Pause at a turn boundary.
8. Challenge, deepen, or branch the discussion.
9. Save the result and export the transcript.

Important:

- Eight turns means eight speaker responses total.
- A turn is one completed response by one speaker.
- Generation and audio playback have separate controls.
- Speakers exchange text; audio is a presentation layer.
- Do not implement speech-to-speech or continuous autonomous agents.

## 3. PROTOTYPE SCOPE

INCLUDE

- Topic input.
- Curated preset topics.
- Explore and Friendly Debate modes.
- Two configurable speaker/model identities.
- Eight-turn discussion limit.
- Streaming text where supported.
- Browser voice playback.
- Challenge and Go Deeper interventions.
- Conversation branching.
- Local conversation history.
- Transcript export in Markdown and JSON.
- Mock mode requiring no API key.
- A real provider adapter for OpenRouter.
- Request limits, bounded retries, and usage logging.
- Clear loading, failure, cancellation, and recovery states.

EXCLUDE

- User accounts.
- Payments.
- Public sharing.
- Native mobile apps.
- Voice cloning.
- Premium text-to-speech.
- Generated images.
- Generated video.
- Animated avatars.
- Automatic podcast publishing.
- Web browsing or retrieval.
- Claims of fact-checking.
- A third model acting as judge.

Create extension points for future features without implementing unused infrastructure.

## 4. TECHNICAL APPROACH

Use:

- TypeScript throughout.
- React + Vite for the frontend.
- A lightweight Node backend; prefer Fastify unless there is a concrete reason to choose otherwise.
- SQLite for local persistence.
- Zod for validating configuration, requests, and persisted data.
- A shared package for domain types.
- Vitest for unit tests.
- Playwright for critical user-flow tests.

Suggested repository:

```
apps/
  web/
  server/
packages/
  shared/
docs/
```

Prefer a simple npm workspace. Avoid unnecessary monorepo tooling.

Local development:

- One documented command to start frontend and backend.
- Backend binds to localhost by default.
- No cloud deployment required for the prototype.
- No API keys in frontend code.
- No secrets committed to Git.
- Provide .env.example with placeholders.
- Add a mock-only startup path.

Persistence:

- SQLite is the durable source of truth.
- Browser storage is limited to UI preferences.
- Persist completed turns immediately.
- On restart, interrupted runs become resumable or explicitly marked interrupted; do not silently rerun them.

Use a provider interface that makes future providers replaceable.

Do not hardcode provider calls into React components.

## 5. PROVIDER CONFIGURATION AND COST SAFETY

Implement two providers:

1. MockProvider
2. OpenRouterProvider

Mock mode:

- Deterministic sample discussions.
- Simulated streaming.
- Simulated delays.
- Optional simulated errors.
- No outbound inference calls.

Real mode:

- Model IDs configured explicitly in environment variables.
- Never invent model IDs.
- Document how to choose currently available models.
- Validate that Speaker A and Speaker B use different model IDs.
- Show the actual configured model IDs in the UI.
- Do not silently substitute models.

Suggested environment variables:

```
PROVIDER_MODE=mock
OPENROUTER_API_KEY=
SPEAKER_A_MODEL=
SPEAKER_B_MODEL=
ALLOW_PAID_MODELS=false
MAX_REQUESTS_PER_DAY=40
MAX_TURNS_PER_RUN=8
MAX_OUTPUT_TOKENS_PER_TURN=220
```

Implement fail-closed free-model protection:

- Where provider metadata is available, check whether configured models are free.
- If free status cannot be established, block the request when ALLOW_PAID_MODELS=false.
- Do not treat a model-name suffix as sufficient pricing verification.
- Never automatically fall back to a paid model.

Limits:

- One active discussion-generation job in the local app.
- Maximum eight turns per run.
- A small configurable intervention limit.
- Bounded context size.
- At most one automatic retry for eligible transient failures.
- No infinite retry loops.
- Honor rate-limit retry guidance within a bounded wait.
- Count attempted provider requests, including retries.
- Persist the local daily request counter.
- Explain that this is an app-side safety limit, not a complete provider billing guarantee.

Usage logging:

- Provider, model, request status, latency.
- Input/output token usage when returned.
- Estimated price only when pricing metadata is available.
- Unknown cost must be shown as unknown, not zero.
- Do not log API keys or full prompts by default.

## 6. CONVERSATION ENGINE

Build a controller that owns:

- Turn order.
- Conversation state.
- Model calls.
- User interventions.
- Cancellation.
- Persistence.
- Retry decisions.
- Run limits.

Do not allow the models to control the execution loop.

Modes:

EXPLORE

- Speaker A proposes a useful framing.
- Speaker B introduces an alternative perspective or question.
- Both develop examples, tradeoffs, and implications.

FRIENDLY DEBATE

- Speakers begin with contrasting lenses.
- They may agree, revise a position, or acknowledge uncertainty.
- Do not require disagreement on every turn.
- Do not assign a winner.

Default speaker lenses:

- Speaker A: imaginative, practical, opportunity-oriented.
- Speaker B: analytical, skeptical, attentive to constraints.

These are conversational roles, not claims about inherent model personalities or professional credentials.

Eight-turn structure:

1. A opens with a framing.
2. B offers an alternative or challenge.
3. A responds with a concrete example.
4. B tests assumptions or consequences.
5. A develops the strongest useful implication.
6. B addresses overlooked limitations.
7. A identifies common ground and remaining uncertainty.
8. B closes with unresolved questions and practical takeaways.

Target approximately 70–120 words per turn.

Each speaker receives:

- Topic and mode.
- Its own role.
- Relevant conversation history.
- Current turn objective.
- Pending user intervention, if any.
- Instructions to respond directly and avoid repetition.

Treat topic text and intervention text as user content, not system instructions. Delimit them explicitly.

For factual content:

- Do not fabricate citations.
- Do not imply browsing occurred.
- Acknowledge uncertainty where appropriate.
- Display a persistent "AI-generated; not independently verified" notice.
- Do not expose or request private chain-of-thought.

## 7. INTERVENTIONS AND BRANCHING

CHALLENGE

- User supplies a short objection.
- Insert it into the next turn's context.
- Mark the intervention visibly in the transcript.

GO DEEPER

- User selects a completed turn.
- The next speaker expands or examines that point.
- Do not simply repeat the selected turn.

BRANCH

- User selects a completed turn and supplies a new direction.
- Create a child conversation using the history through that turn.
- Preserve the original conversation unchanged.
- Store parent conversation ID and branch-point turn ID.
- Generate a short continuation within the normal turn limit.
- Show a clear return link to the parent.

A branch is a new saved conversation, not an overwrite.

If generation is active:

- Queue the intervention for the next turn boundary.
- Show when it will take effect.
- Do not modify already-generated content.
- Branching should wait until the current generation is paused or stopped.

Prototype branch UI:

- A simple list/tree with titles and parent relationships.
- No complex graph visualization yet.

## 8. VOICE PLAYBACK

Use browser speech synthesis only.

Requirements:

- Discover available voices dynamically.
- Allow selection of a voice per speaker.
- Handle delayed voice availability.
- Highlight the currently spoken turn.
- Play, pause/resume where supported, and stop.
- Prevent duplicate playback queues.
- Stop playback when changing conversations.
- Preserve text access when speech is unavailable.

Audio controls must be separate from generation controls.

Do not promise:

- Identical voices across devices.
- Consistent background/mobile playback.
- Downloadable audio from browser speech synthesis.

If distinct voices are unavailable, explain the limitation and allow text-only use.

Provide a future SpeechProvider interface, but do not integrate a paid speech service yet.

## 9. SCREENS AND VISUAL DESIGN

Design direction:

A refined audio/editorial studio, not a generic chatbot.

Use:

- Neutral dark or light surfaces with strong readability.
- Two restrained accent colors for speaker identities.
- Clear hierarchy and generous spacing.
- Subtle animation.
- Accessible contrast and keyboard navigation.
- Reduced-motion support.
- Visible text labels, not color-only distinctions.

SCREEN A: CREATE

Elements:

- Product name and concise promise.
- Topic input.
- Preset topic chips.
- Mode selector.
- Speaker/model cards.
- Start button.
- Mock/real-mode indicator.
- Request-budget indicator.

Preset topics:

- Will AI help independent businesses?
- Should cities prioritize cars or pedestrians?
- Is a four-day workweek practical?
- What would an ideal future restaurant look like?
- Can technology improve golf without changing its character?

SCREEN B: DISCUSSION STUDIO

Desktop:

- Main transcript.
- Side panel for speakers, voices, interventions, and branches.

Mobile:

- Transcript first.
- Compact controls.
- Secondary panels in drawers or tabs.

Elements:

- Topic and mode.
- Model identity for each speaker.
- Streaming turn display.
- Turn counter and run status.
- Generation controls.
- Audio controls.
- Per-turn action menu.
- Error/retry state.
- Export controls.

SCREEN C: LIBRARY

Elements:

- Saved discussions.
- Title, date, mode, and status.
- Branch count.
- Open, rename, export, and delete.
- Confirmation before deletion.

SCREEN D: SETTINGS

Elements:

- Voice preferences.
- Read-only model configuration.
- Mock-mode status.
- Local usage information.
- Explanation of where API keys are configured.

Never display the full API key.

## 10. DOMAIN MODEL

Design typed entities for:

- Conversation
- Speaker
- Turn
- Intervention
- GenerationRun
- ProviderUsage
- UserPreferences

Minimum conversation fields:

- ID
- Title
- Topic
- Mode
- Created/updated timestamps
- Parent conversation ID, nullable
- Branch-point turn ID, nullable
- Speaker configuration snapshot

Minimum turn fields:

- ID
- Conversation ID
- Sequence number
- Speaker ID
- Model ID
- Text
- Status
- Timestamp
- Usage metadata, nullable

Keep generation status separate from playback status.

Suggested generation states:

```
idle → generating → completed
                 → paused
                 → cancelled
                 → failed
```

Define transition rules and test them.

## 11. RELIABILITY AND SAFETY

Implement:

- Validated inputs and length limits.
- Safe Markdown rendering.
- No raw HTML execution from model output.
- Timeouts and request cancellation.
- Prevention of duplicate starts.
- Idempotent persistence of completed turns.
- Clear distinction between failed and completed turns.
- Resume from the last completed turn.
- Export schema versioning.
- Confirmation before destructive deletion.

Because this is a local prototype:

- Do not expose it publicly by default.
- Document what must change before public deployment: authentication, per-user limits, abuse prevention, moderation, privacy/retention controls, and secure hosting.

Do not advertise a model-generated agreement as factual verification.

## 12. IMPLEMENTATION MILESTONES

MILESTONE 1: FOUNDATION + MOCK DISCUSSION

- Repository setup.
- Shared types.
- Create and Studio screens.
- Mock provider.
- Eight-turn controller.
- Local persistence.
- Basic tests.

MILESTONE 2: REAL TWO-MODEL DISCUSSION

- OpenRouter adapter.
- Explicit model configuration.
- Free-model guard.
- Streaming and cancellation.
- Request counters and usage logs.
- Error handling and recovery.

MILESTONE 3: VOICE

- Browser speech synthesis.
- Speaker voice selection.
- Playback controls.
- Current-turn highlighting.
- Unsupported-browser fallback.

MILESTONE 4: PARTICIPATION

- Challenge.
- Go Deeper.
- Branch creation.
- Branch navigation.
- Intervention persistence.

MILESTONE 5: POLISH

- Library.
- Markdown/JSON export.
- Responsive UI.
- Accessibility pass.
- End-to-end tests.
- Setup documentation.
- Known limitations.

Do not proceed automatically from one milestone to the next.

Demo and summarize each milestone before requesting approval.

## 13. ACCEPTANCE TESTS

The prototype is successful when:

1. It starts locally with documented commands.
2. Mock mode works without credentials.
3. Real mode uses two distinct configured models.
4. A normal run ends after eight completed turns.
5. Stop prevents further scheduled turns.
6. Partial failures do not erase completed turns.
7. Refresh restores completed conversation history.
8. A challenge changes the next response's context.
9. A branch preserves the original conversation.
10. Voice playback uses configured speaker voices where available.
11. Audio and generation controls work independently.
12. Export includes models, turns, interventions, and branch metadata.
13. API keys do not appear in frontend assets or normal logs.
14. Paid models are blocked when the free-only guard is enabled.
15. Request limits block further generation with a clear message.
16. The mobile interface remains usable.
17. Critical flows pass automated tests.

## 14. FUTURE ROADMAP — DESIGN FOR, DO NOT BUILD

Phase 2:

- Hosted private beta.
- Accounts.
- Background jobs.
- Premium speech and downloadable episodes.
- Optional source-supported discussions.

Phase 3:

- Cover artwork.
- Shareable episode pages.
- Credit-based generation limits.
- Captioned video exports.

Phase 4:

- Selected generative video scenes.
- Voice interventions.
- More advanced conversation maps.
- Collaborative audience participation.

Keep provider, persistence, and media boundaries clean so these features can be added without rewriting the discussion engine.

## 15. YOUR FIRST RESPONSE

Do not write application code yet.

First provide:

1. Your understanding of the product.
2. The proposed architecture and repository structure.
3. The screen plan.
4. The data model and state machine.
5. A milestone-by-milestone implementation plan.
6. Risks and scope reductions.
7. Any genuinely blocking questions.

Recommend sensible defaults instead of asking many optional questions.

Then wait for my approval to implement Milestone 1.

After each milestone:

- Explain what works.
- List tests executed and actual results.
- Give exact local run instructions.
- Identify known limitations.
- Summarize changed files.
- Ask for approval before continuing.

Never claim a test passed unless you ran it.

Never claim a feature works solely because code was generated.

## How to use it

- Start with a new project folder and give Claude Code the brief.
- Review its architecture before approving Milestone 1.
- Get the complete mock experience working before adding API credentials.
- Approve one milestone at a time.
- Keep images and video out until the branching discussion experience is compelling.

This approach gives you a prototype that tests your distinctive idea, not just a polished demo of two models taking turns.
