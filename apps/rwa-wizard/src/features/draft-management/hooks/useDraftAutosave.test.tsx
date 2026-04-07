import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { WizardDraftStorageApi } from '../../../storage/wizardDraftStorageContext';
import { createDefaultRwaConfig } from '../../../utils/defaultRwaConfig';
import { useDraftAutosave } from './useDraftAutosave';

function makeConfig(name = ''): RWAConfig {
  const base = createDefaultRwaConfig();
  return { ...base, token: { ...base.token, name } };
}

function createMockStorage(): WizardDraftStorageApi {
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue('new-id'),
    save: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    export: vi.fn().mockResolvedValue('{}'),
    import: vi.fn().mockResolvedValue([]),
  };
}

describe('useDraftAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not persist an empty config (no meaningful content)', async () => {
    const storage = createMockStorage();
    renderHook(() =>
      useDraftAutosave({
        draftId: null,
        config: createDefaultRwaConfig(),
        targetId: 'stellar',
        currentStep: 'asset',
        storage,
      })
    );
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(storage.create).not.toHaveBeenCalled();
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('creates a new draft when meaningful content is entered and no draftId exists', async () => {
    const storage = createMockStorage();
    const { rerender } = renderHook(
      ({ config, draftId }) =>
        useDraftAutosave({
          draftId,
          config,
          targetId: 'stellar',
          currentStep: 'asset',
          storage,
        }),
      {
        initialProps: { config: createDefaultRwaConfig(), draftId: null as string | null },
      }
    );

    rerender({ config: makeConfig('My Token'), draftId: null });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(storage.create).toHaveBeenCalledTimes(1);
  });

  it('saves to an existing draft when draftId is set', async () => {
    const storage = createMockStorage();
    const { rerender } = renderHook(
      ({ config }) =>
        useDraftAutosave({
          draftId: 'existing-id',
          config,
          targetId: 'stellar',
          currentStep: 'asset',
          storage,
        }),
      {
        initialProps: { config: makeConfig('First') },
      }
    );

    rerender({ config: makeConfig('Updated') });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(storage.save).toHaveBeenCalled();
    expect(storage.create).not.toHaveBeenCalled();
  });

  it('debounces rapid changes', async () => {
    const storage = createMockStorage();
    const { rerender } = renderHook(
      ({ config }) =>
        useDraftAutosave({
          draftId: 'id',
          config,
          targetId: 'stellar',
          currentStep: 'asset',
          storage,
        }),
      {
        initialProps: { config: makeConfig('A') },
      }
    );

    rerender({ config: makeConfig('AB') });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    rerender({ config: makeConfig('ABC') });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(storage.save).toHaveBeenCalledTimes(1);
  });
});
