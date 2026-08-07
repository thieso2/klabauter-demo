import { defineConfig } from 'vitest/config';
// Vitest owns src/**/*.test.ts only. tests/browser/ is Playwright's; collecting it
// here would load @playwright/test outside a Playwright runner and fail the suite.
export default defineConfig({
  base: './',
  // Three.js is the bulk of the bundle and changes only when the dependency does. Splitting it
  // out keeps each chunk under Rollup's warning threshold and lets the engine cache separately.
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
