import { PROGRESS_PHASES } from './types';
import type { ProgressCallback, ProgressEvent, ProgressPhase, SummaryPhase } from './types';

/**
 * No-op progress callback used when no callback is provided.
 */
export const noopProgress: ProgressCallback = () => {};

/**
 * Create a ProgressEvent with the given phase, percentage, and optional message.
 */
export function createProgressEvent(
  phase: ProgressPhase,
  percentage: number,
  message?: string
): ProgressEvent {
  return { phase, percentage, ...(message !== undefined && { message }) };
}

const PHASE_SET = new Set<string>(PROGRESS_PHASES);

/**
 * Map a canonical ProgressPhase (or unknown string from a package) to a SummaryPhase for UI display.
 * Keeps phase handling in one place so apps and shells don't maintain their own mapping.
 * Unknown phases are mapped to 'generating'.
 */
export function toSummaryPhase(phase: ProgressPhase | string): SummaryPhase {
  if (!PHASE_SET.has(phase)) return 'generating';
  const p = phase as ProgressPhase;
  switch (p) {
    case 'validating':
      return 'validating';
    case 'generating-contracts':
    case 'generating-scripts':
      return 'generating';
    case 'packaging':
    case 'assembling-zip':
      return 'packaging';
    case 'complete':
      return 'success';
    case 'error':
      return 'error';
    default: {
      const _: never = p;
      void _;
      return 'generating';
    }
  }
}

/**
 * Resolve a progress callback, returning the provided callback or a no-op default.
 */
export function resolveProgressCallback(callback?: ProgressCallback): ProgressCallback {
  return callback ?? noopProgress;
}
