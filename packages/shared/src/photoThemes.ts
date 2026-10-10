// Photo of the day: Iris's camera offers one idea from each kind of picture, new every day.
// Each is written the way a photographer briefs a shoot: one clear subject, light with a reason,
// room around it. Hands and faces stay out of close-up (free AI cameras get them wrong), and any
// people are invented adults seen from a distance.

export type PhotoTheme = { kind: string; title: string; prompt: string };

const KINDS: { kind: string; ideas: [string, string][] }[] = [
  { kind: 'Mountains', ideas: [
    ['Door to the peaks', 'A real photograph of an old wooden door standing alone on a high meadow, open onto snowy mountains at sunrise, mist in the valley below, the door off-centre, warm low sun, 35mm, shallow depth of field'],
    ['Alpenglow', 'A real photograph of a jagged snow peak glowing pink at the last minute of sunset above a dark pine valley, a thin line of cloud below the summit, long lens compression, deep blue sky, 200mm'],
    ['Hut in the clouds', 'A real photograph of a small stone mountain hut with one lit window on a ridge, clouds pouring over the pass behind it at dusk, the hut small in the lower third, cool blues and a warm window, 50mm'],
    ['First snow', 'A real photograph of the first light snow on a dark mountain lake shore, a single red canoe pulled up on the stones, soft overcast light, quiet negative space, muted colours, 35mm'],
    ['Lone summit', 'A real photograph of a hiker, small and far away, standing on a rocky summit above a sea of clouds at dawn, seen from behind, golden rim light, vast sky, 85mm'],
  ] },
  { kind: 'Trails', ideas: [
    ['The fork', 'A real photograph of a forest trail splitting in two around an old mossy boulder, morning fog between tall trees, sunbeams through the mist, low camera at path level, green and gold, 24mm'],
    ['Boots at rest', 'A real photograph of a pair of worn hiking boots resting on a flat rock beside a trail, a valley falling away behind them in soft focus, late afternoon light, earthy browns, 50mm, shallow depth of field'],
    ['Switchbacks', 'A real photograph looking down on a zigzag mountain path with two tiny hikers far apart on it, long shadows in low sun, strong leading lines, high vantage point, 70mm'],
    ['Trail marker', 'A real photograph of a weathered wooden trail sign with no readable words, pointing into autumn birch woods, backlit golden leaves, sign off-centre, 35mm, shallow depth of field'],
    ['River crossing', 'A real photograph of stepping stones crossing a clear mountain stream, water blurred silky by a slow shutter, mossy banks, soft overcast light, low angle, 24mm'],
  ] },
  { kind: 'Sport', ideas: [
    ['Dawn fairway', 'A real photograph of an empty golf fairway at dawn, a single ball resting in dew-covered grass in the foreground, mist over the green beyond, long shadows, low camera, 50mm, shallow depth of field'],
    ['Empty court', 'A real photograph of an outdoor basketball court after rain, the hoop reflected in a puddle, city lights coming on at dusk, the hoop in the upper third, cool blue and sodium orange, 35mm'],
    ['The finish line', 'A real photograph of a painted finish line on an empty running track at sunrise, lane lines leading to the horizon, a lone runner tiny and far away, warm low light, 24mm'],
    ['Rowing at first light', 'A real photograph of a single rowing boat gliding across a glassy lake at first light, seen from far away, ripples trailing behind, mist on the water, soft pastel colours, 135mm'],
    ['Chalk and rope', 'A real photograph of a climbing rope coiled at the foot of a sunlit granite wall, a chalk bag beside it, the cliff rising out of frame, warm afternoon light, strong texture, 35mm'],
  ] },
  { kind: 'Water', ideas: [
    ['Tide pool', 'A real photograph of a still tide pool reflecting the evening sky on a rocky shore, small waves breaking softly behind, long exposure, pink and slate colours, low angle, 24mm'],
    ['The pier', 'A real photograph of an old wooden pier running into a calm grey sea in fog, the end of the pier disappearing, minimalist composition, soft diffuse light, 50mm'],
    ['Lighthouse weather', 'A real photograph of a white lighthouse on a cliff as a storm front rolls in, a sliver of sunlight on the tower, dramatic dark clouds, the lighthouse off-centre, 85mm'],
    ['Waterfall veil', 'A real photograph of a tall thin waterfall falling into a fern-covered gorge, water silky from a slow shutter, cool green light, a small figure far away at the base for scale, 24mm'],
    ['Boathouse', 'A real photograph of a red wooden boathouse on a quiet northern lake at blue hour, its reflection perfect in still water, a single warm light inside, 35mm'],
  ] },
  { kind: 'Weather', ideas: [
    ['After the storm', 'A real photograph of a rainbow over a wet country road after a storm, puddles catching the light, dark clouds behind and bright sun in front, the road leading into the frame, 24mm'],
    ['Fog field', 'A real photograph of a single tree in a field swallowed by thick morning fog, the tree off-centre, soft grey tones, a hint of sunrise colour, minimalist, 85mm'],
    ['Heat haze', 'A real photograph of a long desert highway shimmering in midday heat haze, distant mountains, the road vanishing to a point, bleached colours, 200mm compression'],
    ['Snowfall at night', 'A real photograph of snow falling under a single street lamp in a quiet village lane at night, flakes lit against the dark, footprints leading away, warm lamp and blue shadows, 50mm'],
    ['Lightning sea', 'A real photograph of a lightning bolt over a dark sea seen from a distant headland, purple storm clouds, the horizon low in the frame, long exposure, 35mm'],
  ] },
  { kind: 'City', ideas: [
    ['Window light', 'A real photograph of a corner café at dawn seen from across the street, warm light spilling onto a wet pavement, a bicycle leaning outside, quiet empty street, 50mm'],
    ['Rooftop garden', 'A real photograph of a small rooftop vegetable garden above a busy city at golden hour, tomato plants and a watering can in the foreground, skyline soft behind, 35mm'],
    ['Last train', 'A real photograph of an empty train platform late at night, a single train with lit windows waiting, long perspective lines, cool fluorescent light and deep shadows, 24mm'],
    ['Market morning', 'A real photograph of a street market setting up at sunrise, crates of oranges and lemons in the foreground, awnings glowing in low sun, people small and blurred in the distance, 35mm'],
    ['Bridge at blue hour', 'A real photograph of an old stone bridge over a river at blue hour, city lights reflected in the water, the bridge running diagonally through the frame, 24mm'],
  ] },
  { kind: 'Still life', ideas: [
    ['Two cups', 'A real photograph of two cups of tea on a wooden windowsill, steam rising in a beam of morning light, rain on the glass behind, quiet and intimate, 50mm, shallow depth of field'],
    ['The old map', 'A real photograph of a folded paper hiking map with no readable words, a compass and a pencil on a rough wooden table, warm lamp light from the side, rich browns, 50mm'],
    ['Chessboard', 'A real photograph of a wooden chessboard mid-game by a sunny window, long shadows of the pieces across the board, one knight in sharp focus, 85mm, shallow depth of field'],
    ['Seeds and soil', 'A real photograph of seedlings sprouting in small clay pots on a greenhouse shelf, soft diffuse light through misted glass, fresh greens, one pot in focus, 100mm macro'],
    ['Letter unsent', 'A real photograph of a sealed envelope with no writing and a fountain pen on an old desk, a window with evening light, dust in the air, muted warm tones, 50mm'],
  ] },
  { kind: 'Night', ideas: [
    ['Milky Way camp', 'A real photograph of a small lit tent under the Milky Way on a mountain plateau, the tent glowing orange in the lower third, a vast starry sky, long exposure, 20mm'],
    ['Moonrise', 'A real photograph of a huge full moon rising behind a lone hilltop tree, the tree in silhouette, deep blue twilight, long lens compression, 400mm'],
    ['Fireflies', 'A real photograph of fireflies glowing in a summer meadow at the edge of a dark forest, soft bokeh lights, deep greens and gold, long exposure, 50mm'],
    ['Northern lights', 'A real photograph of green northern lights over a frozen lake with a small wooden cabin on the shore, stars, reflections in clear ice, 24mm'],
    ['City from above', 'A real photograph of a city grid glowing at night seen from a mountain lookout, a single bench in the foreground in silhouette, warm city lights and cool sky, 35mm'],
  ] },
];

/** Every theme, kind by kind. */
export const PHOTO_THEMES: PhotoTheme[] = KINDS.flatMap(k => k.ideas.map(([title, prompt]) => ({ kind: k.kind, title, prompt })));

/** Today's ideas: one of each kind, a different one each day (the same all day, everywhere). */
export function photoThemesFor(date: Date): PhotoTheme[] {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return KINDS.map((k, i) => {
    const [title, prompt] = k.ideas[(day + i * 2) % k.ideas.length];
    return { kind: k.kind, title, prompt };
  });
}
