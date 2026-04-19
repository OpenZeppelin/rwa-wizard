import type { RwaCodegenService } from '../services/codegen';
import { ensureCodegenLoaded, getCodegenService } from '../services/codegen';
import type { TargetAdapterCapabilities } from '../services/runtime';
import { ensureAdapterLoaded, getAdapterCapabilities } from '../services/runtime';
import type { StructuralEcosystemMetadata, TargetCapabilitySnapshot } from '../types/wizard';
import { enrichAvailableModules, enrichEcosystemMetadata } from './enrichEcosystemMetadata';
import { getTarget, listTargets } from './targets';

export interface LoadedTargetRuntime {
  targetId: string;
  codegenService: RwaCodegenService | null;
  adapterCapabilities: TargetAdapterCapabilities | null;
}

const runtimeCache = new Map<string, LoadedTargetRuntime>();

const EMPTY_ECOSYSTEM_METADATA: StructuralEcosystemMetadata = {
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
 * Loads the target runtime (codegen service + adapter) for the given target id.
 * Caches only fully-successful loads. A transient failure (network blip,
 * dynamic-import error) therefore stays retryable on the next call instead
 * of poisoning the session with a permanently null runtime.
 */
export async function loadRuntime(targetId: string): Promise<LoadedTargetRuntime> {
  // `getTarget` already filters on `showInUI`, so hidden entries surface as
  // `unknown` here. An explicit hidden check would be unreachable.
  const entry = getTarget(targetId);
  if (!entry) {
    throw new Error(`target/unknown: ${targetId}`);
  }
  const cached = runtimeCache.get(targetId);
  if (cached) return cached;

  await Promise.all([ensureCodegenLoaded(targetId), ensureAdapterLoaded(targetId)]);

  const codegenService = getCodegenService(targetId);
  const adapterCapabilities = getAdapterCapabilities(targetId);
  const runtime: LoadedTargetRuntime = { targetId, codegenService, adapterCapabilities };
  // Only cache when at least one capability resolved. If both are null,
  // `ensure*Loaded` almost certainly failed and retrying on the next call
  // is cheap — pinning the failure would be worse.
  if (codegenService !== null || adapterCapabilities !== null) {
    runtimeCache.set(targetId, runtime);
  }
  return runtime;
}

/**
 * Returns capability snapshot for a target (modules, network options).
 * Call after loadRuntime or use for UI that only needs module list.
 */
export async function getTargetCapabilitySnapshot(
  targetId: string
): Promise<TargetCapabilitySnapshot> {
  const runtime = await loadRuntime(targetId);
  const structuralModules = runtime.codegenService
    ? await runtime.codegenService.getAvailableModules()
    : [];

  const networkOptions = runtime.adapterCapabilities?.networkCatalog
    .getNetworks()
    .map((n) => ({ value: n.id, label: n.name, hint: n.isTestnet ? 'Testnet' : undefined }));

  const structuralMetadata =
    runtime.codegenService?.getEcosystemMetadata?.() ?? EMPTY_ECOSYSTEM_METADATA;

  return {
    targetId,
    availableModules: enrichAvailableModules(targetId, structuralModules),
    ecosystemMetadata: enrichEcosystemMetadata(targetId, structuralMetadata),
    networkOptions,
  };
}

export { listTargets, getTarget };
