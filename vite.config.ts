import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('src/levels/')) {
            return 'levels';
          }
          if (id.includes('src/i18n/de-g2.ts')) {
            return 'i18n-de';
          }
          if (id.includes('src/i18n/fa-g2.ts')) {
            return 'i18n-fa';
          }
          if (id.includes('src/engine/')) {
            return 'engine';
          }
        },
      },
    },
  },
  test: {
    environment: 'node',
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    testTimeout: 60000,
    hookTimeout: 60000,
    teardownTimeout: 60000,
    include: ['tests/**/*.test.ts'],
  },
});
