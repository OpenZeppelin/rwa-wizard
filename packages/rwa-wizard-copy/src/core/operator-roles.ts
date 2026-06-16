import type { ConceptDictionary } from '../types';

/**
 * Predefined operator roles — the role-based access control vocabulary
 * shared by every T-REX deployment. Role ids match the RBAC constants
 * emitted by codegen; call sites join these entries keyed on `role.<id>`.
 */
export const OPERATOR_ROLES_COPY: ConceptDictionary = {
  'role.minter': {
    id: 'role.minter',
    description:
      'Issues new tokens to verified investors. Used for primary issuance after the recipient has an ONCHAINID with the required claims.',
    infoCopy:
      'Grants the authority to call `mint` on the token. Every mint runs through the `created` compliance hook in the same transaction, so eligibility, supply caps, and investor caps still apply atomically. Keep minters tightly scoped — primary-issuance desks, transfer agents, or a custody operator acting on subscription orders.',
  },
  'role.burner': {
    id: 'role.burner',
    description:
      'Retires tokens from a holder’s balance (e.g. redemption, share buy-back). Passes through compliance hooks.',
    infoCopy:
      'Grants the authority to call `burn`. Burns fire the `destroyed` and `transferred` compliance hooks so modules keep supply counters and holder statistics accurate. Typical holders of this role: the redemption desk or an automated buy-back process.',
  },
  'role.freezer': {
    id: 'role.freezer',
    description:
      'Freezes or unfreezes an entire address — used for sanctions screening, fraud response, and regulatory holds.',
    infoCopy:
      'The freezer can flip an address between frozen and unfrozen states at will. While frozen, the address can neither send nor receive tokens, but its balance, claims, and identity bindings are preserved. Usually delegated to a compliance officer or an automated sanctions-screening service.',
  },
  'role.partial-freezer': {
    id: 'role.partial-freezer',
    description:
      'Freezes or unfreezes a specific amount of an address’s balance without blocking the rest. Useful for escrow, disputed shares, and vesting schedules.',
    infoCopy:
      'Carves out a locked quantity on an address while the remaining balance stays transferable. Common uses: ring-fencing disputed shares during arbitration, enforcing a vesting cliff, isolating tokens subject to a subpoena. The frozen amount is subtracted from the transferable balance check on every outgoing transfer.',
  },
  'role.forced-transfer': {
    id: 'role.forced-transfer',
    description:
      'Moves tokens between two already-verified wallets without the sender’s signature — required for court orders, inheritance, and similar regulatory actions.',
    infoCopy:
      'The regulator-facing override: probate, divorce settlements, tax-seizure orders, regulatory clawbacks. Consent is bypassed but identity and compliance rules are not — the recipient must already hold a verified ONCHAINID with the required claims, and a forced transfer into an ineligible jurisdiction still reverts.',
  },
  'role.recovery': {
    id: 'role.recovery',
    description:
      'Transfers a verified investor’s balance from a lost or compromised wallet to a new wallet that the Identity Registry has approved as the recovery target.',
    infoCopy:
      'Executes the lost-wallet recovery flow: after an identity-registrar operator records the new wallet as the recovery target, this role moves balance, frozen state, and identity binding in a single transaction. The old wallet is unbound from the ONCHAINID so it can no longer receive the token.',
  },
  'role.pauser': {
    id: 'role.pauser',
    description:
      'Pauses and unpauses the contract. A paused contract rejects every transfer, mint, and burn until resumed.',
    infoCopy:
      'Acts as a circuit-breaker for regulatory stop orders, exploit response, or a deliberate maintenance window. While paused, every state-changing entry point reverts; balances, frozen state, and identity registrations are preserved untouched.',
  },
  'role.compliance': {
    id: 'role.compliance',
    description:
      'Manages the Compliance contract: binds the token, registers or removes modules, and configures per-module parameters (e.g. country lists, supply limits).',
    infoCopy:
      'Controls the pluggable compliance stack. This role can add or remove modules on the fly, tune their parameters (allow-lists, caps, lockup durations), and re-wire which hooks they register for. It cannot bypass the rules — every operation still runs through the active hook set.',
  },
  'role.identity': {
    id: 'role.identity',
    description:
      'Manages the Identity Verifier stack: registers investor wallets in the Identity Registry Storage, updates countries, and wires the Claim Topics & Issuers registry.',
    infoCopy:
      'Responsible for onboarding verified investors: binding an ONCHAINID to a wallet in the Identity Registry Storage, updating residency data, and curating the Trusted Issuers Registry. Typically a KYC / compliance operator or an automated identity-verifier service.',
  },
  'role.document-manager': {
    id: 'role.document-manager',
    description:
      'Attaches, updates, and removes ERC-1643-style legal documents (prospectuses, subscription agreements, reports) on the token contract.',
    infoCopy:
      'Maintains the on-chain document registry attached to the token — each entry is a name plus an off-chain URI and an on-chain content hash so investors can verify integrity. Used to publish prospectuses, subscription agreements, periodic reports, and material updates.',
  },
} as const;
