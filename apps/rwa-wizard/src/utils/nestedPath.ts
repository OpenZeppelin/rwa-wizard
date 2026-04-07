/**
 * Reads a value from a nested object given a dot-separated path.
 *
 * @example getNestedValue({ a: { b: 1 } }, 'a.b') // => 1
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc != null && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

/**
 * Builds a partial object from a dot-separated path and a value,
 * suitable for shallow-merging into the parent state.
 *
 * @example setNestedValue('a.b', 1) // => { a: { b: 1 } }
 */
export function setNestedValue<T extends Record<string, unknown>>(
  path: string,
  value: unknown
): Partial<T> {
  const keys = path.split('.');
  if (keys.length === 1) return { [keys[0]]: value } as Partial<T>;

  const result: Record<string, unknown> = {};
  let current = result;
  for (let i = 0; i < keys.length - 1; i++) {
    current[keys[i]] = {};
    current = current[keys[i]] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
  return result as Partial<T>;
}
