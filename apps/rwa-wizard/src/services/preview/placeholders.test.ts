import { describe, expect, it } from 'vitest';

import { STELLAR_VALIDATION_CONSTANTS } from '@openzeppelin/codegen-rwa-stellar';

import { STELLAR_ACCOUNT_STRKEY } from '../../test/helpers/previewConfig';
import {
  isMissingPreviewValue,
  PREVIEW_NUMBER_VALUE,
  PREVIEW_OWNER_ADDRESS,
  PREVIEW_STRING_ARRAY_VALUE,
  PREVIEW_STRING_VALUE,
  PREVIEW_TOKEN_NAME,
  PREVIEW_TOKEN_SYMBOL,
} from './placeholders';

describe('isMissingPreviewValue (INV-5)', () => {
  it('treats empty, whitespace, null, undefined, and [] as missing', () => {
    const missing = ['', '   ', '\t', null, undefined, []] as const;
    for (const value of missing) {
      expect(
        isMissingPreviewValue(value),
        `INV-5: ${JSON.stringify(value)} must count as missing so preview can fill it`
      ).toBe(true);
    }
  });

  it('treats 0, finite numbers, non-empty strings, and non-empty arrays as present', () => {
    const present = [0, 1, -1, 'USD', ' [preview] ', ['US'], ['[preview]']] as const;
    for (const value of present) {
      expect(
        isMissingPreviewValue(value),
        `INV-5: ${JSON.stringify(value)} is present and must not be filled`
      ).toBe(false);
    }
  });

  it('treats NaN and ±Infinity as present-invalid, not missing', () => {
    expect(isMissingPreviewValue(Number.NaN), 'INV-5: NaN must not be overwritten with 1').toBe(
      false
    );
    expect(
      isMissingPreviewValue(Number.POSITIVE_INFINITY),
      'INV-5: Infinity is present-invalid'
    ).toBe(false);
    expect(
      isMissingPreviewValue(Number.NEGATIVE_INFINITY),
      'INV-5: -Infinity is present-invalid'
    ).toBe(false);
  });
});

describe('preview sentinels (INV-7, INV-15)', () => {
  it('keeps token name and symbol under Stellar generator caps', () => {
    const nameBytes = new TextEncoder().encode(PREVIEW_TOKEN_NAME).length;
    expect(
      nameBytes,
      `INV-7: token name sentinel is ${nameBytes} UTF-8 bytes; generate would throw MAX_LENGTH_EXCEEDED at ${STELLAR_VALIDATION_CONSTANTS.TOKEN_NAME_MAX_LENGTH}`
    ).toBeLessThanOrEqual(STELLAR_VALIDATION_CONSTANTS.TOKEN_NAME_MAX_LENGTH);
    expect(
      PREVIEW_TOKEN_SYMBOL.length,
      `INV-7: token symbol sentinel is ${PREVIEW_TOKEN_SYMBOL.length} chars; cap is ${STELLAR_VALIDATION_CONSTANTS.TOKEN_SYMBOL_MAX_LENGTH}`
    ).toBeLessThanOrEqual(STELLAR_VALIDATION_CONSTANTS.TOKEN_SYMBOL_MAX_LENGTH);
  });

  it('uses labelled constants, not descriptor example copy', () => {
    expect(PREVIEW_TOKEN_NAME).toBe('[preview] Token name');
    expect(PREVIEW_TOKEN_SYMBOL).toBe('[preview]');
    expect(PREVIEW_OWNER_ADDRESS).toBe('[preview] owner address');
    expect(PREVIEW_NUMBER_VALUE).toBe(1);
    expect(PREVIEW_STRING_VALUE).toBe('[preview]');
    expect(PREVIEW_STRING_ARRAY_VALUE).toEqual(['[preview]']);
    expect(PREVIEW_TOKEN_NAME.includes('e.g.')).toBe(false);
  });

  it('does not look like a Stellar account StrKey', () => {
    expect(
      STELLAR_ACCOUNT_STRKEY.test(PREVIEW_OWNER_ADDRESS),
      `INV-15: owner sentinel ${PREVIEW_OWNER_ADDRESS} must not match G… StrKey or users will copy it as admin`
    ).toBe(false);
  });
});
