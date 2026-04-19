import { describe, it } from 'vitest';

import { NOTICES_COPY } from './notices';
import { assertDictionaryShape } from './test-helpers';

describe('NOTICES_COPY', () => {
  it('covers every standalone prose block in the wizard shell', () => {
    assertDictionaryShape(NOTICES_COPY, {
      expectedIds: [
        'notice.identity.privacy',
        'notice.compliance.hook-wiring-preview',
        'notice.compliance.module-catalog.empty',
        'notice.compliance.module-catalog.under-review-label',
        'notice.trusted-issuer.no-topics',
        'notice.trusted-issuer.duplicate',
        'notice.trusted-issuer.invalid-address',
        'notice.dashboard.intro',
        'notice.dashboard.sub-intro',
      ],
    });
  });
});
