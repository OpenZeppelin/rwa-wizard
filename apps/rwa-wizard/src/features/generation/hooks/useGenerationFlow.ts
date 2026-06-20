import { useCallback, useEffect, useRef, useState } from 'react';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { RwaCodegenService } from '../../../services/codegen/types';
import { downloadZip } from '../../../services/download/downloadZip';
import type { GenerationJobState, GenerationPhase } from '../../../types/wizard';
import { getErrorMessage } from '../../../utils/errorReporting';

export interface UseGenerationFlowOptions {
  draftId: string | null;
  config: RWAConfig;
  /** The codegen service for the active target. When `null`, `generate()` reports an error. */
  codegenService: RwaCodegenService | null;
  /** When true, the download step is triggered automatically on success. */
  autoDownload?: boolean;
  /** Request dev/testnet identity scaffolding when supported by the codegen service. */
  includeIdentitySupport?: boolean;
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
  includeIdentitySupport = false,
  minPhaseDurationMs = 0,
}: UseGenerationFlowOptions): UseGenerationFlowResult {
  const effectiveDraftId = draftId ?? '';
  const [jobState, setJobState] = useState<GenerationJobState>(() =>
    createIdleJob(effectiveDraftId)
  );
  const generatingRef = useRef(false);
  // Monotonic id for each `generate()` call. Incremented on every start and
  // on every `reset()`, so an in-flight run can detect that it has been
  // superseded and stop publishing phase transitions or artifacts.
  const runIdRef = useRef(0);
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

  // Whenever the active draft changes, clear all derived run state so
  // `download()` cannot hand back a different draft's artifact and
  // `jobState.draftId` never misreports the current draft.
  useEffect(() => {
    runIdRef.current += 1;
    generatingRef.current = false;
    artifactRef.current = null;
    setJobState(createIdleJob(effectiveDraftId));
  }, [effectiveDraftId]);

  const generate = useCallback(async () => {
    if (generatingRef.current) return;
    generatingRef.current = true;
    const runId = ++runIdRef.current;
    const isActive = () => runIdRef.current === runId;

    const startedAt = new Date();
    setJobState({
      draftId: effectiveDraftId,
      phase: 'validating',
      phaseLog: ['validating'],
      startedAt,
    });

    try {
      if (!codegenService) {
        if (isActive()) {
          setPhase('error', {
            errorMessage: 'No codegen service is configured for the selected target.',
            completedAt: new Date(),
          });
        }
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
      if (!isActive()) return;

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
          includeIdentitySupport,
          onStatus: (status) => {
            if (status.phase === 'error' && isActive()) {
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
      if (!isActive()) return;
      if (streamErrored) return;

      setPhase('packaging');
      artifactRef.current = { fileName: artifact.fileName, data: artifact.data };
      await delay(minPhaseDurationMs);
      if (!isActive()) {
        // `reset()` fired between `packaging` and `success`; drop the
        // artifact so `download()` cannot hand back stale bytes.
        artifactRef.current = null;
        return;
      }

      setPhase('success', {
        zipFileName: artifact.fileName,
        completedAt: new Date(),
      });

      if (autoDownload) {
        downloadZip(artifact.fileName, artifact.data);
      }
    } catch (err) {
      if (isActive()) {
        setPhase('error', {
          errorMessage: getErrorMessage(err, 'Generation failed unexpectedly'),
          completedAt: new Date(),
        });
      }
    } finally {
      // Only clear the busy flag for the run that set it; a superseding
      // `reset()` already cleared it and a newer `generate()` may be in
      // flight by the time we reach `finally`.
      if (runIdRef.current === runId) {
        generatingRef.current = false;
      }
    }
  }, [
    effectiveDraftId,
    config,
    codegenService,
    autoDownload,
    includeIdentitySupport,
    minPhaseDurationMs,
    setPhase,
  ]);

  const download = useCallback(() => {
    const artifact = artifactRef.current;
    if (!artifact) return;
    downloadZip(artifact.fileName, artifact.data);
  }, []);

  const reset = useCallback(() => {
    // Bump the run id so any in-flight `generate()` stops publishing state.
    runIdRef.current += 1;
    generatingRef.current = false;
    artifactRef.current = null;
    setJobState(createIdleJob(effectiveDraftId));
  }, [effectiveDraftId]);

  const isGenerating =
    jobState.phase !== 'idle' && jobState.phase !== 'success' && jobState.phase !== 'error';

  return { jobState, generate, download, reset, isGenerating };
}
