// Starts the local server and the web app together. `--mock` forces PROVIDER_MODE=mock.
import { spawn } from 'node:child_process';

const env = { ...process.env };
if (process.argv.includes('--mock')) env.PROVIDER_MODE = 'mock';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const kids = ['@crosstalk/server', '@crosstalk/web'].map(ws =>
  spawn(npm, ['run', 'dev', '-w', ws], { stdio: 'inherit', env, shell: process.platform === 'win32' })
);

const stop = () => { kids.forEach(k => k.kill()); process.exit(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
kids.forEach(k => k.on('exit', code => { if (code) stop(); }));
