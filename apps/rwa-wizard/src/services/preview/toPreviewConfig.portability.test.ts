import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { completeDraft, moduleOption, requiredNumberField } from '../../test/helpers/previewConfig';
import { createDefaultRwaConfig } from '../../utils/defaultRwaConfig';
import { toPreviewConfig } from './index';

function secondHostPreview(
  draft: ReturnType<typeof createDefaultRwaConfig>,
  catalog: Parameters<typeof toPreviewConfig>[1]
) {
  return toPreviewConfig(draft, catalog);
}

describe('toPreviewConfig portability (INV-16)', () => {
  it('is a synchronous function whose return is not thenable', () => {
    expect(
      typeof toPreviewConfig,
      'INV-16: fill is sync so keystroke preview does not await it'
    ).toBe('function');
    const result = toPreviewConfig(createDefaultRwaConfig(), []);
    expect(
      result && typeof result === 'object' && 'then' in result,
      'INV-16: return must not be a Promise'
    ).toBe(false);
  });

  it('is not a method on RwaCodegenService', () => {
    const typesPath = join(dirname(fileURLToPath(import.meta.url)), '../codegen/types.ts');
    const typesSource = readFileSync(typesPath, 'utf8');
    expect(
      typesSource.includes('toPreviewConfig'),
      'INV-16: wizard policy must stay off RwaCodegenService so the test double does not fake fill'
    ).toBe(false);
  });

  it('embeds in a second host that injects a different catalog without source changes', () => {
    const hostCatalog = [
      moduleOption({
        id: 'max-balance',
        name: 'Max Balance',
        configFields: [requiredNumberField('maxBalance', 'e.g. 50000')],
      }),
    ];
    const draft = completeDraft();
    draft.compliance.modules = [{ moduleId: 'max-balance', config: {} }];

    const result = secondHostPreview(draft, hostCatalog);
    expect(result.substitutedKeys).toEqual(['compliance.modules[0].config.maxBalance']);
    expect(result.config.compliance.modules[0]?.config?.maxBalance).toBe(1);
  });
});
