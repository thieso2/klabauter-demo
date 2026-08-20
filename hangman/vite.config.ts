import { defineConfig } from 'vitest/config';
// Vitest owns src/**/*.test.ts only. tests/browser/ (added in a later slice) is Playwright's;
// collecting it here would load @playwright/test outside a Playwright runner and fail the suite.
export default defineConfig({
  base: './',
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
