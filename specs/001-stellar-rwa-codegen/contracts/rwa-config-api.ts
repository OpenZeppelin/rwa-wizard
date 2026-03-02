/**
 * @openzeppelin/rwa-config — Public API Contract
 *
 * This file defines the public interface surface of the RWA configuration
 * package. It owns the canonical RWAConfig type consumed by all RWA
 * generators across chains.
 *
 * Primary exports (counted toward SC-007 ≤10 target):
 *   Types:    RWAConfig, ComplianceHook, OwnershipModel
 *   Constants: VALIDATION_CONSTANTS
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
  /** Token name, 1–32 characters */
  name: string;
  /** Token symbol, 1–12 characters, alphanumeric + hyphens */
  symbol: string;
  /** Decimal places, integer 0–18 */
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

export type ComplianceHook = 'transfer' | 'creation' | 'destruction';

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
  /** Soroban symbol, max 9 chars. Auto-generated from name if omitted. */
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
// Constants
// ---------------------------------------------------------------------------

export declare const VALIDATION_CONSTANTS: {
  TOKEN_NAME_MAX_LENGTH: 32;
  TOKEN_SYMBOL_MAX_LENGTH: 12;
  DECIMALS_MIN: 0;
  DECIMALS_MAX: 18;
  ROLE_SYMBOL_MAX_LENGTH: 9;
};
