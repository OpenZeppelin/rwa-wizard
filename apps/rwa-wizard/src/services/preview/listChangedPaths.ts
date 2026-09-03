import type { FileTree } from '@openzeppelin/codegen-core';

import { diffChangedPaths } from './diffChangedPaths';
import type { StepFileTreeSnapshot } from './stepFileTreeSnapshot';

/**
 * Changed paths for the kit FileTree `changedPaths` prop.
 *
 * - `snapshot === null` → `[]` (step not bootstrapped or generate failed on entry).
 * - `currentGenerateKey === snapshot.generateKey` → `[]` without scanning files.
 * - Otherwise → `diffChangedPaths(snapshot.files, current)`.
 *
 * The short-circuit is only sound while the key covers every generate input.
 * Keyed on the config hash alone it also swallowed generate-option changes,
 * which produce a different tree from the same config.
 */
export function listChangedPaths(
  snapshot: StepFileTreeSnapshot | null,
  current: FileTree,
  currentGenerateKey: string
): readonly string[] {
  if (snapshot === null) {
    return []; // INV-5
  }

  if (currentGenerateKey === snapshot.generateKey) {
    return []; // INV-6, INV-13
  }

  return diffChangedPaths(snapshot.files, current); // INV-6
}
