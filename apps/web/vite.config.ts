import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // GitHub Codespaces serves the dev server from *.app.github.dev.
    allowedHosts: ['.app.github.dev'],
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
});
