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
        'notice.compliance.selection-warning.initial-supply-exceeds-supply-limit',
        'notice.compliance.selection-warning.initial-supply-exceeds-max-balance',
        'notice.compliance.selection-warning.demo-mint-country-not-allowed',
        'notice.compliance.selection-warning.demo-mint-country-restricted',
        'notice.compliance.selection-warning.initial-supply-compliance-reminder',
        'notice.trusted-issuer.no-topics',
        'notice.trusted-issuer.duplicate',
        'notice.review.before-deploy',
        'notice.review.configured-admin',
        'notice.review.demo-mint-compliance-blocked',
        'notice.code-preview.trigger-show',
        'notice.code-preview.trigger-hide',
        'notice.code-preview.sheet-label',
        'notice.code-preview.generating',
        'notice.code-preview.no-file-selected',
        'notice.code-preview.substitutions',
        'notice.code-preview.render-failed',
        'notice.code-preview.generate-failed',
        'notice.code-preview.tools-group',
        'notice.code-preview.hide-file-tree',
        'notice.code-preview.show-file-tree',
        'notice.code-preview.maximize',
        'notice.code-preview.restore-size',
        'notice.code-preview.file-tree-label',
        'notice.code-preview.source-label',
        'notice.code-preview.close',
      ],
    });
  });
});
