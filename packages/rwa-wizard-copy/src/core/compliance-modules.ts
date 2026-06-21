import type { ConceptDictionary } from '../types';

/**
 * Compliance module catalog — descriptions and per-field helper text for each
 * pluggable module. Module ids are the canonical T-REX module vocabulary;
 * field keys mirror the `ModuleConfigField.key` emitted by the codegen
 * package so the wizard can join them on the composite
 * `moduleField.<moduleId>.<fieldKey>` key at render time.
 *
 * Keep this core copy chain-neutral. Units or runtime details that only make
 * sense for one target (for example ledger counts) belong in
 * `overrides/<chain>.ts`, even if the field key itself is emitted by that
 * chain's codegen package.
 */
export const COMPLIANCE_MODULES_COPY: ConceptDictionary = {
  'module.country-allow': {
    id: 'module.country-allow',
    description:
      'Whitelist jurisdictions: a transfer or mint is allowed only when the recipient’s country (recorded in the identity registry) is on the allow-list.',
    infoCopy:
      'Registered on the `transferred` and `created` hooks. Requires recipient country data in the identity registry before rules can pass at runtime.',
  },
  'moduleField.country-allow.allowedCountries': {
    id: 'moduleField.country-allow.allowedCountries',
    description:
      'ISO 3166-1 alpha-2 country codes written to the module during post-deploy configuration.',
  },

  'module.country-restrict': {
    id: 'module.country-restrict',
    description:
      'Blacklist jurisdictions: a transfer or mint is blocked when the recipient’s country (recorded in the identity registry) appears on the restricted list.',
    infoCopy:
      'Registered on the `transferred` and `created` hooks. Inverse of Country Allow-list — verify the two lists do not contradict your policy.',
  },
  'moduleField.country-restrict.restrictedCountries': {
    id: 'moduleField.country-restrict.restrictedCountries',
    description:
      'ISO 3166-1 alpha-2 country codes written to the module during post-deploy configuration.',
  },

  'module.initial-lockup-period': {
    id: 'module.initial-lockup-period',
    description:
      'Enforces a hold period after tokens are created: positions recorded by the module cannot be transferred until the configured duration elapses.',
    infoCopy:
      'Uses `created` to open a lock, `transferred` to enforce it, and `destroyed` to keep lock accounting consistent when tokens are burned.',
  },

  'module.max-balance': {
    id: 'module.max-balance',
    description:
      'Per-identity ownership cap. Blocks transfers or mints that would push the recipient above the configured ceiling — useful for concentration limits and retail caps.',
    infoCopy:
      'Tracks balances per ONCHAINID across the `transferred`, `created`, and `destroyed` hooks, so multiple wallets for the same investor share one bucket. Requires identity registry data at runtime.\n\nThere is no special exemption for Admin or treasury: if you mint tokens to your own institution’s wallet, that wallet must stay under the cap too. Use a higher cap for large treasury holdings, mint in tranches, or distribute across multiple recipients.',
  },
  'moduleField.max-balance.maxBalance': {
    id: 'moduleField.max-balance.maxBalance',
    description:
      'Maximum balance any single identity may hold, in the smallest token unit (scaled by your configured decimals).',
  },

  'module.supply-limit': {
    id: 'module.supply-limit',
    description:
      'Hard cap on total circulating supply enforced through the `created` and `destroyed` hooks.',
    infoCopy:
      'Mints increment tracked supply on `created`; burns decrement it on `destroyed`. Does not inspect individual transfer parties.',
  },
  'moduleField.supply-limit.limit': {
    id: 'moduleField.supply-limit.limit',
    description:
      'Maximum total supply, expressed in the smallest token unit (scaled by your configured decimals).',
  },

  'module.time-transfers-limits': {
    id: 'module.time-transfers-limits',
    description:
      'Throttles outgoing transfer volume per identity within a rolling time window — useful for velocity checks and cooling-off rules.',
    infoCopy:
      'Enforced only on the `transferred` hook. Requires identity registry linkage so outgoing volume can be attributed to an investor identity.',
  },
  'moduleField.time-transfers-limits.limitValue': {
    id: 'moduleField.time-transfers-limits.limitValue',
    description:
      'Maximum cumulative outgoing volume allowed within the window, in the smallest token unit.',
  },

  'module.transfer-allow': {
    id: 'module.transfer-allow',
    description:
      'Account allow-list enforced on the `transferred` hook — only listed accounts may send or receive peer transfers.',
    infoCopy:
      'Does not attach to `created` or `destroyed`. Mint and burn paths are governed by other modules and token roles. You can leave the list empty at generation time and populate it later on-chain.',
  },
  'moduleField.transfer-allow.allowedUsers': {
    id: 'moduleField.transfer-allow.allowedUsers',
    description:
      'Investor or operating account addresses seeded during post-deploy configuration. Leave empty to manage the allow-list later through the module contract.',
  },
} as const;
