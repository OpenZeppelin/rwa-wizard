import { afterEach, describe, expect, it, vi } from 'vitest';

import { completeDraft, moduleOption, requiredNumberField } from '../../test/helpers/previewConfig';
import { createDefaultRwaConfig } from '../../utils/defaultRwaConfig';
import { toPreviewConfig } from './index';

describe('toPreviewConfig resource limits (INV-14)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not clone a complete draft', () => {
    const clone = vi.spyOn(globalThis, 'structuredClone');
    toPreviewConfig(completeDraft(), []);
    expect(clone, 'INV-14: idle path allocates zero structuredClone calls').not.toHaveBeenCalled();
  });

  it('clones at most once when several allowlisted fields are missing', () => {
    const clone = vi.spyOn(globalThis, 'structuredClone');
    const draft = createDefaultRwaConfig();
    draft.compliance.modules = [{ moduleId: 'supply-limit', config: {} }];
    toPreviewConfig(draft, [
      moduleOption({
        id: 'supply-limit',
        configFields: [requiredNumberField('limit')],
      }),
    ]);
    expect(
      clone,
      'INV-14: fill path allocates exactly one clone, not one per field'
    ).toHaveBeenCalledTimes(1);
  });

  it('still returns for a long selected-module list', () => {
    const draft = completeDraft();
    draft.compliance.modules = Array.from({ length: 80 }, (_, index) => ({
      moduleId: index === 0 ? 'supply-limit' : `unknown-${index}`,
      config: {},
    }));
    const result = toPreviewConfig(draft, [
      moduleOption({
        id: 'supply-limit',
        configFields: [requiredNumberField('limit')],
      }),
    ]);
    expect(result.substitutedKeys).toEqual(['compliance.modules[0].config.limit']);
    expect(result.config.compliance.modules).toHaveLength(80);
  });
});
