import { countryAllowModule } from './descriptors/country-allow';
import { countryRestrictModule } from './descriptors/country-restrict';
import { initialLockupPeriodModule } from './descriptors/initial-lockup-period';
import { maxBalanceModule } from './descriptors/max-balance';
import { supplyLimitModule } from './descriptors/supply-limit';
import { timeTransfersLimitsModule } from './descriptors/time-transfers-limits';
import { transferRestrictModule } from './descriptors/transfer-restrict';
import type {
  ComplianceModuleDescriptor,
  ComplianceModuleRegistryEntry,
} from './types';

export type {
  ComplianceModuleRegistryEntry,
  ModuleConfigField,
  ModuleReviewMeta,
  ModuleReviewState,
} from './types';

const COMPLIANCE_MODULE_DESCRIPTORS: readonly ComplianceModuleDescriptor[] = [
  supplyLimitModule,
  maxBalanceModule,
  countryRestrictModule,
  countryAllowModule,
  transferRestrictModule,
  initialLockupPeriodModule,
  timeTransfersLimitsModule,
];

function toRegistryEntry(descriptor: ComplianceModuleDescriptor): ComplianceModuleRegistryEntry {
  const { deployment: _deployment, ...entry } = descriptor;
  return entry;
}

function cloneRegistryEntry(entry: ComplianceModuleRegistryEntry): ComplianceModuleRegistryEntry {
  return {
    ...entry,
    requiredHooks: [...entry.requiredHooks],
    review: { ...entry.review },
    configFields: entry.configFields.map((field) => ({ ...field })),
  };
}

export const COMPLIANCE_MODULE_REGISTRY: ComplianceModuleRegistryEntry[] =
  COMPLIANCE_MODULE_DESCRIPTORS.map(toRegistryEntry);

const descriptorById = new Map(COMPLIANCE_MODULE_DESCRIPTORS.map((entry) => [entry.id, entry]));
const registryById = new Map(COMPLIANCE_MODULE_REGISTRY.map((entry) => [entry.id, entry]));

/**
 * Return the set of registered module identifiers.
 */
export function getRegisteredModuleIds(): Set<string> {
  return new Set(descriptorById.keys());
}

/**
 * Look up a full module descriptor including internal deployment behavior.
 */
export function getModuleDescriptorById(id: string): ComplianceModuleDescriptor | undefined {
  return descriptorById.get(id);
}

/**
 * Look up a compliance module by identifier.
 */
export function getModuleById(id: string): ComplianceModuleRegistryEntry | undefined {
  const entry = registryById.get(id);
  return entry ? cloneRegistryEntry(entry) : undefined;
}

/**
 * Return the full compliance module catalog in stable declaration order.
 */
export function getAvailableModules(): ComplianceModuleRegistryEntry[] {
  return COMPLIANCE_MODULE_REGISTRY.map(cloneRegistryEntry);
}
