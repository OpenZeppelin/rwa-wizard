/**
 * Recursively sort object keys so JSON serialization remains deterministic.
 */
export function sortObjectKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortObjectKeys);

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    sorted[key] = sortObjectKeys((value as Record<string, unknown>)[key]);
  }

  return sorted;
}

/**
 * Serialize a value into stable JSON by sorting all nested object keys.
 */
export function stableJsonStringify(value: unknown): string {
  return JSON.stringify(sortObjectKeys(value));
}

/**
 * Compute a deterministic hash string for generation metadata.
 *
 * The hash is intentionally lightweight and runtime-agnostic so it can run in
 * both browser and Node contexts without extra dependencies.
 */
export function computeConfigHash(value: unknown): string {
  return hashString(stableJsonStringify(value));
}

/**
 * Hash a string into a stable hexadecimal digest.
 */
export function hashString(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index++) {
    const charCode = value.charCodeAt(index);
    hash = (hash << 5) - hash + charCode;
    hash |= 0;
  }

  return Math.abs(hash).toString(16).padStart(8, '0');
}
