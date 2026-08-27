import { describe, expect, it } from 'vitest';

import { computeConfigHash, type FileTree } from '@openzeppelin/codegen-core';

import { completeDraft } from '../../test/helpers/previewConfig';
import { createStepFileTreeSnapshot } from './stepFileTreeSnapshot';

describe('createStepFileTreeSnapshot (INV-4, INV-9, INV-17)', () => {
  it('deep-copies files and stores computeConfigHash(previewConfig)', () => {
    const inputFiles = { 'deploy.sh': '#!/bin/sh', 'config.json': '{}' };
    const previewConfig = completeDraft();

    const snapshot = createStepFileTreeSnapshot(inputFiles, previewConfig);

    expect(snapshot.files).not.toBe(inputFiles);
    expect(snapshot.files).toEqual(inputFiles);
    expect(snapshot.configHash).toBe(computeConfigHash(previewConfig));
  });

  it('keeps snapshot.files stable when the input map is mutated after capture', () => {
    const inputFiles: FileTree = { 'README.md': 'v1' };
    const snapshot = createStepFileTreeSnapshot(inputFiles, completeDraft());

    inputFiles['README.md'] = 'mutated';
    inputFiles['new.txt'] = 'added';

    expect(snapshot.files).toEqual({ 'README.md': 'v1' });
  });
});
