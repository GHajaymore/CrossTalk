// After `vite build`: a gzip copy beside each script, style sheet and the page, which the server
// sends to browsers that accept it (about a third of the size, so the app opens faster on a phone).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const files = [join(dist, 'index.html'), ...readdirSync(join(dist, 'assets')).filter(f => /\.(js|css|svg)$/.test(f)).map(f => join(dist, 'assets', f))];
for (const f of files) writeFileSync(`${f}.gz`, gzipSync(readFileSync(f), { level: 9 }));
console.log(`gzip: ${files.length} files`);
