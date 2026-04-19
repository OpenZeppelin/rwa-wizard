/**
 * Shared helpers for normalizing thrown values into something safe to
 * display or log. JavaScript allows throwing any value (not just `Error`),
 * so every `catch (err: unknown)` site otherwise has to repeat the same
 * instanceof dance. Centralising the logic:
 *
 * - guarantees a consistent fallback message across the UI,
 * - gives us a single seam to add telemetry (Sentry, Datadog) later, and
 * - makes the code far easier to read at the call site.
 */

/**
 * Normalize any caught value to an `Error`. Preserves the original when
 * possible so stack traces and subclass information survive; otherwise
 * wraps the stringified value.
 */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string') return new Error(value);
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

/**
 * Extract a user-friendly message from any caught value. Empty strings are
 * replaced by the supplied fallback so we never render a blank banner.
 */
export function getErrorMessage(
  value: unknown,
  fallback = 'An unexpected error occurred.'
): string {
  if (value instanceof Error) {
    return value.message.trim() !== '' ? value.message : fallback;
  }
  if (typeof value === 'string') {
    return value.trim() !== '' ? value : fallback;
  }
  if (value == null) return fallback;
  const serialized = String(value);
  return serialized.trim() !== '' ? serialized : fallback;
}
