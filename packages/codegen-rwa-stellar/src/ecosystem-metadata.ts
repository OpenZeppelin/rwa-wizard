// ---------------------------------------------------------------------------
// Stellar-specific compliance hook type
// ---------------------------------------------------------------------------

/**
 * The 5 compliance hooks in the Stellar/Soroban `ComplianceHook` enum.
 * Maps 1:1 to the Rust `ComplianceHook` variants in `stellar-contracts`.
 *
 * Pre-checks (read-only, called before the action):
 *   - `canTransfer` — validates before transfer
 *   - `canCreate`   — validates before mint
 *
 * Post-hooks (state-modifying, called after the action):
 *   - `transferred` — notified after transfer
 *   - `created`     — notified after mint
 *   - `destroyed`   — notified after burn
 */
export type StellarComplianceHook =
  | 'canTransfer'
  | 'canCreate'
  | 'transferred'
  | 'created'
  | 'destroyed';

// ---------------------------------------------------------------------------
// Administrative Controls — Stellar/Soroban ecosystem
// ---------------------------------------------------------------------------

export interface StellarAdminControlMeta {
  id: string;
  name: string;
  description: string;
  locked: boolean;
  defaultValue: boolean;
}

export const STELLAR_ADMIN_CONTROLS: readonly StellarAdminControlMeta[] = [
  {
    id: 'burnable',
    name: 'Burnable',
    description: 'Enable token burning for token supply management',
    locked: true,
    defaultValue: true,
  },
  {
    id: 'mintable',
    name: 'Mintable',
    description: 'Enable token minting for token supply management',
    locked: true,
    defaultValue: true,
  },
  {
    id: 'pausable',
    name: 'Pausable',
    description: 'Enable pausable functionality for emergency situations and security incidents',
    locked: true,
    defaultValue: true,
  },
] as const;

// ---------------------------------------------------------------------------
// Identity Controls — Stellar/Soroban ecosystem
// ---------------------------------------------------------------------------

export const STELLAR_IDENTITY_CONTROLS: readonly StellarAdminControlMeta[] = [
  {
    id: 'addressFreezing',
    name: 'Address-Level Freezing',
    description: 'Full address freezing for regulatory compliance and sanctions',
    locked: true,
    defaultValue: true,
  },
  {
    id: 'partialTokenFreezing',
    name: 'Partial Token Freezing',
    description: 'Partial token freezing for dispute resolution and escrow',
    locked: true,
    defaultValue: true,
  },
  {
    id: 'recovery',
    name: 'Account Recovery',
    description: 'Lost wallet recovery for verified investors',
    locked: true,
    defaultValue: true,
  },
  {
    id: 'forcedTransfers',
    name: 'Forced Transfers',
    description: 'Regulatory transfers for court orders and regulatory intervention',
    locked: true,
    defaultValue: true,
  },
] as const;

// ---------------------------------------------------------------------------
// Predefined Operator Roles — Stellar/Soroban ecosystem
// ---------------------------------------------------------------------------

export interface StellarOperatorRoleMeta {
  id: string;
  name: string;
  description: string;
}

export const STELLAR_OPERATOR_ROLES: readonly StellarOperatorRoleMeta[] = [
  { id: 'minter', name: 'Minting', description: 'Can mint new tokens' },
  { id: 'burner', name: 'Burning', description: 'Can burn existing tokens' },
  { id: 'freezer', name: 'Freezing', description: 'Can freeze addresses' },
  { id: 'partial-freezer', name: 'Partial Freezing', description: 'Can freeze partial tokens' },
  {
    id: 'forced-transfer',
    name: 'Forced Transfers',
    description: 'Can execute forced transfers',
  },
  { id: 'recovery', name: 'Recovery', description: 'Can perform recovery operations' },
  { id: 'pauser', name: 'Pausing', description: 'Can pause contract operations' },
  { id: 'compliance', name: 'Compliance', description: 'Can manage compliance settings' },
  { id: 'identity', name: 'Identity', description: 'Can manage identity verification' },
  {
    id: 'document-manager',
    name: 'Document Management',
    description: 'Can manage token documents',
  },
] as const;

// ---------------------------------------------------------------------------
// Compliance Hook Metadata — Stellar/Soroban ecosystem
// ---------------------------------------------------------------------------

export interface StellarComplianceHookMeta {
  hook: StellarComplianceHook;
  displayName: string;
  description: string;
}

export const STELLAR_COMPLIANCE_HOOKS: readonly StellarComplianceHookMeta[] = [
  {
    hook: 'canTransfer',
    displayName: 'Can Transfer',
    description: 'Validation before transfer (e.g., transfer limits, whitelist)',
  },
  {
    hook: 'canCreate',
    displayName: 'Can Create',
    description: 'Validation before minting (e.g., supply caps, investor limits)',
  },
  {
    hook: 'transferred',
    displayName: 'Transferred',
    description: 'State update after transfer (e.g., balance tracking, transfer counting)',
  },
  {
    hook: 'created',
    displayName: 'Created',
    description: 'State update after minting (e.g., supply tracking, investor counting)',
  },
  {
    hook: 'destroyed',
    displayName: 'Destroyed',
    description: 'State update after burning (e.g., supply tracking, investor counting)',
  },
] as const;

// ---------------------------------------------------------------------------
// Ecosystem limits
// ---------------------------------------------------------------------------

/** Maximum modules attachable to a single compliance hook */
export const STELLAR_MAX_MODULES_PER_HOOK = 20;

/** Maximum trusted issuers per configuration */
export const STELLAR_MAX_TRUSTED_ISSUERS = 50;

// ---------------------------------------------------------------------------
// Aggregated metadata accessor
// ---------------------------------------------------------------------------

export interface StellarEcosystemMetadata {
  administrativeControls: readonly StellarAdminControlMeta[];
  identityControls: readonly StellarAdminControlMeta[];
  operatorRoles: readonly StellarOperatorRoleMeta[];
  complianceHooks: readonly StellarComplianceHookMeta[];
  limits: {
    maxModulesPerHook: number;
    maxTrustedIssuers: number;
  };
}

export function getEcosystemMetadata(): StellarEcosystemMetadata {
  return {
    administrativeControls: STELLAR_ADMIN_CONTROLS,
    identityControls: STELLAR_IDENTITY_CONTROLS,
    operatorRoles: STELLAR_OPERATOR_ROLES,
    complianceHooks: STELLAR_COMPLIANCE_HOOKS,
    limits: {
      maxModulesPerHook: STELLAR_MAX_MODULES_PER_HOOK,
      maxTrustedIssuers: STELLAR_MAX_TRUSTED_ISSUERS,
    },
  };
}
