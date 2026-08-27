import type { FileTree } from '@openzeppelin/codegen-core';

import { fileContentsEqual } from './fileContentsEqual';

/**
 * Paths in `current` whose contents differ from `baseline`.
 *
 * - Path only in `current` → included (file added since snapshot).
 * - Path in both with equal contents → excluded.
 * - Path only in `baseline` → excluded (removed files are absent from the live tree).
 */
export function diffChangedPaths(baseline: FileTree, current: FileTree): readonly string[] {
  const changed: string[] = [];

  for (const path of Object.keys(current)) {
    const currentValue = current[path];
    const baselineValue = baseline[path];

    if (baselineValue === undefined || !fileContentsEqual(baselineValue, currentValue)) {
      changed.push(path); // INV-1, INV-2
    }
  }

  changed.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)); // INV-3

  return changed;
}
