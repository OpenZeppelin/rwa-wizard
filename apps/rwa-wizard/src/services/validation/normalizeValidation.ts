export interface ValidationErrorLike {
  field: string;
  code: string;
  message: string;
}

/**
 * Normalizes validation result field paths for UI binding.
 * Ensures dot-notation (e.g. "token.symbol") and trims whitespace.
 */
export function normalizeFieldPath(path: string): string {
  return path.replace(/\s+/g, '').trim();
}

/**
 * Normalizes an array of validation errors so field paths are consistent.
 */
export function normalizeValidationErrors<T extends ValidationErrorLike>(errors: T[]): T[] {
  return errors.map((e) => ({
    ...e,
    field: normalizeFieldPath(e.field),
  }));
}

export function normalizeValidationWarnings<T extends ValidationErrorLike>(warnings: T[]): T[] {
  return warnings.map((w) => ({
    ...w,
    field: normalizeFieldPath(w.field),
  }));
}
