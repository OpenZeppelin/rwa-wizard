import type { ConceptOverride } from '../types';

/**
 * Stellar-specific patches over the chain-neutral core.
 *
 * The `target.*` entry is genuinely chain-specific — a target *is* a chain —
 * and is the canonical place where Stellar branding lives. Add more entries
 * only when Stellar/Soroban phrasing is *genuinely more helpful* than the
 * chain-neutral version (e.g. ledger-based units, Soroban-specific hook names,
 * or a contract entry point). The `no-chain-leak` test prevents that drift
 * from creeping into `core/`.
 */
export const STELLAR_OVERRIDE: ConceptOverride = {
  'target.stellar': {
    title: 'Stellar',
    description: 'Stellar / Soroban RWA token project',
  },
  'moduleField.initial-lockup-period.lockupPeriodLedgers': {
    description:
      'How long each newly minted position is locked, measured in ledgers. At roughly 5 seconds per ledger, 1 day is about 17 280 ledgers.',
  },
  'moduleField.time-transfers-limits.limitDurationLedgers': {
    description:
      'Length of the rolling window in ledgers. At roughly 5 seconds per ledger, 1 day is about 17 280 ledgers.',
  },
} as const;
