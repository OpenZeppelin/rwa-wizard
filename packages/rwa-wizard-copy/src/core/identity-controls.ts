import type { ConceptDictionary } from '../types';

/**
 * Identity controls — investor-facing lifecycle actions the token surface
 * exposes (freezing, recovery, forced transfers). Pure T-REX vocabulary.
 */
export const IDENTITY_CONTROLS_COPY: ConceptDictionary = {
  'identity.addressFreezing': {
    id: 'identity.addressFreezing',
    description:
      'Block an entire address from sending or receiving the token (e.g. sanctions, fraud, court order). The balance is preserved but non-transferable until unfrozen.',
    infoCopy:
      'Most commonly triggered by a sanctions-list hit (OFAC, EU, UN) or a live fraud investigation. The freezer role can freeze and unfreeze at will, but the action is fully observable on-chain and is typically logged against the compliance file of the target. Balances, claims, and identity bindings are untouched — only outbound and inbound transfers are blocked until the address is unfrozen.',
  },
  'identity.partialTokenFreezing': {
    id: 'identity.partialTokenFreezing',
    description:
      'Freeze a specific amount of tokens on an address without blocking the rest — useful for escrow, disputed shares, or vesting locks.',
    infoCopy:
      'Carves out a locked quantity while the remaining balance stays transferable. Used to ring-fence disputed shares during arbitration, enforce a partial vesting cliff, or isolate tokens that are the subject of a subpoena. The frozen amount is tracked per address and subtracted from the transferable balance check on every outgoing transfer.',
  },
  'identity.recovery': {
    id: 'identity.recovery',
    description:
      'Move balances (and frozen-state) from a lost or compromised wallet to a new wallet that the same verified investor controls. Only possible after the Identity Registry records the new address as the recovery target.',
    infoCopy:
      'The investor re-proves their identity off-chain; an identity-registrar operator records the new wallet as the recovery target; the recovery role then moves balance, frozen state, and identity binding in a single transaction. The old wallet is unbound from the ONCHAINID so it can no longer receive the token. No re-KYC is required — the same ONCHAINID simply points at a new controlling key.',
  },
  'identity.forcedTransfers': {
    id: 'identity.forcedTransfers',
    description:
      'Let an authorized operator move tokens between two already-verified wallets without the sender\u2019s signature — required by most jurisdictions to execute court orders or succession.',
    infoCopy:
      'The regulator-facing override: probate, divorce settlements, tax-seizure orders, regulatory clawbacks. Consent is bypassed but identity rules are not — the recipient must already hold a verified ONCHAINID with the required claims, and compliance pre-checks still run. A forced transfer into an ineligible jurisdiction will still revert.',
  },
} as const;
