import { describe, expect, it } from 'vitest';

import { OWNERSHIP_MODELS_COPY } from './ownership-models';
import { assertDictionaryShape } from './test-helpers';

describe('OWNERSHIP_MODELS_COPY', () => {
  it('covers the three ownership patterns exposed by the wizard', () => {
    assertDictionaryShape(OWNERSHIP_MODELS_COPY, {
      expectedIds: [
        'ownershipModel.single-owner',
        'ownershipModel.multi-sig',
        'ownershipModel.dao',
      ],
    });
  });

  it('provides a display title for every model', () => {
    for (const entry of Object.values(OWNERSHIP_MODELS_COPY)) {
      expect(entry.title, `missing title for ${entry.id}`).toBeTruthy();
    }
  });
});
