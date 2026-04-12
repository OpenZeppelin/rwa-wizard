import type { StellarComplianceHook } from '../ecosystem-metadata';

// ---------------------------------------------------------------------------
// Review-state metadata
// ---------------------------------------------------------------------------

export type ModuleReviewState = 'stable' | 'under-review';

export interface ModuleReviewMeta {
  state: ModuleReviewState;
  prUrl?: string;
}

// ---------------------------------------------------------------------------
// Config field descriptor for module-specific parameters
// ---------------------------------------------------------------------------

export interface ModuleConfigField {
  key: string;
  label: string;
  type: 'number' | 'string' | 'string[]';
  required: boolean;
  placeholder?: string;
  hint?: string;
}

// ---------------------------------------------------------------------------
// Registry entry
// ---------------------------------------------------------------------------

export interface ComplianceModuleRegistryEntry {
  id: string;
  name: string;
  description: string;
  requiredHooks: StellarComplianceHook[];
  /** Crate name used in generated Cargo.toml / wasm filenames */
  crateName: string;
  review: ModuleReviewMeta;
  configFields: ModuleConfigField[];
}

// ---------------------------------------------------------------------------
// Registry data
// ---------------------------------------------------------------------------

const PR_650 = 'https://github.com/OpenZeppelin/stellar-contracts/pull/650';
const PR_651 = 'https://github.com/OpenZeppelin/stellar-contracts/pull/651';
const PR_652 = 'https://github.com/OpenZeppelin/stellar-contracts/pull/652';

export const COMPLIANCE_MODULE_REGISTRY: ComplianceModuleRegistryEntry[] = [
  {
    id: 'supply-limit',
    name: 'Supply Limit',
    description: 'Enforces a maximum total supply for the token',
    requiredHooks: ['canCreate', 'created', 'destroyed'],
    crateName: 'supply-limit',
    review: { state: 'under-review', prUrl: PR_650 },
    configFields: [
      {
        key: 'limit',
        label: 'Supply Limit',
        type: 'number',
        required: true,
        placeholder: 'e.g. 1000000',
        hint: 'Maximum total supply (in smallest token units)',
      },
    ],
  },
  {
    id: 'max-balance',
    name: 'Max Balance',
    description: 'Limits the maximum token balance per identity',
    requiredHooks: ['canTransfer', 'canCreate', 'transferred', 'created', 'destroyed'],
    crateName: 'max-balance',
    review: { state: 'under-review', prUrl: PR_650 },
    configFields: [
      {
        key: 'maxBalance',
        label: 'Max Balance',
        type: 'number',
        required: true,
        placeholder: 'e.g. 50000',
        hint: 'Maximum token balance per identity (in smallest token units)',
      },
    ],
  },
  {
    id: 'country-restrict',
    name: 'Country Restriction',
    description: 'Blocks transfers to holders from restricted countries',
    requiredHooks: ['canTransfer'],
    crateName: 'country-restrict',
    review: { state: 'under-review', prUrl: PR_651 },
    configFields: [
      {
        key: 'restrictedCountries',
        label: 'Restricted Countries',
        type: 'string[]',
        required: false,
        placeholder: 'e.g. US, KP',
        hint: 'ISO 3166-1 alpha-2 country codes to restrict (configured post-deploy via IRS)',
      },
    ],
  },
  {
    id: 'country-allow',
    name: 'Country Allow-list',
    description: 'Only allows transfers to holders from approved countries',
    requiredHooks: ['canTransfer'],
    crateName: 'country-allow',
    review: { state: 'under-review', prUrl: PR_651 },
    configFields: [
      {
        key: 'allowedCountries',
        label: 'Allowed Countries',
        type: 'string[]',
        required: false,
        placeholder: 'e.g. CH, SG',
        hint: 'ISO 3166-1 alpha-2 country codes to allow (configured post-deploy via IRS)',
      },
    ],
  },
  {
    id: 'transfer-restrict',
    name: 'Transfer Restriction',
    description: 'Blocks transfers between specific wallet pairs',
    requiredHooks: ['canTransfer'],
    crateName: 'transfer-restrict',
    review: { state: 'under-review', prUrl: PR_651 },
    configFields: [],
  },
  {
    id: 'initial-lockup-period',
    name: 'Initial Lockup Period',
    description: 'Locks minted tokens for a configurable period before they become transferable',
    requiredHooks: ['canTransfer', 'created', 'transferred', 'destroyed'],
    crateName: 'initial-lockup-period',
    review: { state: 'under-review', prUrl: PR_652 },
    configFields: [
      {
        key: 'lockupSeconds',
        label: 'Lockup Duration (seconds)',
        type: 'number',
        required: true,
        placeholder: 'e.g. 2592000',
        hint: 'Number of seconds tokens are locked after minting (30 days = 2592000)',
      },
    ],
  },
  {
    id: 'time-transfers-limits',
    name: 'Time-based Transfer Limits',
    description: 'Limits the volume of tokens an identity can transfer within rolling time windows',
    requiredHooks: ['canTransfer', 'transferred'],
    crateName: 'time-transfers-limits',
    review: { state: 'under-review', prUrl: PR_652 },
    configFields: [
      {
        key: 'limitTime',
        label: 'Window Duration (seconds)',
        type: 'number',
        required: true,
        placeholder: 'e.g. 86400',
        hint: 'Rolling time window in seconds (1 day = 86400)',
      },
      {
        key: 'limitValue',
        label: 'Transfer Limit',
        type: 'number',
        required: true,
        placeholder: 'e.g. 100000',
        hint: 'Maximum transfer volume within the time window (in smallest token units)',
      },
    ],
  },
];

const registryById = new Map(COMPLIANCE_MODULE_REGISTRY.map((e) => [e.id, e]));

export function getRegisteredModuleIds(): Set<string> {
  return new Set(registryById.keys());
}

export function getModuleById(id: string): ComplianceModuleRegistryEntry | undefined {
  return registryById.get(id);
}

export function getAvailableModules(): ComplianceModuleRegistryEntry[] {
  return [...COMPLIANCE_MODULE_REGISTRY];
}
