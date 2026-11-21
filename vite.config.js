import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// A relative base is what makes GitHub Pages work under /<repository>/.
// Override with `--base=/something/` if you ever host it elsewhere.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  plugins: [react()],
  // The dev server is only used locally and by hosted previews, which serve the
  // app from a proxied hostname. Vite rejects unknown Host headers by default.
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.e2b.app', 'localhost', '127.0.0.1'],
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: ['.e2b.app', 'localhost', '127.0.0.1'],
  },
  build: {
    outDir: 'dist',
    // Emit maps for debugging but don't advertise them in the bundle.
    sourcemap: 'hidden',
  },
}));
