import type { UserConfig } from 'vite';
import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

async function resolveViteConfig(mode: string): Promise<UserConfig> {
  return typeof viteConfig === 'function'
    ? await viteConfig({ command: 'serve', mode })
    : (viteConfig as UserConfig);
}

// Resolve kit modules from the published package (including `./code-view` and
// `./file-tree`); do not alias those subpaths to local stand-ins.
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
            // Required by SF-12's step-control enumeration (INV-1), which renders
            // the real step tree: `ResolvedAddressDisplay` reaches `ui-renderer`,
            // which imports a `.css` file Node cannot load while the dep stays
            // externalized. Inlining lets Vite transform it.
            //
            // Do NOT "tidy" this by mocking `ui-renderer` instead, the way
            // `AliasLabelBridge.test.tsx` does. The enumeration's whole claim is
            // that it measures the wizard's *actual* focusable-control surface
            // and partitions it exhaustively; mocking the renderer deletes
            // controls from that population, so the partition would balance over
            // a surface the users never see. A test that mocks away part of its
            // own population is the vacuous-pass shape this initiative has hit
            // repeatedly — see INV-1's pinned per-cell totals, which exist for
            // exactly this reason.
            '@openzeppelin/ui-renderer',
            '@openzeppelin/ui-utils',
            '@uiw/react-textarea-code-editor',
            '@openzeppelin/codegen-rwa-stellar',
          ],
        },
      },
    },
  })
);
