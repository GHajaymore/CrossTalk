# Iris, the Artist

Iris listens to every finished episode and responds like a thoughtful listener: a short perspective in her own voice, a question for you, and a titled sketch of the moment that stayed with her. She never judges or scores the hosts and never takes sides.

## How she works

- **When:** once, automatically, after an episode completes (one request, counted toward the daily limit). "Ask Iris again" makes a new version.
- **Model:** real mode uses `ARTIST_MODEL`, a free model checked by the same free-model guard and different from both speakers. Mock mode uses scripted perspectives and hand-drawn scenes.
- **Output:** JSON with `perspective`, `momentSeq`, `caption` (a real quote of 20 words or fewer from that turn; replaced with one if she invents it), `artTitle`, `sketchSvg`, `imagePrompt` (saved for painted versions later).
- **Safety:** her SVG passes a strict allowlist (shapes and paths only, her palette only, no text, scripts, links, styles or entities) and is shown as an image. If it fails, her perspective shows alone with "Sketch again".
- **Never breaks an episode:** her failure leaves the discussion untouched.

## How she learns

1. Under each drawing, the listener taps 👍 or 👎 and can say what to keep or change.
2. Notes are stored in `iris_feedback`. Her latest 10 go into every new request as `<listener_notes>`: keep what was liked, change what was asked.
3. Settings → **What Iris has learned** lists the notes; any can be forgotten.

## Growing with the product (standing rule, see CLAUDE.md)

Whenever CrossTalk changes, review her notes and improve her where they point: the prompt in `apps/server/src/artist/prompt.ts`, the mock scenes in `mockSketches.ts`, or her card in `apps/web/src/studio/ArtistCard.tsx`.

## Next for Iris

- **Picture, Painting, Dreamscape:** a free open-source image model (e.g. FLUX or Stable Diffusion) on a free GPU, using her saved `imagePrompt`.
- An Iris page: her gallery across episodes, her styles, and prints for the shop (each waits for the owner's OK).
