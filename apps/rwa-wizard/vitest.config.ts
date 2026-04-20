import type { UserConfig } from 'vite';
import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

async function resolveViteConfig(mode: string): Promise<UserConfig> {
  return typeof viteConfig === 'function'
    ? await viteConfig({ command: 'serve', mode })
    : (viteConfig as UserConfig);
}

export default defineConfig(async ({ mode }) =>
  mergeConfig(await resolveViteConfig(mode), {
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: ['src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      server: {
        deps: {
          inline: [
            '@openzeppelin/ui-components',
            // Ensures `vi.mock('@openzeppelin/ui-utils')` applies to the same module instance
            // `@openzeppelin/ui-react` resolves for `AnalyticsProvider` (avoids split bundles in tests).
            '@openzeppelin/ui-react',
            '@openzeppelin/ui-utils',
            '@uiw/react-textarea-code-editor',
            '@openzeppelin/codegen-rwa-stellar',
          ],
        },
      },
    },
  })
);
