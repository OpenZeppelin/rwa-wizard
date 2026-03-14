import type { RwaCodegenService } from '../services/codegen';
import { ensureCodegenLoaded, getCodegenService } from '../services/codegen';
import type { TargetCapabilitySnapshot } from '../types/wizard';
import { getTarget, listTargets } from './targets';

export interface LoadedTargetRuntime {
  targetId: string;
  codegenService: RwaCodegenService;
}

const runtimeCache = new Map<string, LoadedTargetRuntime>();

/**
 * Loads the target runtime (codegen service) for the given target id.
 * Caches by targetId. Ensures the real codegen package is loaded when available.
 * Rejects for hidden or unsupported targets (contract: loadRuntime must reject disabled).
 */
export async function loadRuntime(targetId: string): Promise<LoadedTargetRuntime> {
  const entry = getTarget(targetId);
  if (!entry) {
    throw new Error(`target/unknown: ${targetId}`);
  }
  if (!entry.showInUI) {
    throw new Error(`target/hidden: ${targetId}`);
  }
  const cached = runtimeCache.get(targetId);
  if (cached) return cached;

  await ensureCodegenLoaded(targetId);

  const codegenService = getCodegenService(targetId);
  const runtime: LoadedTargetRuntime = { targetId, codegenService };
  runtimeCache.set(targetId, runtime);
  return runtime;
}

/**
 * Returns capability snapshot for a target (modules, network options, mocked flag).
 * Call after loadRuntime or use for UI that only needs module list.
 */
export async function getTargetCapabilitySnapshot(
  targetId: string
): Promise<TargetCapabilitySnapshot> {
  const runtime = await loadRuntime(targetId);
  const modules = await runtime.codegenService.getAvailableModules();
  const entry = getTarget(targetId);
  return {
    targetId,
    availableModules: modules,
    networkOptions: undefined,
    mocked: entry?.enabled === false,
  };
}

export { listTargets, getTarget };
