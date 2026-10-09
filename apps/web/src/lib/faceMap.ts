// Where a host's mouth and eyes are on their photo, found once on this device with MediaPipe's face
// map (loaded only when a photo is on screen; nothing is sent anywhere). The talking photo uses it
// to open the mouth with the voice and to blink.

export type Pt = { x: number; y: number };
export type FaceMap = {
  /** Mouth corners, and the inner edges of the upper and lower lips. */
  mouthL: Pt; mouthR: Pt; lipTop: Pt; lipBottom: Pt;
  /** Bottom of the lower lip, the chin, and the jaw's sides at mouth height. */
  lipUnder: Pt; chin: Pt; jawL: Pt; jawR: Pt;
  /** The inner edges of the lips, corner to corner (left to right): the mouth opens between them. */
  innerTop: Pt[]; innerBottom: Pt[];
  /** Each eye's opening, all the way round, for blinking. */
  eyes: { outer: Pt; inner: Pt; top: Pt; bottom: Pt; contour: Pt[] }[];
};

// Indices in MediaPipe's 478-point face mesh.
const I = {
  mouthL: 61, mouthR: 291, lipTop: 13, lipBottom: 14, lipUnder: 17, chin: 152, jawL: 172, jawR: 397,
  innerTop: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
  innerBottom: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308],
  eyeL: { outer: 33, inner: 133, top: 159, bottom: 145, contour: [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7] },
  eyeR: { outer: 263, inner: 362, top: 386, bottom: 374, contour: [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249] },
};

type Landmark = { x: number; y: number };

/** The parts the talking photo needs, in pixels, from normalised landmarks. Null if they don't look like a face. */
export function mapFace(lm: Landmark[], w: number, h: number): FaceMap | null {
  if (lm.length < 468) return null;
  const p = (i: number): Pt => ({ x: lm[i].x * w, y: lm[i].y * h });
  const eye = (e: typeof I.eyeL) => ({ outer: p(e.outer), inner: p(e.inner), top: p(e.top), bottom: p(e.bottom), contour: e.contour.map(p) });
  const m: FaceMap = {
    mouthL: p(I.mouthL), mouthR: p(I.mouthR), lipTop: p(I.lipTop), lipBottom: p(I.lipBottom),
    lipUnder: p(I.lipUnder), chin: p(I.chin), jawL: p(I.jawL), jawR: p(I.jawR),
    innerTop: I.innerTop.map(p), innerBottom: I.innerBottom.map(p),
    eyes: [eye(I.eyeL), eye(I.eyeR)],
  };
  // A sane face: the mouth is wider than tall, below the eyes, above the chin.
  const mouthW = m.mouthR.x - m.mouthL.x;
  if (mouthW < w * 0.06 || m.chin.y <= m.lipBottom.y || m.lipTop.y <= Math.max(m.eyes[0].bottom.y, m.eyes[1].bottom.y)) return null;
  return m;
}

type Landmarker = { detect: (img: HTMLImageElement) => { faceLandmarks: Landmark[][] } };
let landmarker: Promise<Landmarker | null> | null = null;

/** MediaPipe's face map, loaded once, from this app's own server. Null if this browser can't run it. */
function load(): Promise<Landmarker | null> {
  landmarker ??= (async () => {
    try {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks('/mediapipe');
      return await FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'CPU' },
        runningMode: 'IMAGE', numFaces: 1,
      });
    } catch {
      return null;
    }
  })();
  return landmarker;
}

const found = new Map<string, Promise<FaceMap | null>>();

/** The face map for one photo (remembered by `key`, the host's look code), or null when there's no clear face. */
export function faceMapFor(key: string, img: HTMLImageElement): Promise<FaceMap | null> {
  let f = found.get(key);
  if (!f) {
    f = (async () => {
      const lm = await load();
      if (!lm) return null;
      let res;
      try { res = lm.detect(img); } catch { return null; }
      const pts = res.faceLandmarks[0];
      return pts ? mapFace(pts, img.naturalWidth, img.naturalHeight) : null;
    })();
    found.set(key, f);
  }
  return f;
}
