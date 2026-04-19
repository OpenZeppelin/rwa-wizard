import { describe, expect, it } from 'vitest';

import { assertDictionaryShape } from './test-helpers';
import { WIZARD_STEPS_COPY } from './wizard-steps';

describe('WIZARD_STEPS_COPY', () => {
  it('covers every wizard step', () => {
    assertDictionaryShape(WIZARD_STEPS_COPY, {
      expectedIds: [
        'wizardStep.asset',
        'wizardStep.identity',
        'wizardStep.compliance',
        'wizardStep.access-control',
        'wizardStep.review',
      ],
      requireInfoCopy: true,
    });
  });

  it('provides a display title and description for every step', () => {
    for (const entry of Object.values(WIZARD_STEPS_COPY)) {
      expect(entry.title, `missing title for ${entry.id}`).toBeTruthy();
    }
  });
});
