import type { UserConfig } from 'vite';
import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

async function resolveViteConfig(mode: string): Promise<UserConfig> {
  return typeof viteConfig === 'function'
    ? await viteConfig({ command: 'serve', mode })
    : (viteConfig as UserConfig);
}

// `@openzeppelin/ui-components/code-view` and `/file-tree` are deliberately NOT
// aliased to local shims. Author-written stand-ins cannot diverge from the kit
// without the suite staying green, which is how the stubs drifted from the real
// `FileTreeProps` and `BottomSheetProps` unnoticed.
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
