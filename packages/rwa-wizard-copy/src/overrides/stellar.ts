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
  'role.manager': {
    description:
      'Delegates day-to-day module configuration and hook wiring to a separate operator while the owner retains admin-only actions such as `set_compliance_address`.',
    infoCopy:
      'The manager role is the operational delegate for compliance modules, identity registry updates, and token operations that require `#[only_role(operator, "manager")]`. The contract admin (owner) keeps exclusive control of admin-gated actions like binding compliance addresses or transferring admin rights. Assign manager to a custody desk or automation account; keep admin on a higher-trust key.',
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
