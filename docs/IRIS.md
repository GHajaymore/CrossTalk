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
- **She paints:** three styles, all made from her own checked lines in the browser (`packages/shared/src/paint.ts`):
  **Sketch** (the lines), **Painting** (watercolour washes, paper grain, inky lines) and **Dreamscape** (night sky,
  moon, drifting coloured echoes and a still lake). SVG filters only: no image model, nothing sent anywhere, always
  free, and nothing new for the safety check because the painted picture adds no drawing of its own. Each episode
  gets its own brushwork (seeded by its id). Her reply includes `artStyle`; if a model leaves it out or invents one,
  she uses the listener's favourite, else the episode's feel (calm → sketch, Explore → dreamscape, otherwise painting).
  The listener can switch it on her card (`PUT /api/conversations/:id/artist/style`); the gallery, thumbnails,
  Listen cover, poster and comic all follow. While an episode plays she sketches, and her painting takes over
  once she reaches her moment.

## How she learns

1. Under each drawing, the listener taps 👍 or 👎 and can say what to keep or change.
2. Notes are stored in `iris_feedback`. Her latest 10 go into every new request as `<listener_notes>`: keep what was liked, change what was asked.
3. The **Iris** page → **What Iris has learned** lists the notes; any can be forgotten.
4. **Her style follows your taste.** When you switch a drawing's style yourself, it's remembered
   (`artist_notes.style_by_listener`). Once you've chosen the same style twice in your last five picks, she uses it
   by default and real-mode Iris is told about it in her prompt. "Ask Iris again" is her own pick, so it doesn't count.

## Growing with the product (standing rule, see CLAUDE.md)

Whenever CrossTalk changes, review her notes and improve her where they point: the prompt in `apps/server/src/artist/prompt.ts`, the mock scenes in `mockSketches.ts`, or her card in `apps/web/src/studio/ArtistCard.tsx`.

## Next for Iris

- **Picture:** a full illustration needs an image model. Every image model on OpenRouter is paid today, so it waits
  for a free one (or a free GPU running an open model), using her saved `imagePrompt`.
- Prints for the shop from her gallery (each waits for the owner's OK). Her own page with the gallery and styles is done.
