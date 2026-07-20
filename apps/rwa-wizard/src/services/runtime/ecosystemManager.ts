/**
 * Ecosystem Manager for RWA Wizard.
 *
 * Mirrors the canonical pattern used by `ui-builder` and `role-manager`:
 *
 * Two-tier loading strategy:
 * - Lightweight metadata (name, icon, addressExample) is statically imported
 *   from each adapter's `/metadata` entry point. Available synchronously from
 *   the first render — no loading state for ecosystem pickers or placeholders.
 * - Network configs are lazy-loaded from each adapter's `/networks` subpath
 *   (much lighter than the full adapter — no wallet SDKs or runtime code).
 * - Full ecosystem definitions (with `createRuntime`, capability factories) are
 *   lazy-loaded only when actually needed.
 *
 * RWA Wizard supports `stellar` and `evm` ecosystems.
 */

import { ecosystemMetadata as evmMetadata } from '@openzeppelin/adapter-evm/metadata';
import { ecosystemMetadata as stellarMetadata } from '@openzeppelin/adapter-stellar/metadata';
import type {
  CreateRuntimeOptions,
  Ecosystem,
  EcosystemExport,
  EcosystemMetadata,
  EcosystemRuntime,
  NetworkConfig,
} from '@openzeppelin/ui-types';
import { logger } from '@openzeppelin/ui-utils';

// =============================================================================
// Supported Ecosystems
// =============================================================================

export type RwaWizardEcosystem = Extract<Ecosystem, 'evm' | 'stellar'>;

const SUPPORTED_ECOSYSTEMS: readonly RwaWizardEcosystem[] = ['evm', 'stellar'];

export function getSupportedEcosystems(): readonly RwaWizardEcosystem[] {
  return SUPPORTED_ECOSYSTEMS;
}

function isSupported(ecosystem: Ecosystem): ecosystem is RwaWizardEcosystem {
  return (SUPPORTED_ECOSYSTEMS as readonly Ecosystem[]).includes(ecosystem);
}

// =============================================================================
// Metadata Registry (synchronous — available from first render)
// =============================================================================

const ecosystemMetadataRegistry: Record<RwaWizardEcosystem, EcosystemMetadata> = {
  evm: evmMetadata,
  stellar: stellarMetadata,
};

/**
 * Returns lightweight display metadata for an ecosystem. Always synchronous
 * because metadata is statically imported at module load time.
 */
export function getEcosystemMetadata(ecosystem: Ecosystem): EcosystemMetadata | undefined {
  return isSupported(ecosystem) ? ecosystemMetadataRegistry[ecosystem] : undefined;
}

// =============================================================================
// Full Adapter Module Loading (lazy — static switch required by Vite)
// =============================================================================

const adapterPromiseCache: Partial<Record<RwaWizardEcosystem, Promise<EcosystemExport>>> = {};

/**
 * Loads the full adapter module (networks, createRuntime, adapterConfig).
 * This is the "heavy" import — only called when the adapter is actually needed.
 * Caches the in-flight promise to deduplicate concurrent calls and clears the
 * cache entry on failure so transient errors can be retried.
 */
async function loadAdapterModule(ecosystem: RwaWizardEcosystem): Promise<EcosystemExport> {
  const cached = adapterPromiseCache[ecosystem];
  if (cached) return cached;

  const promise = (async (): Promise<EcosystemExport> => {
    let mod: { ecosystemDefinition: EcosystemExport };
    switch (ecosystem) {
      case 'evm':
        mod = await import('@openzeppelin/adapter-evm');
        break;
      case 'stellar':
        mod = await import('@openzeppelin/adapter-stellar');
        break;
      default: {
        const _exhaustiveCheck: never = ecosystem;
        throw new Error(
          `Adapter package module not defined for ecosystem: ${String(_exhaustiveCheck)}`
        );
      }
    }
    return mod.ecosystemDefinition;
  })();

  adapterPromiseCache[ecosystem] = promise;
  promise.catch(() => {
    delete adapterPromiseCache[ecosystem];
  });

  return promise;
}

/**
 * Returns the full ecosystem definition. Triggers lazy adapter module loading.
 */
