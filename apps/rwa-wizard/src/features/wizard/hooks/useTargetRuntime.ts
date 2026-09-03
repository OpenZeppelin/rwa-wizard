import { useEffect, useState } from 'react';

import { getTargetCapabilitySnapshot, loadRuntime } from '../../../registry/targetManager';
import type { RwaCodegenService } from '../../../services/codegen/types';
import type { TargetAdapterCapabilities } from '../../../services/runtime';
import type { TargetCapabilitySnapshot, TargetId } from '../../../types/wizard';
import { getErrorMessage } from '../../../utils/errorReporting';

export interface TargetRuntimeState {
  /** Capability snapshot (metadata, modules) for the selected target, or `null` while loading/errored. */
  targetSnapshot: TargetCapabilitySnapshot | null;
  /** Adapter capabilities (e.g. addressing helpers) for the selected target, or `null` while loading/errored. */
  adapterCaps: TargetAdapterCapabilities | null;
  /** Codegen service for the selected target, or `null` when generation is unavailable. */
  codegenService: RwaCodegenService | null;
  /**
   * `true` from mount until the load for the current target settles. Consumers
   * must not read a `null` `codegenService` as "this target cannot generate"
   * while this is set — it is also `null` before the async load resolves.
   */
  isRuntimeLoading: boolean;
  /** User-facing load error message; `null` once the runtime is ready. */
  targetLoadError: string | null;
  /** Imperatively clears the current error (e.g. after user dismisses the banner). */
  clearTargetLoadError: () => void;
}

/**
 * Loads the capability snapshot, adapter, and codegen service for the given
 * target. Handles three outcomes:
 *
 * 1. Success with a codegen service → clears any prior error.
 * 2. Success with a `null` codegen service → surfaces a user-facing message
 *    explaining that generation will not work for this target.
 * 3. Thrown error → surfaces the error message and clears the cached
 *    snapshot/caps/codegen so downstream code never renders stale data.
 *
 * Uses an `isActive` closure flag so target switches mid-load do not clobber
 * state for the new target with the stale response.
 */
export function useTargetRuntime(selectedTargetId: TargetId): TargetRuntimeState {
  const [targetSnapshot, setTargetSnapshot] = useState<TargetCapabilitySnapshot | null>(null);
  const [adapterCaps, setAdapterCaps] = useState<TargetAdapterCapabilities | null>(null);
  const [codegenService, setCodegenService] = useState<RwaCodegenService | null>(null);
  const [targetLoadError, setTargetLoadError] = useState<string | null>(null);
  const [isRuntimeLoading, setIsRuntimeLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    async function loadTarget() {
      try {
        const [snapshot, runtime] = await Promise.all([
          getTargetCapabilitySnapshot(selectedTargetId),
          loadRuntime(selectedTargetId),
        ]);
        if (!isActive) return;
        setTargetSnapshot(snapshot);
        setAdapterCaps(runtime.adapterCapabilities);
        setCodegenService(runtime.codegenService);
        if (runtime.codegenService === null) {
          setTargetLoadError(
            'Code generation is unavailable for this target. You can edit the configuration, but the project ZIP cannot be produced.'
          );
        } else {
          setTargetLoadError(null);
        }
      } catch (err) {
        if (!isActive) return;
        setTargetSnapshot(null);
        setAdapterCaps(null);
        setCodegenService(null);
        setTargetLoadError(
          `Unable to load the ${selectedTargetId} target: ${getErrorMessage(err)}. Try reloading the page.`
        );
      } finally {
        if (isActive) {
          setIsRuntimeLoading(false);
        }
      }
    }

    setTargetLoadError(null);
    setIsRuntimeLoading(true);
    void loadTarget();

    return () => {
      isActive = false;
    };
  }, [selectedTargetId]);

  return {
    targetSnapshot,
    adapterCaps,
    codegenService,
    isRuntimeLoading,
    targetLoadError,
    clearTargetLoadError: () => setTargetLoadError(null),
  };
}
