/**
 * Content equality for one FileTree entry. Both strings → `===`. Both
 * Uint8Array → same length and byte at every index. Mixed or missing → false.
 */
export function fileContentsEqual(
  left: string | Uint8Array | undefined,
  right: string | Uint8Array | undefined
): boolean {
  if (left === undefined || right === undefined) {
    return false; // INV-7
  }

  if (typeof left === 'string' && typeof right === 'string') {
    return left === right; // INV-7
  }

  if (left instanceof Uint8Array && right instanceof Uint8Array) {
    if (left.length !== right.length) {
      return false; // INV-7
    }

    for (let index = 0; index < left.length; index++) {
      if (left[index] !== right[index]) {
        return false; // INV-7
      }
    }

    return true;
  }

  return false; // INV-7: mixed types
}
