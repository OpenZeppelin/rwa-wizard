import { getTarget } from '../../registry/targets';
import { loadCodegenService } from './codegenLoader';
import { createMockCodegenService } from './mockCodegenService';
import type { RwaCodegenService } from './types';

const serviceCache = new Map<string, RwaCodegenService>();
const mockByTarget = new Map<string, RwaCodegenService>();

/**
 * Resolves the codegen service for a target. Uses loaded implementation when
 * already cached for that target; falls back to mock when not loaded or on failure.
 */
export function getCodegenService(targetId: string): RwaCodegenService {
  const entry = getTarget(targetId);
  if (!entry) {
    throw new Error(`codegen/unknown-target: ${targetId}`);
  }
  if (!entry.enabled && entry.showInUI) {
    if (!mockByTarget.has(targetId)) {
      mockByTarget.set(targetId, createMockCodegenService(targetId));
    }
    return mockByTarget.get(targetId)!;
  }
  const cached = serviceCache.get(targetId);
  if (cached) return cached;
  if (!mockByTarget.has(targetId)) {
    mockByTarget.set(targetId, createMockCodegenService(targetId));
  }
  return mockByTarget.get(targetId)!;
}

/**
 * Lazy-load the codegen runtime for a target (dynamic import) and cache it.
 * Call from targetManager when loadRuntime(targetId) is invoked — same pattern
 * as UI Builder / Role Manager adapter loading.
 */
export async function ensureCodegenLoaded(targetId: string): Promise<void> {
  if (serviceCache.has(targetId)) return;
  const service = await loadCodegenService(targetId);
  if (service) serviceCache.set(targetId, service);
}

export type { RwaCodegenService, ValidationResultDTO } from './types';
export { createMockCodegenService } from './mockCodegenService';
export { getMockGapsForTarget, getMockGap, getAllMockGaps } from './mockGapRegistry';
