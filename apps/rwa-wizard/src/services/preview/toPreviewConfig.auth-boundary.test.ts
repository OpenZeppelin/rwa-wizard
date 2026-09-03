import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('toPreviewConfig auth boundary (INV-12)', () => {
  it('does not import the codegen loader or RwaCodegenService', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const files = ['toPreviewConfig.ts', 'placeholders.ts', 'index.ts'] as const;

    for (const file of files) {
      const source = readFileSync(join(here, file), 'utf8');
      expect(
        /^\s*import .*(codegenLoader|RwaCodegenService|getAvailableModules)/m.test(source),
        `INV-12: ${file} must not import codegenLoader, RwaCodegenService, or getAvailableModules; catalog is a caller argument`
      ).toBe(false);
    }
  });
});
