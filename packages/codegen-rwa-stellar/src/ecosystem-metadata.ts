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
// Administrative + Identity Controls — Stellar/Soroban ecosystem
// ---------------------------------------------------------------------------

/**
 * Structural facts about an administrative / identity control on Stellar.
 *
 * User-facing copy (description, tooltip prose) intentionally lives outside
 * this package — see `@openzeppelin/rwa-wizard-copy` — and is joined by the
 * wizard app at render time keyed on `id`. Keeping codegen narrow means
 * downstream consumers (CLI, programmatic) don't ship UI prose they do not
 * need.
 */
export interface StellarAdminControlMeta {
  id: string;
  name: string;
  locked: boolean;
  defaultValue: boolean;
}

export const STELLAR_ADMIN_CONTROLS: readonly StellarAdminControlMeta[] = [
  { id: 'burnable', name: 'Burnable', locked: true, defaultValue: true },
  { id: 'mintable', name: 'Mintable', locked: true, defaultValue: true },
  { id: 'pausable', name: 'Pausable', locked: true, defaultValue: true },
] as const;

export const STELLAR_IDENTITY_CONTROLS: readonly StellarAdminControlMeta[] = [
  { id: 'addressFreezing', name: 'Address-Level Freezing', locked: true, defaultValue: true },
  {
    id: 'partialTokenFreezing',
    name: 'Partial Token Freezing',
    locked: true,
    defaultValue: true,
  },
  { id: 'recovery', name: 'Account Recovery', locked: true, defaultValue: true },
  { id: 'forcedTransfers', name: 'Forced Transfers', locked: true, defaultValue: true },
] as const;

// ---------------------------------------------------------------------------
// Predefined Operator Roles — Stellar/Soroban ecosystem
// ---------------------------------------------------------------------------

/**
 * Structural facts about an RBAC operator role. `id` is the stable key used
 * both as the on-chain RBAC role constant and as the join key into
 * `@openzeppelin/rwa-wizard-copy`. `name` is the short display label; longer
 * educational copy lives in the copy package.
 */
export interface StellarOperatorRoleMeta {
  id: string;
  name: string;
}

export const STELLAR_OPERATOR_ROLES: readonly StellarOperatorRoleMeta[] = [
  { id: 'minter', name: 'Minting' },
  { id: 'burner', name: 'Burning' },
  { id: 'freezer', name: 'Freezing' },
  { id: 'partial-freezer', name: 'Partial Freezing' },
  { id: 'forced-transfer', name: 'Forced Transfers' },
  { id: 'recovery', name: 'Recovery' },
  { id: 'pauser', name: 'Pausing' },
  { id: 'compliance', name: 'Compliance' },
  { id: 'identity', name: 'Identity' },
  { id: 'document-manager', name: 'Document Management' },
] as const;

// ---------------------------------------------------------------------------
// Compliance Hook Metadata — Stellar/Soroban ecosystem
// ---------------------------------------------------------------------------

/**
 * Structural facts about a compliance hook. `displayName` is the short label
 * rendered in the hook-wiring preview; longer explanatory prose lives in the
 * copy package keyed on `hook.<hook>`.
 */
export interface StellarComplianceHookMeta {
  hook: StellarComplianceHook;
  displayName: string;
}

export const STELLAR_COMPLIANCE_HOOKS: readonly StellarComplianceHookMeta[] = [
  { hook: 'canTransfer', displayName: 'Can Transfer (pre-check)' },
  { hook: 'canCreate', displayName: 'Can Create (pre-check)' },
  { hook: 'transferred', displayName: 'Transferred (post-state)' },
  { hook: 'created', displayName: 'Created (post-state)' },
  { hook: 'destroyed', displayName: 'Destroyed (post-state)' },
] as const;

/**
 * Serialize a hook id into the enum case name exposed by the contract CLI.
 *
 * Keep the lower-camel hook ids as the internal TS-facing vocabulary, and
 * convert only at the CLI boundary where Soroban expects Rust enum case names.
 */
export function serializeStellarComplianceHookForCli(hook: StellarComplianceHook): string {
  return hook.slice(0, 1).toUpperCase() + hook.slice(1);
}

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
