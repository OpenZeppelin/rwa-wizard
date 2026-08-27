import { computeConfigHash, type FileTree } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { cloneFileTree } from './cloneFileTree';

/**
 * Immutable baseline captured when the user enters a wizard step.
 * `files` is a deep copy — never the live object returned from generateFileTree.
 * `configHash` is `computeConfigHash(previewConfig)` for the same preview config
 * that produced `files` (after SF-5 `toPreviewConfig`, before generate).
 */
export interface StepFileTreeSnapshot {
  readonly files: FileTree;
  readonly configHash: string;
}

/**
 * Build a step-entry snapshot from a successful generate result.
 * Caller must pass the preview config that was used for this generate.
 */
export function createStepFileTreeSnapshot(
  files: FileTree,
  previewConfig: RWAConfig
): StepFileTreeSnapshot {
  return {
    files: cloneFileTree(files), // INV-4, INV-9, INV-13
    configHash: computeConfigHash(previewConfig), // INV-4, INV-17
  };
}
