import type { FileTree } from '@openzeppelin/codegen-core';

import { cloneFileTree } from './cloneFileTree';

/**
 * Immutable baseline captured when the user enters a wizard step.
 * `files` is a deep copy — never the live object returned from generateFileTree.
 *
 * `generateKey` identifies *every* input that produced `files`, not just the
 * config: the preview config hash, the generate options, and the codegen
 * service instance. Storing only the config hash made the identical-inputs
 * short-circuit in `listChangedPaths` swallow an identity-support toggle, which
 * changes the tree without changing the config.
 */
export interface StepFileTreeSnapshot {
  readonly files: FileTree;
  readonly generateKey: string;
}

/**
 * Build a step-entry snapshot from a successful generate result.
 * Caller must pass the same generate key it used to produce `files`.
 */
export function createStepFileTreeSnapshot(
  files: FileTree,
  generateKey: string
): StepFileTreeSnapshot {
  return {
    files: cloneFileTree(files), // INV-4, INV-9, INV-13
    generateKey, // INV-4, INV-17
  };
}
