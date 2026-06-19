import { describe, it } from 'vitest';

import { NOTICES_COPY } from './notices';
import { assertDictionaryShape } from './test-helpers';

describe('NOTICES_COPY', () => {
  it('covers every standalone prose block in the wizard shell', () => {
    assertDictionaryShape(NOTICES_COPY, {
      expectedIds: [
        'notice.identity.privacy',
        'notice.compliance.hook-wiring-preview',
        'notice.compliance.hook-wiring-preview.empty-hook',
        'notice.compliance.module-catalog.empty',
        'notice.compliance.module-catalog.under-review-label',
        'notice.compliance.module-category.supply-and-balance',
        'notice.compliance.module-category.jurisdiction',
        'notice.compliance.module-category.access-and-velocity',
        'notice.compliance.module-prerequisite.identity-registry',
        'notice.compliance.selection-warning.country-allow-and-restrict',
        'notice.compliance.selection-warning.transfer-allow-empty-list',
        'notice.compliance.selection-warning.initial-supply-requires-manual-mint',
        'notice.trusted-issuer.no-topics',
        'notice.trusted-issuer.duplicate',
        'notice.review.before-deploy',
        'notice.review.configured-admin',
      ],
    });
  });
});