export async function getEcosystemDefinition(
  ecosystem: Ecosystem
): Promise<EcosystemExport | undefined> {
  if (!isSupported(ecosystem)) return undefined;
  return loadAdapterModule(ecosystem);
}

// =============================================================================
// Lightweight Network Loading (lazy — only loads network configs, not adapters)
// =============================================================================

const networksByEcosystemCache: Partial<Record<RwaWizardEcosystem, NetworkConfig[]>> = {};
const networkPromiseCache: Partial<Record<RwaWizardEcosystem, Promise<NetworkConfig[]>>> = {};

/**
 * Loads only the network config array for an ecosystem. Much lighter than
 * `loadAdapterModule` because it imports from the `/networks` subpath, which
 * only pulls in static config objects + icons — no adapter runtime, wallet
 * libraries, or SDK code.
 *
 * Caches the in-flight promise to deduplicate concurrent calls. Resolved
 * values are stored in `networksByEcosystemCache` for synchronous lookups.
 * On failure the promise cache entry is cleared so the next call retries.
 */
async function loadNetworksModule(ecosystem: RwaWizardEcosystem): Promise<NetworkConfig[]> {
  const resolvedCache = networksByEcosystemCache[ecosystem];
  if (resolvedCache) return resolvedCache;

  const inflight = networkPromiseCache[ecosystem];
  if (inflight) return inflight;

  const promise = (async (): Promise<NetworkConfig[]> => {
    let mod: { networks: NetworkConfig[] };
    switch (ecosystem) {
      case 'evm':
        mod = await import('@openzeppelin/adapter-evm/networks');
        break;
      case 'stellar':
        mod = await import('@openzeppelin/adapter-stellar/networks');
        break;
      default: {
        const _exhaustiveCheck: never = ecosystem;
        throw new Error(`Networks module not defined for ecosystem: ${String(_exhaustiveCheck)}`);
      }
    }

    networksByEcosystemCache[ecosystem] = mod.networks;
    return mod.networks;
  })();

  networkPromiseCache[ecosystem] = promise;
  promise.catch(() => {
    delete networkPromiseCache[ecosystem];
  });

  return promise;
}

// =============================================================================
// Network Discovery
// =============================================================================

export async function getNetworksByEcosystem(ecosystem: Ecosystem): Promise<NetworkConfig[]> {
  if (!isSupported(ecosystem)) return [];
  try {
    return await loadNetworksModule(ecosystem);
  } catch (error) {
    logger.error('EcosystemManager', `Error loading networks for ${ecosystem}:`, error);
    return [];
  }
}

/**
 * Loads networks from all supported ecosystems in parallel. Uses the
 * lightweight `/networks` subpath so no full adapter modules are loaded.
 */
export async function getAllNetworks(): Promise<NetworkConfig[]> {
  const results = await Promise.allSettled(
    SUPPORTED_ECOSYSTEMS.map((eco) => getNetworksByEcosystem(eco))
  );

  const all: NetworkConfig[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') all.push(...result.value);
  }
  return all;
}

export async function getNetworkById(id: string): Promise<NetworkConfig | undefined> {
  for (const ecosystem of SUPPORTED_ECOSYSTEMS) {
    let networks = networksByEcosystemCache[ecosystem];
    if (!networks) {
      try {
        networks = await getNetworksByEcosystem(ecosystem);
      } catch {
        continue;
      }
    }
    const found = networks?.find((n) => n.id === id);
    if (found) return found;
  }
  return undefined;
}

/**
 * Creates a fresh runtime for the given network. This is intentionally a
 * factory (no caching) because RuntimeProvider owns the runtime lifecycle —
 * it caches active runtimes in its own registry and disposes them when they
 * are no longer needed.
 */
export async function getRuntime(
  networkConfig: NetworkConfig,
  options?: CreateRuntimeOptions
): Promise<EcosystemRuntime> {
  if (!isSupported(networkConfig.ecosystem)) {
    throw new Error(`Unsupported ecosystem: ${networkConfig.ecosystem}`);
  }
  const def = await loadAdapterModule(networkConfig.ecosystem);
  return def.createRuntime('composer', networkConfig, options);
}
