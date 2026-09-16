import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5180,
    strictPort: true,
    allowedHosts: true
  },
  // Production preview server: the watchdog serves the built bundle on 5180.
  // Playing the minified build is noticeably smoother on mobile than the dev
  // server (no per-module requests, no HMR client, minified JS).
  preview: {
    host: '0.0.0.0',
    port: 5180,
    strictPort: true,
    allowedHosts: true
  },
  build: {
    target: 'esnext'
  }
});
