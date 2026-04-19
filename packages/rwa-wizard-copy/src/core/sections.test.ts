import { describe, expect, it } from 'vitest';

import { SECTIONS_COPY } from './sections';
import { assertDictionaryShape } from './test-helpers';

describe('SECTIONS_COPY', () => {
  it('covers every section card in the wizard', () => {
    assertDictionaryShape(SECTIONS_COPY, {
      expectedIds: [
        'section.token-information',
        'section.administrative-controls',
        'section.document-manager',
        'section.implementation-approach',
        'section.claim-topics',
        'section.trusted-issuers',
        'section.identity-controls',
        'section.ownership-model',
        'section.operator-roles',
      ],
      requireDescription: false,
      requireInfoCopy: true,
    });
  });

  it('provides a title and a tooltip infoCopy for every section', () => {
    for (const entry of Object.values(SECTIONS_COPY)) {
      expect(entry.title, `missing title for ${entry.id}`).toBeTruthy();
      expect(entry.infoCopy, `missing infoCopy for ${entry.id}`).toBeTruthy();
    }
  });
});
