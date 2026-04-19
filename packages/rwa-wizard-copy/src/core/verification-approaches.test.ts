import { describe, it } from 'vitest';

import { assertDictionaryShape } from './test-helpers';
import { VERIFICATION_APPROACHES_COPY } from './verification-approaches';

describe('VERIFICATION_APPROACHES_COPY', () => {
  it('covers the default claim-based verification approach', () => {
    assertDictionaryShape(VERIFICATION_APPROACHES_COPY, {
      expectedIds: ['verificationApproach.claim-based'],
    });
  });
});
