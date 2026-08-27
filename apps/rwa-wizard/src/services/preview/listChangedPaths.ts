import type { FileTree } from '@openzeppelin/codegen-core';

import { diffChangedPaths } from './diffChangedPaths';
import type { StepFileTreeSnapshot } from './stepFileTreeSnapshot';

/**
 * Changed paths for the kit FileTree `changedPaths` prop.
 *
 * - `snapshot === null` → `[]` (step not bootstrapped or generate failed on entry).
 * - `currentConfigHash === snapshot.configHash` → `[]` without scanning files.
 * - Otherwise → `diffChangedPaths(snapshot.files, current)`.
 */
export function listChangedPaths(
  snapshot: StepFileTreeSnapshot | null,
  current: FileTree,
  currentConfigHash: string
): readonly string[] {
  if (snapshot === null) {
    return []; // INV-5
  }

  if (currentConfigHash === snapshot.configHash) {
    return []; // INV-6, INV-13
  }

  return diffChangedPaths(snapshot.files, current); // INV-6
}
