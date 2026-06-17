import { describe, it } from 'vitest';

import { COMPLIANCE_MODULES_COPY } from './compliance-modules';
import { assertDictionaryShape } from './test-helpers';

describe('COMPLIANCE_MODULES_COPY', () => {
  it('covers every catalog module and its configurable field hints', () => {
    assertDictionaryShape(COMPLIANCE_MODULES_COPY, {
      expectedIds: [
        'module.country-allow',
        'moduleField.country-allow.allowedCountries',
        'module.country-restrict',
        'moduleField.country-restrict.restrictedCountries',
        'module.initial-lockup-period',
        'module.max-balance',
        'moduleField.max-balance.maxBalance',
        'module.supply-limit',
        'moduleField.supply-limit.limit',
        'module.time-transfers-limits',
        'moduleField.time-transfers-limits.limitValue',
        'module.transfer-allow',
        'moduleField.transfer-allow.allowedUsers',
      ],
    });
  });
});
