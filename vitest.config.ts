import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Resolve `@assetopt/core` to its TypeScript source rather than `dist`.
      // The CI runs `test:run` *before* `build`, so `packages/core/dist` does
      // not exist yet; without this alias, even mocked imports fail to resolve.
      // Keeps the invariant: CLI tests never depend on the built core.
      '@assetopt/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['packages/**/src/**/*.test.ts'],
    environment: 'node',
  },
});
