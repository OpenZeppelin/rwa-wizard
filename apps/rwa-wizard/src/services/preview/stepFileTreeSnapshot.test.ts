import { describe, expect, it } from 'vitest';

import type { FileTree } from '@openzeppelin/codegen-core';

import { createStepFileTreeSnapshot } from './stepFileTreeSnapshot';

const GENERATE_KEY = 'hash-a|identity:0|service:svc-1';

describe('createStepFileTreeSnapshot (INV-4, INV-9, INV-17)', () => {
  it('deep-copies files and stores the generate key that produced them', () => {
    const inputFiles = { 'deploy.sh': '#!/bin/sh', 'config.json': '{}' };

    const snapshot = createStepFileTreeSnapshot(inputFiles, GENERATE_KEY);

    expect(snapshot.files).not.toBe(inputFiles);
    expect(snapshot.files).toEqual(inputFiles);
    expect(snapshot.generateKey).toBe(GENERATE_KEY);
  });

  it('keeps snapshot.files stable when the input map is mutated after capture', () => {
    const inputFiles: FileTree = { 'README.md': 'v1' };
    const snapshot = createStepFileTreeSnapshot(inputFiles, GENERATE_KEY);

    inputFiles['README.md'] = 'mutated';
    inputFiles['new.txt'] = 'added';

    expect(snapshot.files).toEqual({ 'README.md': 'v1' });
  });
});
