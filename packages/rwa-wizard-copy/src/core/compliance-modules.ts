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
      'Whitelist jurisdictions: a transfer succeeds only if the recipient’s country (recorded in the Identity Registry Storage) is on the allow-list. Useful when a regulator permits distribution in a specific set of countries.',
  },
  'moduleField.country-allow.allowedCountries': {
    id: 'moduleField.country-allow.allowedCountries',
    description:
      'ISO 3166-1 alpha-2 country codes. The list is written to the module post-deploy; the module reads recipient country from the Identity Registry Storage.',
  },

  'module.country-restrict': {
    id: 'module.country-restrict',
    description:
      'Blacklist jurisdictions: a transfer is blocked if the recipient’s country (recorded in the Identity Registry Storage) appears in the restricted list. Inverse of Country Allow-list.',
  },
  'moduleField.country-restrict.restrictedCountries': {
    id: 'moduleField.country-restrict.restrictedCountries',
    description:
      'ISO 3166-1 alpha-2 country codes. The list is written to the module post-deploy; recipient country is read from the Identity Registry Storage.',
  },

  'module.initial-lockup-period': {
    id: 'module.initial-lockup-period',
    description:
      'Enforces a hold period: freshly minted tokens cannot be transferred until the configured duration has elapsed. Commonly used for primary issuance to match regulatory holding requirements.',
  },

  'module.max-balance': {
    id: 'module.max-balance',
    description:
      'Per-identity ownership cap. Blocks any transfer or mint that would push the recipient’s balance above the configured ceiling — useful for concentration limits and retail caps. The cap is tracked per ONCHAINID, so multiple wallets owned by the same investor share the same bucket.',
  },
  'moduleField.max-balance.maxBalance': {
    id: 'moduleField.max-balance.maxBalance',
    description:
      'Maximum balance any single identity may hold, in the smallest token unit (scaled by your configured decimals).',
  },

  'module.supply-limit': {
    id: 'module.supply-limit',
    description:
      'Hard cap on total circulating supply. The module checks mints through the `created` hook and tracks burns through `destroyed`.',
  },
  'moduleField.supply-limit.limit': {
    id: 'moduleField.supply-limit.limit',
    description:
      'Maximum total supply, expressed in the smallest token unit (scaled by your configured decimals).',
  },

  'module.time-transfers-limits': {
    id: 'module.time-transfers-limits',
    description:
      'Throttles outgoing volume per identity within a rolling time window (e.g. no more than N tokens sent in any 24h period). Useful for anti-money-laundering velocity checks and retail cooling-off rules.',
  },
  'moduleField.time-transfers-limits.limitValue': {
    id: 'moduleField.time-transfers-limits.limitValue',
    description:
      'Maximum cumulative outgoing volume allowed within the window, in the smallest token unit.',
  },

  'module.transfer-allow': {
    id: 'module.transfer-allow',
    description:
      'User allow-list: only approved accounts can receive, send, mint, or burn tokens when this module is attached. Typical for closed investor circles and manually approved operating accounts.',
  },
  'moduleField.transfer-allow.allowedUsers': {
    id: 'moduleField.transfer-allow.allowedUsers',
    description:
      'Account addresses to allow during post-deploy configuration. You can leave this empty and manage the allow-list later with the module contract.',
  },
} as const;
