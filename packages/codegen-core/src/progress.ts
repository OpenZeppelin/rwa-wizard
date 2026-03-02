import type { ProgressCallback, ProgressEvent } from './types';

/**
 * No-op progress callback used when no callback is provided.
 */
export const noopProgress: ProgressCallback = () => {};

/**
 * Create a ProgressEvent with the given phase, percentage, and optional message.
 */
export function createProgressEvent(
  phase: string,
  percentage: number,
  message?: string
): ProgressEvent {
  return { phase, percentage, ...(message !== undefined && { message }) };
}

/**
 * Resolve a progress callback, returning the provided callback or a no-op default.
 */
export function resolveProgressCallback(callback?: ProgressCallback): ProgressCallback {
  return callback ?? noopProgress;
}
