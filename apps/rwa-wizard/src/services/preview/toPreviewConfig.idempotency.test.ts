import { describe, expect, it } from 'vitest';

import { supplyLimitCatalog } from '../../test/helpers/previewConfig';
import { createDefaultRwaConfig } from '../../utils/defaultRwaConfig';
import { toPreviewConfig } from './index';

describe('toPreviewConfig idempotency (INV-11)', () => {
  it('produces deep-equal configs and the same substitutedKeys for two fills of the same snapshot', () => {
    const a = createDefaultRwaConfig();
    a.compliance.modules = [{ moduleId: 'supply-limit', config: {} }];
    const b = structuredClone(a);

    const first = toPreviewConfig(a, supplyLimitCatalog);
    const second = toPreviewConfig(b, supplyLimitCatalog);

    expect(first.substitutedKeys, 'INV-11: same snapshot must list the same filled paths').toEqual(
      second.substitutedKeys
    );
    expect(first.config, 'INV-11: fill clones may differ by reference').not.toBe(second.config);
    expect(first.config).toEqual(second.config);
  });

  it('treats a second pass on the filled clone as idle (INV-11, INV-3)', () => {
    const first = toPreviewConfig(createDefaultRwaConfig(), supplyLimitCatalog);
    const second = toPreviewConfig(first.config, supplyLimitCatalog);

    expect(
      second.substitutedKeys,
      'INV-11: sentinels are present; second pass must not append keys'
    ).toEqual([]);
    expect(second.config, 'INV-11: second pass must keep the filled clone identity').toBe(
      first.config
    );
  });
});
