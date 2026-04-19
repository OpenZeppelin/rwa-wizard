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
            '@uiw/react-textarea-code-editor',
            '@openzeppelin/codegen-rwa-stellar',
          ],
        },
      },
    },
  })
);
