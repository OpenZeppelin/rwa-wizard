import { describe, it } from 'vitest';

import { FIELD_HELPERS_COPY } from './field-helpers';
import { assertDictionaryShape } from './test-helpers';

describe('FIELD_HELPERS_COPY', () => {
  it('covers every form field with a helper string', () => {
    assertDictionaryShape(FIELD_HELPERS_COPY, {
      expectedIds: [
        'fieldHelper.token.name',
        'fieldHelper.token.symbol',
        'fieldHelper.token.decimals',
        'fieldHelper.token.initial-supply',
        'fieldHelper.document-manager.enabled',
        'fieldHelper.trusted-issuer.address',
        'fieldHelper.owner-address.single-owner',
        'fieldHelper.owner-address.multi-sig',
        'fieldHelper.owner-address.dao',
      ],
    });
  });
});
