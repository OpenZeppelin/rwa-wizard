import type { RwaCodegenService } from '../services/codegen';
import { ensureCodegenLoaded, getCodegenService } from '../services/codegen';
import type { TargetAdapterCapabilities } from '../services/runtime';
import { ensureAdapterLoaded, getAdapterCapabilities } from '../services/runtime';
import type { TargetCapabilitySnapshot, TargetEcosystemMetadata } from '../types/wizard';
import { getTarget, listTargets } from './targets';

export interface LoadedTargetRuntime {
  targetId: string;
  codegenService: RwaCodegenService;
  adapterCapabilities: TargetAdapterCapabilities | null;
}

const runtimeCache = new Map<string, LoadedTargetRuntime>();

const EMPTY_ECOSYSTEM_METADATA: TargetEcosystemMetadata = {
  administrativeControls: [],
  identityControls: [],
  operatorRoles: [],
  complianceHooks: [],
  limits: {
    maxModulesPerHook: 0,
    maxTrustedIssuers: 0,
  },
};

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

  await Promise.all([ensureCodegenLoaded(targetId), ensureAdapterLoaded(targetId)]);

  const codegenService = getCodegenService(targetId);
  const adapterCapabilities = getAdapterCapabilities(targetId);
  const runtime: LoadedTargetRuntime = { targetId, codegenService, adapterCapabilities };
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

  const networkOptions = runtime.adapterCapabilities?.networkCatalog
    .getNetworks()
    .map((n) => ({ value: n.id, label: n.name, hint: n.isTestnet ? 'Testnet' : undefined }));

  return {
    targetId,
    availableModules: modules,
    ecosystemMetadata: runtime.codegenService.getEcosystemMetadata?.() ?? EMPTY_ECOSYSTEM_METADATA,
    networkOptions,
    mocked: entry?.enabled === false,
  };
}

export { listTargets, getTarget };
