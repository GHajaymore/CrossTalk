# Iris, the Artist

Iris listens to every finished episode and responds like a thoughtful listener: a short perspective in her own voice, a question for you, and a titled sketch of the moment that stayed with her. She never judges or scores the hosts and never takes sides.

## How she works

- **When:** once, automatically, after an episode completes (one request, counted toward the daily limit). "Ask Iris again" makes a new version.
- **Model:** real mode uses `ARTIST_MODEL`, a free model checked by the same free-model guard and different from both speakers. Mock mode uses scripted perspectives and hand-drawn scenes.
- **Output:** JSON with `perspective`, `momentSeq`, `caption` (a real quote of 20 words or fewer from that turn; replaced with one if she invents it), `artTitle`, `sketchSvg`, `imagePrompt` (saved for painted versions later).
- **Safety:** her SVG passes a strict allowlist (shapes and paths only, her palette only, no text, scripts, links, styles or entities) and is shown as an image. If it fails, her perspective shows alone with "Sketch again".
- **Never breaks an episode:** her failure leaves the discussion untouched.
- **Hears your cues (Milestone 4):** challenges, guests on the mic, go-deeper requests and temperature changes appear in her episode where they landed, and she prefers to draw the turn that answered you. In a branch she knows where you steered the show.

- **Living sketch:** her drawing draws itself while the episode plays (Listen cover, a corner of the
  Watch set) and finishes on the turn she chose; "Watch her draw" replays it on her card. It is rebuilt
  shape by shape from the checked SVG, never inserted as markup.

- **Poster and comic strip:** her sketch and quote are at the heart of both share images, made on the
  device. If she couldn't draw, the comic says so plainly.
- **Hot seat:** she knows only the listener decides who moved them, and never says who held, won or lost.

## How she learns

1. Under each drawing, the listener taps 👍 or 👎 and can say what to keep or change.
2. Notes are stored in `iris_feedback`. Her latest 10 go into every new request as `<listener_notes>`: keep what was liked, change what was asked.
3. The **Iris** page → **What Iris has learned** lists the notes; any can be forgotten.

## Growing with the product (standing rule, see CLAUDE.md)

Whenever CrossTalk changes, review her notes and improve her where they point: the prompt in `apps/server/src/artist/prompt.ts`, the mock scenes in `mockSketches.ts`, or her card in `apps/web/src/studio/ArtistCard.tsx`.

## Next for Iris

- **Picture, Painting, Dreamscape:** a free open-source image model (e.g. FLUX or Stable Diffusion) on a free GPU, using her saved `imagePrompt`.
- Prints for the shop from her gallery (each waits for the owner's OK). Her own page with the gallery and styles is done.
