import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import { createTestCodegenService } from '../../../services/codegen';
import type { RwaCodegenService } from '../../../services/codegen/types';
import { createDefaultRwaConfig } from '../../../utils/defaultRwaConfig';
import { useGenerationFlow } from './useGenerationFlow';

function makeConfig(overrides: Partial<RWAConfig> = {}): RWAConfig {
  return { ...createDefaultRwaConfig(), ...overrides };
}

function validConfig(): RWAConfig {
  return makeConfig({
    token: { ...createDefaultRwaConfig().token, name: 'Test Token', symbol: 'TST' },
  });
}

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
