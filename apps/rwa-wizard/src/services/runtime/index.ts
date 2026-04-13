import { loadAdapterCapabilities } from './adapterLoader';
import type { TargetAdapterCapabilities } from './types';

const capabilitiesCache = new Map<string, TargetAdapterCapabilities>();

/**
 * Returns cached adapter capabilities for a target, or null if not yet loaded.
 */
export function getAdapterCapabilities(targetId: string): TargetAdapterCapabilities | null {
  return capabilitiesCache.get(targetId) ?? null;
}

/**
 * Lazily loads and caches adapter capabilities for a target.
 * Safe to call multiple times — subsequent calls return the cached result.
 */
export async function ensureAdapterLoaded(targetId: string): Promise<void> {
  if (capabilitiesCache.has(targetId)) return;
  const capabilities = await loadAdapterCapabilities(targetId);
  if (capabilities) capabilitiesCache.set(targetId, capabilities);
}

export type { TargetAdapterCapabilities } from './types';
export {
  AdapterCapabilitiesProvider,
  useAdapterCapabilities,
  useAddressing,
  useExplorer,
} from './AdapterCapabilitiesContext';
