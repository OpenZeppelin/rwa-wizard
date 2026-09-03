/**
 * Labelled sentinels for preview-only fills. Brackets mark invented values.
 * Lengths stay under Stellar token name (32 bytes) and symbol (12 chars) caps.
 */
export const PREVIEW_TOKEN_NAME = '[preview] Token name' as const;
export const PREVIEW_TOKEN_SYMBOL = '[preview]' as const;
/** Not a Stellar StrKey. Early wizard steps always fill owner; it must look invented. */
export const PREVIEW_OWNER_ADDRESS = '[preview] owner address' as const;
/** Finite number. `0` is a real user value and must not be overwritten. */
export const PREVIEW_NUMBER_VALUE = 1 as const;
export const PREVIEW_STRING_VALUE = '[preview]' as const;
export const PREVIEW_STRING_ARRAY_VALUE = ['[preview]'] as const;

/**
 * INV-5: missing iff undefined, null, whitespace-only string, or empty array.
 * Number `0` and non-finite numbers are present and are not filled.
 */
export function isMissingPreviewValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
}
