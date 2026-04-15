import { useCallback, useRef, useState } from 'react';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { RwaCodegenService } from '../../../services/codegen/types';
import { downloadZip } from '../../../services/download/downloadZip';
import type { GenerationJobState, GenerationPhase } from '../../../types/wizard';

export interface UseGenerationFlowOptions {
  draftId: string | null;
  config: RWAConfig;
  codegenService: RwaCodegenService;
  /** When true, the download step is triggered automatically on success. */
  autoDownload?: boolean;
}

export interface UseGenerationFlowResult {
  jobState: GenerationJobState;
  generate: () => Promise<void>;
  reset: () => void;
  isGenerating: boolean;
}

function createIdleJob(draftId: string): GenerationJobState {
  return {
    draftId,
    phase: 'idle',
    phaseLog: [],
  };
}

/**
 * Orchestrates the generation flow: validate → generate → package → download.
 *
 * The hook manages a local `GenerationJobState` that progresses through
 * phases matching the data-model lifecycle. `generate()` is guarded against
 * concurrent invocations; call `reset()` to return to idle.
 */
export function useGenerationFlow({
  draftId,
  config,
  codegenService,
  autoDownload = true,
}: UseGenerationFlowOptions): UseGenerationFlowResult {
  const effectiveDraftId = draftId ?? '';
  const [jobState, setJobState] = useState<GenerationJobState>(() =>
    createIdleJob(effectiveDraftId)
  );
  const generatingRef = useRef(false);

  const setPhase = useCallback((phase: GenerationPhase, extra?: Partial<GenerationJobState>) => {
    setJobState((prev) => ({
      ...prev,
      phase,
      phaseLog: prev.phaseLog.includes(phase) ? prev.phaseLog : [...prev.phaseLog, phase],
      ...extra,
    }));
  }, []);

  const generate = useCallback(async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;

    const startedAt = new Date();
    setJobState({
      draftId: effectiveDraftId,
      phase: 'validating',
      phaseLog: ['validating'],
      startedAt,
    });

    try {
      const validation = await codegenService.validate(config);

      if (!validation.valid) {
        const firstError = validation.errors[0];
        setPhase('error', {
          errorMessage: firstError?.message ?? 'Validation failed',
          completedAt: new Date(),
        });
        return;
      }

      setPhase('generating');

      const artifact = await codegenService.generateZip(config, {
        onStatus: (status) => {
          if (status.phase === 'error') {
            setPhase('error', {
              errorMessage: status.message ?? 'Generation failed',
              completedAt: new Date(),
            });
          } else if (status.phase !== 'success') {
            setPhase(status.phase as GenerationPhase);
          }
        },
      });

      setPhase('packaging');
      setPhase('success', {
        zipFileName: artifact.fileName,
        completedAt: new Date(),
      });

      if (autoDownload) {
        downloadZip(artifact.fileName, artifact.data);
      }
    } catch (err) {
      setPhase('error', {
        errorMessage: err instanceof Error ? err.message : 'Generation failed unexpectedly',
        completedAt: new Date(),
      });
    } finally {
      generatingRef.current = false;
    }
  }, [effectiveDraftId, config, codegenService, autoDownload, setPhase]);

  const reset = useCallback(() => {
    generatingRef.current = false;
    setJobState(createIdleJob(effectiveDraftId));
  }, [effectiveDraftId]);

  const isGenerating =
    jobState.phase !== 'idle' && jobState.phase !== 'success' && jobState.phase !== 'error';

  return { jobState, generate, reset, isGenerating };
}
