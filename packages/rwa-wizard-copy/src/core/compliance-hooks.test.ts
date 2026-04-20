import { describe, it } from 'vitest';

import { COMPLIANCE_HOOKS_COPY } from './compliance-hooks';
import { assertDictionaryShape } from './test-helpers';

describe('COMPLIANCE_HOOKS_COPY', () => {
  it('covers the five T-REX compliance hooks', () => {
    assertDictionaryShape(COMPLIANCE_HOOKS_COPY, {
      expectedIds: [
        'hook.canTransfer',
        'hook.canCreate',
        'hook.transferred',
        'hook.created',
        'hook.destroyed',
      ],
      requireInfoCopy: true,
    });
  });
});
