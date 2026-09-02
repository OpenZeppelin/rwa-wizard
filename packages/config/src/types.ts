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
  /**
   * Whether this topic is part of the configuration to be deployed.
   *
   * Absence and `true` both mean selected; only an explicit `false` means
   * "defined but not selected". Ask through `isClaimTopicSelected` rather than
   * testing this property inline, so the three input states are collapsed in
   * exactly one place.
   *
   * Producers MUST omit the field when a topic is selected rather than writing
   * `true`, and re-selecting MUST delete the key: `config.json` is
   * `JSON.stringify` of this object, so an explicitly written `true` moves
   * generated output on every draft that has topics, and ZIP output must be
   * deterministic from a given `RWAConfig` — two drafts differing only in an
   * unwritten default must produce identical bytes.
   *
   * The omit-when-true rule protects `config.json`'s BYTES. It says nothing
   * about provenance output: a recording reader records a read of an absent key,
   * so any selection walk records one path per topic whether the field is
   * written or not.
   *
   * Selection is authoring state with no on-chain counterpart — ERC-3643's
   * `ClaimTopicsRegistry` exposes only `addClaimTopic` / `removeClaimTopic` and
   * has no inactive state. Generators project it away; they never persist it
   * into an artefact the deployment reads.
   */
  selected?: boolean;
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
 * Keep this type chain-agnostic; generator packages own their hook vocabulary.
 */
export type ComplianceHook = string;

/**
 * A selected compliance module with optional module-specific configuration.
 *
 * The module's required hooks are derived from the registry at generation
 * time — they are NOT stored in the config.  The config is purely
 * "which modules did the user pick and with what parameters".
 */
export interface ComplianceModuleSelection {
  /** Registry identifier of the compliance module */
  moduleId: string;
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
