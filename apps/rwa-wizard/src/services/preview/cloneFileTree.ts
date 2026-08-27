import type { FileTree } from '@openzeppelin/codegen-core';

/**
 * Deep-copy a FileTree so later generates cannot mutate a step-entry snapshot
 * (SF-6 INV-12). Strings are reused; Uint8Array values are copied.
 */
export function cloneFileTree(files: FileTree): FileTree {
  const copy: FileTree = {};

  for (const [path, value] of Object.entries(files)) {
    if (value instanceof Uint8Array) {
      copy[path] = new Uint8Array(value); // INV-9
    } else {
      copy[path] = value;
    }
  }

  return copy;
}
