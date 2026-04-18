import type { ConceptDictionary } from '../types';

/**
 * Administrative controls — T-REX capabilities exposed to operators after
 * deployment. Concepts are defined by the standard and travel verbatim
 * across execution environments.
 */
export const ADMIN_CONTROLS_COPY: ConceptDictionary = {
  'admin.burnable': {
    id: 'admin.burnable',
    description:
      'Lets a burn-role operator retire tokens from a holder (e.g. redemption, supply buyback). Burns still run through compliance hooks.',
    infoCopy:
      'Used for primary-market redemptions and to reduce outstanding supply after buy-backs. Requires the burn role assigned in Access Control. Every burn fires the `destroyed` (and `transferred`) compliance hooks, so supply caps, country limits, and holder counters stay consistent with the on-chain balance.',
  },
  'admin.mintable': {
    id: 'admin.mintable',
    description:
      'Lets a mint-role operator issue new tokens to an investor. Recipients must have a verified ONCHAINID and pass every canCreate compliance hook.',
    infoCopy:
      'Covers primary issuance and follow-on offerings. The `canCreate` pre-check runs before the mint — any registered module (eligibility, max-supply, investor cap) can veto it and revert the transaction. On success, the `created` post-hook fires so modules can bump supply and investor counters. A recipient without the required claims cannot be minted to — there is no partial or silent mint.',
  },
  'admin.pausable': {
    id: 'admin.pausable',
    description:
      'Lets a pauser halt all transfers, mints, and burns in an emergency (regulatory action, incident response). Unpausing resumes normal operation.',
    infoCopy:
      'Acts as a circuit-breaker for regulatory stop orders, exploit response, or a deliberate maintenance window. While paused, every state-changing entry point reverts; balances, frozen state, and identity registrations are preserved untouched. Because it is the bluntest instrument in T-REX, restrict the pauser role to an account you trust to act under time pressure.',
  },
} as const;
