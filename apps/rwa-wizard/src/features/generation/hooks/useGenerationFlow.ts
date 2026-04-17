import { useCallback, useRef, useState } from 'react';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { RwaCodegenService } from '../../../services/codegen/types';
import { downloadZip } from '../../../services/download/downloadZip';
import type { GenerationJobState, GenerationPhase } from '../../../types/wizard';

export interface UseGenerationFlowOptions {
  draftId: string | null;
  config: RWAConfig;
  /** The codegen service for the active target. When `null`, `generate()` reports an error. */
  codegenService: RwaCodegenService | null;
  /** When true, the download step is triggered automatically on success. */
  autoDownload?: boolean;
  /**
   * Minimum time (ms) to keep each phase on screen before advancing. Real work
   * can complete in single-digit milliseconds, which makes the progress list
   * flash past unreadably; a small pace delay smooths the perceived progress.
   * Defaults to 0 to keep the hook deterministic for tests.
   */
  minPhaseDurationMs?: number;
}

export interface UseGenerationFlowResult {
  jobState: GenerationJobState;
  generate: () => Promise<void>;
  /**
   * Triggers a browser download of the most recently generated artifact.
   * No-op when no artifact is available (e.g. before success, after reset).
   */
  download: () => void;
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
function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useGenerationFlow({
  draftId,
  config,
  codegenService,
  autoDownload = true,
  minPhaseDurationMs = 0,
}: UseGenerationFlowOptions): UseGenerationFlowResult {
  const effectiveDraftId = draftId ?? '';
  const [jobState, setJobState] = useState<GenerationJobState>(() =>
    createIdleJob(effectiveDraftId)
  );
  const generatingRef = useRef(false);
  // Cached so the consumer can trigger a browser download on demand (e.g. from
  // a user-initiated button click) without forcing auto-download at generation
  // time — we cannot detect whether the user actually saves the file.
  const artifactRef = useRef<{ fileName: string; data: Blob } | null>(null);

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
      if (!codegenService) {
        setPhase('error', {
          errorMessage: 'No codegen service is configured for the selected target.',
          completedAt: new Date(),
        });
        return;
      }

      // Pacing: run real work in parallel with a minimum phase delay so each
      // phase stays on screen long enough to be perceived. The phase duration
      // is `max(realWork, minPhaseDurationMs)` — we never slow down real work,
      // we only prevent it from blinking past the user.
      const [validation] = await Promise.all([
        codegenService.validate(config),
        delay(minPhaseDurationMs),
      ]);

      if (!validation.valid) {
        const firstError = validation.errors[0];
        setPhase('error', {
          errorMessage: firstError?.message ?? 'Validation failed',
          completedAt: new Date(),
        });
        return;
      }

      setPhase('generating');

      // The streaming callback is used *only* to surface mid-flight errors.
      // We deliberately ignore non-error phase events because the hook itself
      // authors phase transitions (with pacing), and the codegen service can
      // emit several phases synchronously — forwarding those would overwrite
      // our current phase and skip rows in the UI.
      let streamErrored = false;
      const [artifact] = await Promise.all([
        codegenService.generateZip(config, {
          onStatus: (status) => {
            if (status.phase === 'error') {
              streamErrored = true;
              setPhase('error', {
                errorMessage: status.message ?? 'Generation failed',
                completedAt: new Date(),
              });
            }
          },
        }),
        delay(minPhaseDurationMs),
      ]);

      if (streamErrored) return;

      setPhase('packaging');
      artifactRef.current = { fileName: artifact.fileName, data: artifact.data };
      await delay(minPhaseDurationMs);

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
  }, [effectiveDraftId, config, codegenService, autoDownload, minPhaseDurationMs, setPhase]);

  const download = useCallback(() => {
    const artifact = artifactRef.current;
    if (!artifact) return;
    downloadZip(artifact.fileName, artifact.data);
  }, []);

  const reset = useCallback(() => {
    generatingRef.current = false;
    artifactRef.current = null;
    setJobState(createIdleJob(effectiveDraftId));
  }, [effectiveDraftId]);

  const isGenerating =
    jobState.phase !== 'idle' && jobState.phase !== 'success' && jobState.phase !== 'error';

  return { jobState, generate, download, reset, isGenerating };
}
