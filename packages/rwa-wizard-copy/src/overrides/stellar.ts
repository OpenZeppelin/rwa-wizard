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
  'fieldHelper.address-list.placeholder': {
    description: 'G... or C... address',
  },
  'fieldHelper.address-list.bulk-placeholder': {
    description: 'G... or C... address (one per line, or comma-separated)',
  },
  'fieldHelper.owner-address.single-owner': {
    description:
      'Receives the admin role at deployment and is embedded in the generated deploy script. Use a Stellar CLI identity you control (`stellar keys generate <name> --fund`, then paste the G-address from `stellar keys address <name>`). Post-deploy configuration requires a signer for this address.',
  },
  'notice.review.before-deploy': {
    id: 'notice.review.before-deploy',
    description:
      'Generation does not deploy on-chain. On {networkDisplayName}, run `./scripts/build.sh`, set `STELLAR_ACCOUNT` to a funded CLI identity whose address matches the configured Admin, then run `./scripts/deploy.sh`. See README.md for the full quick start.',
  },
  'notice.review.deploy-signer-ack': {
    id: 'notice.review.deploy-signer-ack',
    description: 'I will use a Stellar CLI identity that controls the configured Admin address.',
  },
  'notice.review.identity-support-scaffolding': {
    id: 'notice.review.identity-support-scaffolding',
    title: 'Testnet identity scaffolding',
    description: 'Include testnet identity scaffolding (demo only, not production KYC).',
    infoCopy:
      '**How identity works:** Mints and transfers require each holder to have claims from a **trusted claim issuer** registered in CTI, an on-chain **identity contract** carrying those claims, and registration in IRS. The default export deploys CTI, IRS, and the Identity Verifier — not holder identity or issuer contracts.\n\n**What this enables:** Adds upstream **example** `contracts/claim-issuer` and `contracts/identity` crates, a `tools/sign-claim` helper for signing demo claims, and extra IRS helpers so you can exercise end-to-end testnet onboarding.\n\n**Limits:** Demo scaffolding only — not production KYC. It does not auto-onboard investors, auto-mint `initialSupply`, or replace your own claim-issuer infrastructure.',
  },
  'notice.generation.post-download': {
    id: 'notice.generation.post-download',
    title: 'After download',
    description:
      'Extract the archive and follow **README.md** for build, deploy, and troubleshooting.',
  },
} as const;
