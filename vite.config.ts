import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  test: {
    environment: 'node',
    pool: 'forks',
    testTimeout: 60000,
    hookTimeout: 60000,
    teardownTimeout: 60000,
    include: ['tests/**/*.test.ts'],
  },
});
