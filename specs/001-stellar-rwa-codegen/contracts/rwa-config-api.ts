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
 *   TokenConfig, IdentityVerificationConfig, ComplianceConfig,
 *   AccessControlConfig, DeploymentConfig, ClaimTopic, TrustedIssuer,
 *   ComplianceModuleSelection, OperatorRole
 */

// ---------------------------------------------------------------------------
// Token Configuration
// ---------------------------------------------------------------------------

export interface TokenConfig {
  /** Token name (max length enforced by each generator) */
  name: string;
  /** Token symbol (max length and charset enforced by each generator) */
  symbol: string;
  /** Decimal places (valid range enforced by each generator) */
  decimals: number;
  /** Initial supply as a bigint-compatible string (optional) */
  initialSupply?: string;
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
}

export interface TrustedIssuer {
  /** Blockchain address of the trusted issuer */
  address: string;
  /** Claim topic IDs this issuer is trusted for */
  claimTopics: number[];
}

export interface IdentityVerificationConfig {
  claimTopics: ClaimTopic[];
  trustedIssuers: TrustedIssuer[];
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

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/**
 * Well-known RWA role name → symbol mappings.
 * Chain-agnostic conventions used across all RWA systems.
 */
export declare const DEFAULT_ROLE_SYMBOLS: Record<string, string>;
