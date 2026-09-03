import { describe, expect, it } from 'vitest';

import { STELLAR_ACCOUNT_STRKEY, supplyLimitCatalog } from '../../test/helpers/previewConfig';
import { createDefaultRwaConfig } from '../../utils/defaultRwaConfig';
import { PREVIEW_OWNER_ADDRESS, PREVIEW_TOKEN_NAME, toPreviewConfig } from './index';

describe('toPreviewConfig sensitive data (INV-15)', () => {
  it('invents a labelled owner that fails StrKey, and lists paths not sentinel values', () => {
    const result = toPreviewConfig(createDefaultRwaConfig(), supplyLimitCatalog);
    const ownership = result.config.accessControl.ownership;
    const owner = ownership.type === 'single-owner' ? ownership.ownerAddress : '';

    expect(owner).toBe(PREVIEW_OWNER_ADDRESS);
    expect(STELLAR_ACCOUNT_STRKEY.test(owner), 'INV-15: filled owner must look invented').toBe(
      false
    );
    expect(result.substitutedKeys).not.toContain(PREVIEW_OWNER_ADDRESS);
    expect(result.substitutedKeys).not.toContain(PREVIEW_TOKEN_NAME);
    expect(result.substitutedKeys.every((key) => key.includes('.'))).toBe(true);
  });
});
