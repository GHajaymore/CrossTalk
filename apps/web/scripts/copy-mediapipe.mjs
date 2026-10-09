// Copies MediaPipe's face-map runtime (WebAssembly) next to the app, so it's served from our own
// server: no outside CDN. Runs before `vite` and `vite build`.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const from = join(dirname(require.resolve('@mediapipe/tasks-vision')), 'wasm');
const to = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'mediapipe');
mkdirSync(to, { recursive: true });
for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']) {
  copyFileSync(join(from, f), join(to, f));
  // A gzip copy alongside, which the server sends to browsers that accept it.
  writeFileSync(join(to, `${f}.gz`), gzipSync(readFileSync(join(from, f)), { level: 9 }));
}
