import type { TargetCatalogEntry } from '../types/wizard';

/** Ordered target IDs for deterministic selector display. Stellar first, then future targets. */
export const TARGET_ORDER: string[] = ['stellar', 'evm'];

/** Feature overrides: enabled, showInUI, disabled labels. First iteration: stellar enabled, evm visible-disabled. */
const TARGET_OVERRIDES: Record<
  string,
  Partial<
    Pick<TargetCatalogEntry, 'enabled' | 'showInUI' | 'disabledLabel' | 'disabledDescription'>
  >
> = {
  stellar: {
    enabled: true,
    showInUI: true,
  },
  evm: {
    enabled: false,
    showInUI: true,
    disabledLabel: 'Coming Soon',
    disabledDescription: 'EVM target is not yet available in the wizard.',
  },
};

const BASE_ENTRIES: Record<string, Omit<TargetCatalogEntry, 'enabled' | 'showInUI'>> = {
  stellar: {
    id: 'stellar',
    name: 'Stellar',
    description: 'Stellar / Soroban RWA token project',
    icon: 'stellar',
    disabledLabel: undefined,
    disabledDescription: undefined,
    packageName: '@openzeppelin/codegen-rwa-stellar',
  },
  evm: {
    id: 'evm',
    name: 'EVM',
    description: 'Ethereum Virtual Machine (future)',
    icon: 'evm',
    disabledLabel: undefined,
    disabledDescription: undefined,
    packageName: '@openzeppelin/codegen-rwa-evm',
  },
};

function buildEntry(id: string): TargetCatalogEntry {
  const base = BASE_ENTRIES[id];
  if (!base) {
    return {
      id,
      name: id,
      description: '',
      icon: 'default',
      enabled: false,
      showInUI: false,
      packageName: '',
    };
  }
  const overrides = TARGET_OVERRIDES[id] ?? { enabled: false, showInUI: false };
  return {
    ...base,
    enabled: overrides.enabled ?? false,
    showInUI: overrides.showInUI ?? false,
    disabledLabel: overrides.disabledLabel ?? base.disabledLabel,
    disabledDescription: overrides.disabledDescription ?? base.disabledDescription,
  };
}

let cachedList: TargetCatalogEntry[] | null = null;

/**
 * Returns ordered target catalog entries for the selector.
 * Synchronous and safe on first render (contract: listTargets must be sync).
 */
export function listTargets(): TargetCatalogEntry[] {
  if (cachedList) return cachedList;
  cachedList = TARGET_ORDER.map(buildEntry).filter((e) => e.showInUI);
  return cachedList;
}

/**
 * Returns a single target by id, or undefined if unknown.
 */
export function getTarget(id: string): TargetCatalogEntry | undefined {
  return listTargets().find((t) => t.id === id);
}
