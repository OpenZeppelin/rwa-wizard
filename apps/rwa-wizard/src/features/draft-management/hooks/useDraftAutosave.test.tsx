import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockStorage, makeConfigWithTokenName } from '../../../test/fixtures/wizardFixtures';
import { createDefaultRwaConfig } from '../../../utils/defaultRwaConfig';
import { useDraftAutosave } from './useDraftAutosave';

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

    rerender({ config: makeConfigWithTokenName('My Token'), draftId: null });

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
        initialProps: { config: makeConfigWithTokenName('First') },
      }
    );

    rerender({ config: makeConfigWithTokenName('Updated') });

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
        initialProps: { config: makeConfigWithTokenName('A') },
      }
    );

    rerender({ config: makeConfigWithTokenName('AB') });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    rerender({ config: makeConfigWithTokenName('ABC') });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(storage.save).toHaveBeenCalledTimes(1);
  });

  it('reschedules a save when new edits land during an in-flight save', async () => {
    // Regression: the hook previously returned early when a save was already in
    // flight, dropping any edits made during that window. We now mark the
    // write as pending and flush it as soon as the active save resolves.
    let resolveFirstSave: () => void = () => undefined;
    const storage = createMockStorage();
    (storage.save as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveFirstSave = resolve;
        })
    );

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
        initialProps: { config: makeConfigWithTokenName('First') },
      }
    );

    rerender({ config: makeConfigWithTokenName('Second') });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(storage.save).toHaveBeenCalledTimes(1);

    // Edit again while the first save is still pending.
    rerender({ config: makeConfigWithTokenName('Third') });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    // Still only one save — the new debounce fires while the first is in flight
    // and is captured via the pending flag.
    expect(storage.save).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstSave();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(storage.save).toHaveBeenCalledTimes(2);
    const calls = (storage.save as ReturnType<typeof vi.fn>).mock.calls;
    const lastCallArgs = calls[calls.length - 1];
    expect(lastCallArgs?.[1]?.config?.token?.name).toBe('Third');
  });

  it('invokes onPersistError when create() rejects', async () => {
    const storage = createMockStorage();
    (storage.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('quota exceeded'));
    const onPersistError = vi.fn();
    const { rerender } = renderHook(
      ({ config, draftId }) =>
        useDraftAutosave({
          draftId,
          config,
          targetId: 'stellar',
          currentStep: 'asset',
          storage,
          onPersistError,
        }),
      {
        initialProps: { config: createDefaultRwaConfig(), draftId: null as string | null },
      }
    );

    rerender({ config: makeConfigWithTokenName('Named'), draftId: null });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(onPersistError).toHaveBeenCalledWith('create', expect.any(Error));
  });

  it('routes rapid edits after first-create through save() instead of a second create()', async () => {
    // Regression: a keystroke landing while `create()` is in flight used to
    // leave `latestRef.draftId` as null until the parent re-rendered with the
    // newly-created id. The follow-up persist pass then fired a second
    // `create()`, producing a duplicate draft. The hook now adopts the new id
    // locally the moment `create()` resolves.
    let resolveCreate: (id: string) => void = () => undefined;
    const storage = createMockStorage();
    (storage.create as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveCreate = resolve;
        })
    );

    const onDraftCreated = vi.fn();

    const { rerender } = renderHook(
      ({ config, draftId }) =>
        useDraftAutosave({
          draftId,
          config,
          targetId: 'stellar',
          currentStep: 'asset',
          storage,
          onDraftCreated,
        }),
      {
        initialProps: { config: createDefaultRwaConfig(), draftId: null as string | null },
      }
    );

    // First meaningful edit → triggers create().
    rerender({ config: makeConfigWithTokenName('First'), draftId: null });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(storage.create).toHaveBeenCalledTimes(1);

    // Second edit lands while create() is still pending. Without the inline
    // id adoption, the saving-pending → saving transition would read
    // `latestRef.draftId === null` and fire another create().
    rerender({ config: makeConfigWithTokenName('FirstAndMore'), draftId: null });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Resolve the original create with a new id and let the machine flush
    // the pending edit. We *don't* re-render the parent with the new draftId
    // to simulate a parent whose re-render lags the hook's follow-up pass.
    await act(async () => {
      resolveCreate('new-id-1');
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(storage.create).toHaveBeenCalledTimes(1);
    expect(storage.save).toHaveBeenCalledTimes(1);
    const saveCalls = (storage.save as ReturnType<typeof vi.fn>).mock.calls;
    expect(saveCalls[0]?.[0]).toBe('new-id-1');
  });

  it('invokes onPersistSuccess after a successful save', async () => {
    const storage = createMockStorage();
    const onPersistSuccess = vi.fn();
    const { rerender } = renderHook(
      ({ config }) =>
        useDraftAutosave({
          draftId: 'existing-id',
          config,
          targetId: 'stellar',
          currentStep: 'asset',
          storage,
          onPersistSuccess,
        }),
      {
        initialProps: { config: makeConfigWithTokenName('First') },
      }
    );

    rerender({ config: makeConfigWithTokenName('Second') });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(onPersistSuccess).toHaveBeenCalledTimes(1);
  });
});
