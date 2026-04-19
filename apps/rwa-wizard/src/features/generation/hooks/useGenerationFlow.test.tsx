import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestCodegenService } from '../../../services/codegen';
import type { RwaCodegenService } from '../../../services/codegen/types';
import { makeConfig, validConfig } from '../../../test/fixtures/wizardFixtures';
import { useGenerationFlow } from './useGenerationFlow';

describe('useGenerationFlow', () => {
  let testService: RwaCodegenService;

  beforeEach(() => {
    testService = createTestCodegenService();
  });

  it('starts in idle phase', () => {
    const { result } = renderHook(() =>
      useGenerationFlow({ draftId: 'draft-1', config: validConfig(), codegenService: testService })
    );

    expect(result.current.jobState.phase).toBe('idle');
    expect(result.current.isGenerating).toBe(false);
  });

  it('transitions through phases on successful generation', async () => {
    const { result } = renderHook(() =>
      useGenerationFlow({ draftId: 'draft-1', config: validConfig(), codegenService: testService })
    );

    await act(async () => {
      await result.current.generate();
    });

    await waitFor(() => {
      expect(result.current.jobState.phase).toBe('success');
    });

    expect(result.current.jobState.zipFileName).toBeTruthy();
    expect(result.current.isGenerating).toBe(false);
  });

  it('captures validation errors and transitions to error phase', async () => {
    const failingService: RwaCodegenService = {
      ...testService,
      async validate() {
        return {
          valid: false,
          errors: [{ field: 'token.name', code: 'required', message: 'Token name is required' }],
          warnings: [],
        };
      },
    };

    const { result } = renderHook(() =>
      useGenerationFlow({
        draftId: 'draft-1',
        config: makeConfig(),
        codegenService: failingService,
      })
    );

    await act(async () => {
      await result.current.generate();
    });

    await waitFor(() => {
      expect(result.current.jobState.phase).toBe('error');
    });

    expect(result.current.jobState.errorMessage).toBeTruthy();
  });

  it('captures generation errors and transitions to error phase', async () => {
    const failingService: RwaCodegenService = {
      ...testService,
      async generateZip() {
        throw new Error('Generator unavailable');
      },
    };

    const { result } = renderHook(() =>
      useGenerationFlow({
        draftId: 'draft-1',
        config: validConfig(),
        codegenService: failingService,
      })
    );

    await act(async () => {
      await result.current.generate();
    });

    await waitFor(() => {
      expect(result.current.jobState.phase).toBe('error');
    });

    expect(result.current.jobState.errorMessage).toContain('Generator unavailable');
  });

  it('reset() returns to idle', async () => {
    const { result } = renderHook(() =>
      useGenerationFlow({ draftId: 'draft-1', config: validConfig(), codegenService: testService })
    );

    await act(async () => {
      await result.current.generate();
    });

    await waitFor(() => {
      expect(result.current.jobState.phase).toBe('success');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.jobState.phase).toBe('idle');
    expect(result.current.jobState.zipFileName).toBeUndefined();
    expect(result.current.jobState.errorMessage).toBeUndefined();
  });

  it('tracks draftId in job state', () => {
    const { result } = renderHook(() =>
      useGenerationFlow({
        draftId: 'my-draft-42',
        config: validConfig(),
        codegenService: testService,
      })
    );

    expect(result.current.jobState.draftId).toBe('my-draft-42');
  });

  it('records completedAt on success', async () => {
    const { result } = renderHook(() =>
      useGenerationFlow({ draftId: 'draft-1', config: validConfig(), codegenService: testService })
    );

    await act(async () => {
      await result.current.generate();
    });

    await waitFor(() => {
      expect(result.current.jobState.phase).toBe('success');
    });

    expect(result.current.jobState.completedAt).toBeInstanceOf(Date);
  });

  it('records completedAt on error', async () => {
    const failingService: RwaCodegenService = {
      ...testService,
      async generateZip() {
        throw new Error('fail');
      },
    };

    const { result } = renderHook(() =>
      useGenerationFlow({
        draftId: 'draft-1',
        config: validConfig(),
        codegenService: failingService,
      })
    );

    await act(async () => {
      await result.current.generate();
    });

    await waitFor(() => {
      expect(result.current.jobState.phase).toBe('error');
    });

    expect(result.current.jobState.completedAt).toBeInstanceOf(Date);
  });

  it('does not promote to success when onStatus reports an error', async () => {
    // Regression: if the streaming callback reports `error` but the underlying
    // promise still resolves (e.g. generator returns a partial artifact), we
    // must keep the job in the error phase instead of overwriting it.
    const bogusService: RwaCodegenService = {
      ...testService,
      async generateZip(_config, options) {
        options?.onStatus?.({ phase: 'error', message: 'partial failure' });
        return { fileName: 'bogus.zip', data: new Blob(['x']) };
      },
    };

    const { result } = renderHook(() =>
      useGenerationFlow({
        draftId: 'draft-1',
        config: validConfig(),
        codegenService: bogusService,
      })
    );

    await act(async () => {
      await result.current.generate();
    });

    await waitFor(() => {
      expect(result.current.jobState.phase).toBe('error');
    });

    expect(result.current.jobState.errorMessage).toBe('partial failure');
    expect(result.current.jobState.zipFileName).toBeUndefined();
    expect(result.current.jobState.phaseLog).not.toContain('success');
  });

  it('reports an error when codegenService is null', async () => {
    const { result } = renderHook(() =>
      useGenerationFlow({
        draftId: 'draft-1',
        config: validConfig(),
        codegenService: null,
      })
    );

    await act(async () => {
      await result.current.generate();
    });

    await waitFor(() => {
      expect(result.current.jobState.phase).toBe('error');
    });

    expect(result.current.jobState.errorMessage).toMatch(/no codegen service/i);
  });

  describe('download()', () => {
    let createObjectURLSpy: ReturnType<typeof vi.fn>;
    let revokeObjectURLSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      createObjectURLSpy = vi.fn().mockReturnValue('blob:http://localhost/fake-url');
      revokeObjectURLSpy = vi.fn();
      URL.createObjectURL = createObjectURLSpy;
      URL.revokeObjectURL = revokeObjectURLSpy;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('is a no-op before a successful generation', () => {
      const { result } = renderHook(() =>
        useGenerationFlow({
          draftId: 'draft-1',
          config: validConfig(),
          codegenService: testService,
          autoDownload: false,
        })
      );

      act(() => {
        result.current.download();
      });

      expect(createObjectURLSpy).not.toHaveBeenCalled();
    });

    it('triggers a browser download after success when autoDownload is off', async () => {
      const { result } = renderHook(() =>
        useGenerationFlow({
          draftId: 'draft-1',
          config: validConfig(),
          codegenService: testService,
          autoDownload: false,
        })
      );

      await act(async () => {
        await result.current.generate();
      });

      await waitFor(() => {
        expect(result.current.jobState.phase).toBe('success');
      });

      // Generation alone must not trigger a download when autoDownload is off.
      expect(createObjectURLSpy).not.toHaveBeenCalled();

      act(() => {
        result.current.download();
      });

      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    });

    it('is a no-op after reset()', async () => {
      const { result } = renderHook(() =>
        useGenerationFlow({
          draftId: 'draft-1',
          config: validConfig(),
          codegenService: testService,
          autoDownload: false,
        })
      );

      await act(async () => {
        await result.current.generate();
      });

      await waitFor(() => {
        expect(result.current.jobState.phase).toBe('success');
      });

      act(() => {
        result.current.reset();
      });

      act(() => {
        result.current.download();
      });

      expect(createObjectURLSpy).not.toHaveBeenCalled();
    });
  });

  it('reset() aborts an in-flight generation and leaves the job idle', async () => {
    // Regression: `reset()` used to only flip `generatingRef` to false without
    // cancelling the run. The in-flight Promise chain would still call
    // `setPhase('success')` once the slow generator resolved, resurrecting a
    // completed job on top of the newly-reset idle state.
    let resolveGenerate: () => void = () => undefined;
    const slowService: RwaCodegenService = {
      ...testService,
      async generateZip() {
        await new Promise<void>((resolve) => {
          resolveGenerate = resolve;
        });
        return { fileName: 'slow.zip', data: new Blob(['x']) };
      },
    };

    const { result } = renderHook(() =>
      useGenerationFlow({
        draftId: 'draft-1',
        config: validConfig(),
        codegenService: slowService,
        autoDownload: false,
      })
    );

    act(() => {
      void result.current.generate();
    });

    await waitFor(() => {
      expect(result.current.jobState.phase).toBe('generating');
    });

    act(() => {
      result.current.reset();
    });
    expect(result.current.jobState.phase).toBe('idle');

    await act(async () => {
      resolveGenerate();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.jobState.phase).toBe('idle');
    expect(result.current.jobState.zipFileName).toBeUndefined();
    expect(result.current.jobState.phaseLog).not.toContain('success');
  });

  it('clears the cached artifact and draftId when the active draft changes', async () => {
    // Regression: the artifact and `jobState.draftId` survived across draft
    // switches. Switching from a draft with a completed generation to a new
    // draft used to let `download()` hand back the *previous* draft's ZIP.
    const { result, rerender } = renderHook(
      ({ draftId }) =>
        useGenerationFlow({
          draftId,
          config: validConfig(),
          codegenService: testService,
          autoDownload: false,
        }),
      { initialProps: { draftId: 'draft-A' } }
    );

    await act(async () => {
      await result.current.generate();
    });
    await waitFor(() => {
      expect(result.current.jobState.phase).toBe('success');
    });
    expect(result.current.jobState.draftId).toBe('draft-A');

    rerender({ draftId: 'draft-B' });

    expect(result.current.jobState.phase).toBe('idle');
    expect(result.current.jobState.draftId).toBe('draft-B');
    expect(result.current.jobState.zipFileName).toBeUndefined();

    const createObjectURLSpy = vi.fn().mockReturnValue('blob:fake');
    URL.createObjectURL = createObjectURLSpy;
    URL.revokeObjectURL = vi.fn();
    act(() => {
      result.current.download();
    });
    expect(createObjectURLSpy).not.toHaveBeenCalled();
  });

  it('prevents concurrent generate() calls', async () => {
    let resolveGenerate: () => void;
    const slowService: RwaCodegenService = {
      ...testService,
      async generateZip(_config, options) {
        options?.onStatus?.({ phase: 'generating', message: 'Slow...' });
        await new Promise<void>((resolve) => {
          resolveGenerate = resolve;
        });
        return { fileName: 'test.zip', data: new Blob(['test']) };
      },
    };

    const { result } = renderHook(() =>
      useGenerationFlow({
        draftId: 'draft-1',
        config: validConfig(),
        codegenService: slowService,
      })
    );

    let firstDone = false;
    let secondDone = false;

    act(() => {
      void result.current.generate().then(() => {
        firstDone = true;
      });
    });

    await waitFor(() => {
      expect(result.current.isGenerating).toBe(true);
    });

    act(() => {
      void result.current.generate().then(() => {
        secondDone = true;
      });
    });

    await waitFor(() => {
      expect(secondDone).toBe(true);
    });
    expect(firstDone).toBe(false);

    await act(async () => {
      resolveGenerate!();
    });

    await waitFor(() => {
      expect(firstDone).toBe(true);
    });
  });
});
