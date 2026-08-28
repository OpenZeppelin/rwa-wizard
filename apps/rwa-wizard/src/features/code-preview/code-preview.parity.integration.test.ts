import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { computeConfigHash } from '@openzeppelin/codegen-core';

import type { UseCodePreviewOptions } from './hooks/useCodePreview';
import { useCodePreview } from './hooks/useCodePreview';

import { loadCodegenService } from '../../services/codegen/codegenLoader';
import { toPreviewConfig } from '../../services/preview';
import {
  defaultPreviewHookOptions,
  waitForPreviewReady,
} from '../../test/helpers/codePreviewHarness';
import { fileContentsEqual, sortedKeys } from '../../test/helpers/fileTreeParity';
import { stellarPreviewCatalog } from '../../test/helpers/previewConfig';
import { createDefaultRwaConfig } from '../../utils/defaultRwaConfig';

describe('useCodePreview download parity wiring (INV-1)', () => {
  it('matches generateFileTree output for preview config with identity off', async () => {
    const service = await loadCodegenService('stellar');
    expect(service).not.toBeNull();

    const stableDraft = createDefaultRwaConfig();
    const base = defaultPreviewHookOptions({
      codegenService: service,
      draftConfig: stableDraft,
      includeIdentitySupport: false,
      debounceMs: 0,
    });

    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });

    const ready = await waitForPreviewReady(() => result.current);
    const previewInput = toPreviewConfig(createDefaultRwaConfig(), stellarPreviewCatalog());
    const direct = await service!.generateFileTree(previewInput.config, {
      includeIdentitySupport: false,
    });

    expect(sortedKeys(ready.files)).toEqual(sortedKeys(direct.files));
    for (const path of sortedKeys(ready.files)) {
      expect(
        fileContentsEqual(ready.files[path]!, direct.files[path]!),
        `INV-1: preview/download content mismatch at ${path}`
      ).toBe(true);
    }
    expect(computeConfigHash(previewInput.config)).toBe(ready.configHash);
  });

  it('forwards includeIdentitySupport to generateFileTree when identity is on', async () => {
    const service = await loadCodegenService('stellar');
    expect(service).not.toBeNull();

    const base = defaultPreviewHookOptions({
      codegenService: service,
      draftConfig: createDefaultRwaConfig(),
      includeIdentitySupport: true,
      debounceMs: 0,
    });

    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });

    await waitForPreviewReady(() => result.current);
    const previewInput = toPreviewConfig(createDefaultRwaConfig(), stellarPreviewCatalog());
    const direct = await service!.generateFileTree(previewInput.config, {
      includeIdentitySupport: true,
    });

    if (result.current.phase.kind !== 'ready') {
      throw new Error('expected ready phase');
    }

    expect(sortedKeys(result.current.phase.files)).toEqual(sortedKeys(direct.files));
  });
});
