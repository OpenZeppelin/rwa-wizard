import { CHAIN_IDS, getCopyForChain, isChainId } from '@openzeppelin/rwa-wizard-copy';

import type { TargetCatalogEntry } from '../types/wizard';

function targetCopy(id: string): { name?: string; description?: string } {
  if (!isChainId(id)) return {};
  const entry = getCopyForChain(id).target(id);
  return { name: entry.title, description: entry.description };
}

/**
 * Ordered target IDs for deterministic selector display. Re-exported from
 * the copy package's {@link CHAIN_IDS} — the single source of truth for
 * which chain families the wizard supports.
 */
export const TARGET_ORDER: readonly string[] = CHAIN_IDS;

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

type StructuralTargetEntry = Omit<
  TargetCatalogEntry,
  'enabled' | 'showInUI' | 'name' | 'description'
>;

/**
 * Structural-only registry for the target selector. UI prose (display name,
 * tagline) is merged in from `@openzeppelin/rwa-wizard-copy` so chains can
 * evolve their wording without editing this file.
 */
const BASE_ENTRIES: Record<string, StructuralTargetEntry> = {
  stellar: {
    id: 'stellar',
    icon: 'stellar',
    disabledLabel: undefined,
    disabledDescription: undefined,
    packageName: '@openzeppelin/codegen-rwa-stellar',
  },
  evm: {
    id: 'evm',
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
  const copy = targetCopy(id);
  return {
    ...base,
    name: copy.name ?? id,
    description: copy.description ?? '',
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
