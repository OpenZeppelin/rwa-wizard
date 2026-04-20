import { defineConfig, mergeConfig } from 'vitest/config';

import { sharedVitestConfig } from '../../vitest.shared.config';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      globals: true,
      include: ['src/**/*.{test,spec}.ts'],
    },
  })
);
