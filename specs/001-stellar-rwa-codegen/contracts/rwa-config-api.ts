/**
 * @openzeppelin/rwa-config — Public API Contract
 *
 * This file defines the public interface surface of the RWA configuration
 * package. It owns the canonical RWAConfig type consumed by all RWA
 * generators across chains.
 *
 * IMPORTANT: This package is strictly chain-agnostic and consumer-agnostic.
 * It defines ONLY the type shape of an RWA configuration. Validation
 * constraints (max lengths, numeric ranges, etc.) are chain-specific and
 * belong in each generator package (e.g., STELLAR_VALIDATION_CONSTANTS
 * in @openzeppelin/codegen-rwa-stellar).
 *
 * Primary exports (counted toward SC-007 ≤10 target):
 *   Types:     RWAConfig, ComplianceHook (string alias), OwnershipModel
 *   Constants: DEFAULT_ROLE_SYMBOLS
 *   Total: 4 primary exports
 *
 * Supporting types (not counted individually — sub-types of RWAConfig):
 *   AdministrativeControls, TokenConfig, IdentityControls, IdentityVerificationConfig, ComplianceConfig,
 *   AccessControlConfig, DeploymentConfig, DeploymentTarget,
 *   PresetDeploymentTarget, CustomDeploymentTarget,
 *   ClaimTopic, TrustedIssuer, ComplianceModuleSelection, OperatorRole
 */

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
  /**
   * Module-specific configuration parameters (e.g., limit for supply-limit).
   * Required fields are defined by the module registry's configFields schema.
   * Hooks are derived from registry metadata — not specified here.
   */
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
  /** Chain-specific symbol. Max length is defined by each generator. Auto-generated from name if omitted. */
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

export interface PresetDeploymentTarget {
  /** Resolve a named network from the adapter layer */
  kind: 'preset';
  /** Ecosystem identifier, e.g. "stellar" */
  ecosystem: string;
  /** Adapter-defined network identifier, e.g. "stellar-testnet" */
  networkId: string;
}

export interface CustomDeploymentTarget {
  /** Use a custom RPC target instead of an adapter preset */
  kind: 'custom';
  /** Ecosystem identifier, e.g. "stellar" */
  ecosystem: string;
  /** RPC URL used by the generator/deploy scripts */
  rpcUrl: string;
  /** Optional explorer base URL used for generated display links */
  explorerUrl?: string;
  /** Optional human-readable label shown in generated output */
  label?: string;
}

export type DeploymentTarget = PresetDeploymentTarget | CustomDeploymentTarget;

export interface DeploymentConfig {
  /** Target network reference or custom RPC target */
  target: DeploymentTarget;
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

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/**
 * Well-known RWA role name → symbol mappings.
 * Chain-agnostic conventions used across all RWA systems.
 */
export declare const DEFAULT_ROLE_SYMBOLS: Record<string, string>;
