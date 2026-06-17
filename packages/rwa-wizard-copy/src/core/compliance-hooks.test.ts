import { describe, it } from 'vitest';

import { COMPLIANCE_HOOKS_COPY } from './compliance-hooks';
import { assertDictionaryShape } from './test-helpers';

describe('COMPLIANCE_HOOKS_COPY', () => {
  it('covers the post-operation compliance hooks', () => {
    assertDictionaryShape(COMPLIANCE_HOOKS_COPY, {
      expectedIds: ['hook.transferred', 'hook.created', 'hook.destroyed'],
      requireInfoCopy: true,
    });
  });
});
