import { getTarget } from '../../registry/targets';
import { loadCodegenService } from './codegenLoader';
import type { RwaCodegenService } from './types';

const serviceCache = new Map<string, RwaCodegenService>();

/**
 * Resolves the codegen service for a target. Returns null when the real
 * codegen package hasn't been loaded yet — callers should disable generation
 * in that case rather than silently falling back to a mock.
 */
export function getCodegenService(targetId: string): RwaCodegenService | null {
  const entry = getTarget(targetId);
  if (!entry) {
    throw new Error(`codegen/unknown-target: ${targetId}`);
  }
  return serviceCache.get(targetId) ?? null;
}

/**
 * Lazy-load the codegen runtime for a target (dynamic import) and cache it.
 * Call from targetManager when loadRuntime(targetId) is invoked.
 */
export async function ensureCodegenLoaded(targetId: string): Promise<void> {
  if (serviceCache.has(targetId)) return;
  const service = await loadCodegenService(targetId);
  if (service) serviceCache.set(targetId, service);
}

export type {
  GeneratedFileTreeArtifact,
  GenerateArtifactOptions,
  RwaCodegenService,
  ValidationResultDTO,
} from './types';
export {
  CodegenGenerationError,
  CodegenInvalidConfigError,
  CodegenUnsupportedError,
} from './errors';
export { createTestCodegenService } from './testCodegenService';
export type { TestCodegenServiceOptions } from './testCodegenService';
