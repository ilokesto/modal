import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/fixtures/setup.ts',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    maxWorkers: 2,
  },
});
