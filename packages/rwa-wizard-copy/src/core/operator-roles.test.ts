import { describe, it } from 'vitest';

import { OPERATOR_ROLES_COPY } from './operator-roles';
import { assertDictionaryShape } from './test-helpers';

describe('OPERATOR_ROLES_COPY', () => {
  it('covers every predefined T-REX operator role', () => {
    assertDictionaryShape(OPERATOR_ROLES_COPY, {
      expectedIds: [
        'role.minter',
        'role.burner',
        'role.freezer',
        'role.partial-freezer',
        'role.forced-transfer',
        'role.recovery',
        'role.pauser',
        'role.compliance',
        'role.identity',
        'role.document-manager',
      ],
      requireInfoCopy: true,
    });
  });
});
