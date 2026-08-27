import '../code-preview.mocks';

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import { createTestCodegenService } from '../../../services/codegen';
import type { RwaCodegenService } from '../../../services/codegen/types';
import {
  defaultPreviewHookOptions,
  flushPreviewDebounce,
  waitForPreviewReady,
} from '../../../test/helpers/codePreviewHarness';
import { completeDraft, stellarPreviewCatalog } from '../../../test/helpers/previewConfig';
import { createDefaultRwaConfig } from '../../../utils/defaultRwaConfig';
import type { UseCodePreviewOptions } from './useCodePreview';
import { useCodePreview } from './useCodePreview';

describe('useCodePreview (INV-4, INV-6, INV-7, INV-14, INV-18)', () => {
  it('hides trigger and closes drawer when codegenService is null (INV-4)', async () => {
    const service = createTestCodegenService();
    const stableDraft = createDefaultRwaConfig();
    const base = defaultPreviewHookOptions({ codegenService: service, draftConfig: stableDraft });

    const { result, rerender } = renderHook(
      (props: UseCodePreviewOptions) => useCodePreview(props),
      { initialProps: base }
    );

    await waitForPreviewReady(() => result.current);

    act(() => {
      result.current.setOpen(true);
    });
    expect(result.current.persistence.open).toBe(true);

    rerender({ ...base, codegenService: null });

    await waitFor(() => {
      expect(result.current.showTrigger).toBe(false);
      expect(result.current.persistence.open).toBe(false);
      expect(result.current.phase.kind).toBe('idle');
    });
  });

  it('calls generateFileTree with shimmed preview config on step entry (INV-6)', async () => {
    const service = createTestCodegenService();
    const generateSpy = vi.spyOn(service, 'generateFileTree');
    const base = defaultPreviewHookOptions({ codegenService: service });

    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });

    await waitForPreviewReady(() => result.current);

    expect(generateSpy).toHaveBeenCalled();
    const lastCall = generateSpy.mock.calls[generateSpy.mock.calls.length - 1];
    const [config, options] = lastCall!;
    expect(options).toEqual({ includeIdentitySupport: false });
    expect(config.token.name).not.toBe('');
  });

  it('clears change marks when currentStepId changes (INV-7)', async () => {
    const service = createTestCodegenService();
    const base = defaultPreviewHookOptions({
      codegenService: service,
      draftConfig: createDefaultRwaConfig(),
      currentStepId: 'asset',
    });

    const { result, rerender } = renderHook(
      (props: UseCodePreviewOptions) => useCodePreview(props),
      { initialProps: base }
    );

    await waitForPreviewReady(() => result.current);

    rerender({ ...base, currentStepId: 'identity' });
    await waitForPreviewReady(() => result.current);

    expect(
      result.current.phase.kind === 'ready' && result.current.phase.changedPaths,
      'INV-7: marks reset on step change until this step is edited'
    ).toEqual([]);
  });

  it('accumulates change marks when draftConfig changes without step change (INV-7)', async () => {
    const service = createTestCodegenService();
    const initialDraft = completeDraft();
    const base = defaultPreviewHookOptions({
      codegenService: service,
      draftConfig: initialDraft,
      currentStepId: 'asset',
    });

    const { result, rerender } = renderHook(
      (props: UseCodePreviewOptions) => useCodePreview(props),
      { initialProps: base }
    );

    await waitForPreviewReady(() => result.current);
    expect(result.current.phase.kind === 'ready' && result.current.phase.changedPaths).toEqual([]);

    rerender({
      ...base,
      draftConfig: {
        ...initialDraft,
        token: { ...initialDraft.token, name: 'Renamed Token' },
      },
    });
    await flushPreviewDebounce();
    const ready = await waitForPreviewReady(() => result.current);

    expect(ready.changedPaths.length).toBeGreaterThan(0);
    expect(ready.changedPaths).toContain('README.md');
  });

  it('maps CodegenInvalidConfigError to phase.error without throwing (INV-18)', async () => {
    const service = createTestCodegenService({ failGenerateFileTree: true });
    const base = defaultPreviewHookOptions({ codegenService: service });

    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });

    await waitFor(() => {
      expect(result.current.phase.kind).toBe('error');
    });

    if (result.current.phase.kind === 'error') {
      expect(result.current.phase.messages.join(' ')).toMatch(/Invalid configuration/i);
      expect(result.current.phase.substitutedKeys).toEqual([
        'token.name',
        'token.symbol',
        'accessControl.ownership.ownerAddress',
      ]);
    }
  });

  it('omits aria-controls when the drawer is closed (INV-14)', async () => {
    const base = defaultPreviewHookOptions({ codegenService: createTestCodegenService() });
    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });

    await waitForPreviewReady(() => result.current);
    expect(result.current.triggerProps['aria-controls']).toBeUndefined();

    act(() => {
      result.current.setOpen(true);
    });

    expect(result.current.triggerProps['aria-controls']).toBe(result.current.sheetId);
  });

  it('regenerates when only includeIdentitySupport changes (INV-1 cache key)', async () => {
    // The cache key must cover every generate input, not just the config hash.
    // This test varies ONLY the identity flag; the tree must change with it.
    const base = createTestCodegenService();
    const generateSpy = vi.fn(
      async (config: RWAConfig, options?: { includeIdentitySupport?: boolean }) => {
        const artifact = await base.generateFileTree(config);
        return options?.includeIdentitySupport
          ? { files: { ...artifact.files, 'identity/README.md': '# identity' } }
          : artifact;
      }
    );
    const service: RwaCodegenService = { ...base, generateFileTree: generateSpy };
    const draft = completeDraft();
    const options = defaultPreviewHookOptions({
      codegenService: service,
      draftConfig: draft,
      includeIdentitySupport: false,
    });

    const { result, rerender } = renderHook(
      (props: UseCodePreviewOptions) => useCodePreview(props),
      { initialProps: options }
    );

    const before = await waitForPreviewReady(() => result.current);
    expect(Object.keys(before.files)).not.toContain('identity/README.md');

    rerender({ ...options, includeIdentitySupport: true });
    await flushPreviewDebounce();

    await waitFor(() => {
      expect(result.current.phase.kind === 'ready' && result.current.phase.files).toHaveProperty(
        'identity/README.md'
      );
    });
    expect(generateSpy).toHaveBeenLastCalledWith(expect.anything(), {
      includeIdentitySupport: true,
    });
  });

  it('maximize uses the viewport height, keeps the stored height, and restores it', async () => {
    const base = defaultPreviewHookOptions({ codegenService: createTestCodegenService() });
    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });
    await waitForPreviewReady(() => result.current);

    act(() => {
      result.current.setHeight(420);
    });
    expect(result.current.persistence.height).toBe(420);
    expect(result.current.layout.maximized).toBe(false);

    act(() => {
      result.current.layout.onToggleMaximize();
    });
    expect(result.current.layout.maximized).toBe(true);
    expect(result.current.persistence.height).toBe(window.innerHeight);

    // A clamp report equal to the viewport keeps maximize.
    act(() => {
      result.current.setHeight(window.innerHeight);
    });
    expect(result.current.layout.maximized).toBe(true);

    act(() => {
      result.current.layout.onToggleMaximize();
    });
    expect(result.current.layout.maximized).toBe(false);
    expect(result.current.persistence.height).toBe(420);
  });

  it('a drag below the viewport exits maximize and stores the dragged height', async () => {
    const base = defaultPreviewHookOptions({ codegenService: createTestCodegenService() });
    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });
    await waitForPreviewReady(() => result.current);

    act(() => {
      result.current.layout.onToggleMaximize();
    });
    act(() => {
      result.current.setHeight(300);
    });
    expect(result.current.layout.maximized).toBe(false);
    expect(result.current.persistence.height).toBe(300);
  });

  it('tree visibility toggles and persists', async () => {
    localStorage.removeItem('rwa-wizard:code-preview:tree');
    const base = defaultPreviewHookOptions({ codegenService: createTestCodegenService() });
    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });
    await waitForPreviewReady(() => result.current);

    expect(result.current.layout.treeVisible).toBe(true);
    act(() => {
      result.current.layout.onToggleTree();
    });
    expect(result.current.layout.treeVisible).toBe(false);
    expect(localStorage.getItem('rwa-wizard:code-preview:tree')).toBe('false');
    localStorage.removeItem('rwa-wizard:code-preview:tree');
  });

  it('shows no substitutions for a complete draft (INV-2 hook path)', async () => {
    const base = defaultPreviewHookOptions({
      draftConfig: completeDraft(),
      moduleCatalog: stellarPreviewCatalog() as unknown as UseCodePreviewOptions['moduleCatalog'],
    });
    const { result } = renderHook((props: UseCodePreviewOptions) => useCodePreview(props), {
      initialProps: base,
    });

    await waitForPreviewReady(() => result.current);
    if (result.current.phase.kind === 'ready') {
      expect(result.current.phase.substitutedKeys).toEqual([]);
    }
  });
});
