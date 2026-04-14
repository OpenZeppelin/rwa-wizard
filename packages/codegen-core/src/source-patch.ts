/**
 * Replace an exact source snippet, failing fast if the snippet is absent.
 */
export function replaceExact(source: string, search: string, replacement: string): string {
  if (!source.includes(search)) {
    throw new Error(`Expected source snippet was not found: ${search}`);
  }

  return source.replace(search, replacement);
}

/**
 * Insert text immediately before an exact marker.
 */
export function insertBeforeExact(source: string, marker: string, insertion: string): string {
  return replaceExact(source, marker, `${insertion}${marker}`);
}

/**
 * Insert text immediately after an exact marker.
 */
export function insertAfterExact(source: string, marker: string, insertion: string): string {
  return replaceExact(source, marker, `${marker}${insertion}`);
}
