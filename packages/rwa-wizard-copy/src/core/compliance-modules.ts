import type { ConceptDictionary } from '../types';

/**
 * Compliance module catalog — descriptions and per-field helper text for each
 * pluggable module. Module ids are the canonical T-REX module vocabulary;
 * field keys mirror the `ModuleConfigField.key` emitted by the codegen
 * package so the wizard can join them on the composite
 * `moduleField.<moduleId>.<fieldKey>` key at render time.
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
      'Enforces a hold period: freshly minted tokens cannot be transferred until the configured duration has elapsed. Commonly used for primary issuance to match regulatory holding requirements (e.g. Reg S distribution compliance periods).',
  },
  'moduleField.initial-lockup-period.lockupSeconds': {
    id: 'moduleField.initial-lockup-period.lockupSeconds',
    description:
      'How long each newly minted position is locked, in seconds. 1 day = 86 400, 30 days = 2 592 000, 1 year = 31 536 000.',
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
      'Hard cap on total circulating supply. `canCreate` vetoes mints that would exceed the cap; `created` and `destroyed` keep the tracked supply in sync with the outstanding balance.',
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
  'moduleField.time-transfers-limits.limitTime': {
    id: 'moduleField.time-transfers-limits.limitTime',
    description:
      'Length of the rolling window in seconds. 1 hour = 3 600, 1 day = 86 400, 1 week = 604 800.',
  },
  'moduleField.time-transfers-limits.limitValue': {
    id: 'moduleField.time-transfers-limits.limitValue',
    description:
      'Maximum cumulative outgoing volume allowed within the window, in the smallest token unit.',
  },

  'module.transfer-restrict': {
    id: 'module.transfer-restrict',
    description:
      'Pairwise allow-list: only transfers between wallet pairs explicitly approved by the compliance operator succeed. Typical for OTC desks, internal treasury movements, and closed investor circles.',
  },
} as const;
