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
