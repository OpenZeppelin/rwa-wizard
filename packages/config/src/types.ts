// ---------------------------------------------------------------------------
// Token Configuration
// ---------------------------------------------------------------------------

export interface AdministrativeControls {
  burnable: boolean;
  mintable: boolean;
  pausable: boolean;
}

export interface TokenConfig {
  /** Token name (max length enforced by each generator) */
  name: string;
  /** Token symbol (max length and charset enforced by each generator) */
  symbol: string;
  /** Decimal places (valid range enforced by each generator) */
  decimals: number;
  /** Initial supply as a bigint-compatible string (optional) */
  initialSupply?: string;
  /** Administrative controls (burnable, mintable, pausable) */
  administrativeControls: AdministrativeControls;
  /** Document management extension toggle */
  documentManager: {
    enabled: boolean;
  };
}

// ---------------------------------------------------------------------------
// Identity Verification
// ---------------------------------------------------------------------------

export interface ClaimTopic {
  /** Unique positive integer identifier */
  id: number;
  /** Human-readable label */
  name: string;
  /** Whether this topic was added by the user (not predefined) */
  isCustom?: boolean;
}

export interface TrustedIssuer {
  /** Blockchain address of the trusted issuer */
  address: string;
  /** Claim topic IDs this issuer is trusted for */
  claimTopics: number[];
}

export interface IdentityControls {
  addressFreezing: boolean;
  partialTokenFreezing: boolean;
  recovery: boolean;
  forcedTransfers: boolean;
}

export interface IdentityVerificationConfig {
  claimTopics: ClaimTopic[];
  trustedIssuers: TrustedIssuer[];
  controls: IdentityControls;
}

// ---------------------------------------------------------------------------
// Compliance
// ---------------------------------------------------------------------------

/**
 * Opaque hook identifier — each ecosystem defines its own valid values.
 * Stellar: 'canTransfer' | 'canCreate' | 'transferred' | 'created' | 'destroyed'
 * EVM T-REX: 'canTransfer' | 'transferred' | 'created' | 'destroyed'
 */
export type ComplianceHook = string;

export interface ComplianceModuleSelection {
  /** Registry identifier of the compliance module */
  moduleId: string;
  /** Which hook to attach the module to */
  hook: ComplianceHook;
  /** Module-specific configuration parameters */
  config?: Record<string, unknown>;
}

export interface ComplianceConfig {
  modules: ComplianceModuleSelection[];
}

// ---------------------------------------------------------------------------
// Access Control
// ---------------------------------------------------------------------------

export type OwnershipModel =
  | { type: 'single-owner'; ownerAddress: string }
  | { type: 'multi-sig'; address: string }
  | { type: 'dao'; address: string };

export interface OperatorRole {
  /** Human-readable role name */
  name: string;
  /** Chain-specific symbol. Max length defined by each generator. Auto-generated from name if omitted. */
  symbol?: string;
  /** Accounts granted this role at deploy time */
  addresses: string[];
}

export interface AccessControlConfig {
  ownership: OwnershipModel;
  roles: OperatorRole[];
}

// ---------------------------------------------------------------------------
// Deployment
// ---------------------------------------------------------------------------

export interface DeploymentConfig {
  /** Target network: "testnet", "mainnet", or custom RPC URL */
  network: string;
  /** Deployer account (optional, defaults to CLI signer) */
  sourceAccount?: string;
}

// ---------------------------------------------------------------------------
// Root Configuration
// ---------------------------------------------------------------------------

export interface RWAConfig {
  token: TokenConfig;
  identityVerification: IdentityVerificationConfig;
  compliance: ComplianceConfig;
  accessControl: AccessControlConfig;
  deployment: DeploymentConfig;
}
