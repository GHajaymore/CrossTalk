import { describe, expect, it } from 'vitest';
import { mapFace } from '../src/lib/faceMap';

// A plausible face in MediaPipe's 478-point layout: everything at the centre, then the points the
// talking photo uses moved to where they'd be on a 512 px portrait.
function face(over: Record<number, [number, number]> = {}) {
  const pts = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  const set = (i: number, x: number, y: number) => { pts[i] = { x: x / 512, y: y / 512 }; };
  // Eyes around y 200, mouth around y 330, chin at 400.
  for (const i of [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7]) set(i, 200, 200);
  for (const i of [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249]) set(i, 310, 200);
  set(159, 200, 194); set(145, 200, 206); set(386, 310, 194); set(374, 310, 206);
  set(61, 220, 330); set(291, 290, 330); set(13, 255, 326); set(14, 255, 332); set(17, 255, 345); set(152, 255, 400);
  for (const [i, xy] of Object.entries(over)) set(Number(i), ...xy);
  return pts;
}

describe('the face map for a talking photo', () => {
  it('finds the mouth, lips and eyes in pixels', () => {
    const m = mapFace(face(), 512, 512)!;
    expect(m.mouthL).toEqual({ x: 220, y: 330 });
    expect(m.chin.y).toBe(400);
    expect(m.innerTop).toHaveLength(11);
    expect(m.innerBottom).toHaveLength(11);
    expect(m.eyes.map(e => e.contour.length)).toEqual([16, 16]);
  });

  it("refuses something that isn't a clear face, so the still photo shows instead", () => {
    expect(mapFace(face().slice(0, 100), 512, 512)).toBeNull();
    expect(mapFace(face({ 291: [225, 330] }), 512, 512)).toBeNull(); // a mouth with no width
    expect(mapFace(face({ 152: [255, 320] }), 512, 512)).toBeNull(); // chin above the mouth
    expect(mapFace(face({ 13: [255, 150], 14: [255, 160] }), 512, 512)).toBeNull(); // mouth above the eyes
  });
});
