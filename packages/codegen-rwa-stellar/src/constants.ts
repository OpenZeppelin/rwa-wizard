import { DEFAULT_ROLE_SYMBOLS } from '@openzeppelin/rwa-config';

/**
 * Stellar/Soroban-specific validation constraints.
 *
 * These constants define the limits imposed by the Soroban runtime
 * and the stellar-contracts library. Other chain generators (e.g., EVM)
 * would define their own constraints with different values.
 */
export const STELLAR_VALIDATION_CONSTANTS = {
  TOKEN_NAME_MAX_LENGTH: 32,
  TOKEN_SYMBOL_MAX_LENGTH: 12,
  DECIMALS_MIN: 0,
  DECIMALS_MAX: 18,
  /** Soroban `symbol_short!` macro limit */
  ROLE_SYMBOL_MAX_LENGTH: 9,
} as const;

export const STELLAR_CONTRACTS_GIT_URL = 'https://github.com/OpenZeppelin/stellar-contracts.git';
export const STELLAR_CONTRACTS_REPOSITORY_URL = 'https://github.com/OpenZeppelin/stellar-contracts';

export const STELLAR_CONTRACTS_COMMIT_HASH = 'e7722e4923accfd754991a56b3226e0a834c27a1';
export const STELLAR_CONTRACTS_VERSION = '0.7.1';
export const STELLAR_CONTRACTS_LICENSE = 'MIT';
export const STELLAR_CONTRACTS_AUTHORS = ['OpenZeppelin'] as const;

export const SOROBAN_SDK_VERSION = '25.3.0';

export const RUST_EDITION = '2021';

export const DEFAULT_TOKEN_VERSION = '1.0.0';

export const CRATE_NAMES = {
  rwaTtoken: 'rwa-token',
  compliance: 'compliance',
  identityVerifier: 'identity-verifier',
  claimTopicsIssuers: 'claim-topics-issuers',
  identityRegistryStorage: 'identity-registry-storage',
} as const;

export const WORKSPACE_CRATE_DEPS = [
  'stellar-tokens',
  'stellar-access',
  'stellar-macros',
  'stellar-contract-utils',
] as const;

export const WORKSPACE_CRATE_PACKAGE_PATHS: Record<(typeof WORKSPACE_CRATE_DEPS)[number], string> =
  {
    'stellar-tokens': 'tokens',
    'stellar-access': 'access',
    'stellar-macros': 'macros',
    'stellar-contract-utils': 'contract-utils',
  };

/**
 * Auto-generate a Soroban-compatible role symbol from a human-readable role name.
 *
 * Uses well-known RWA role mappings first, then falls back to:
 * lowercase → strip non-alphanumeric → truncate to Soroban's 9-char symbol_short! limit.
 */
export function generateRoleSymbol(name: string): string {
  const known = DEFAULT_ROLE_SYMBOLS[name.toLowerCase()];
  if (known) return known;

  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, STELLAR_VALIDATION_CONSTANTS.ROLE_SYMBOL_MAX_LENGTH);
}
