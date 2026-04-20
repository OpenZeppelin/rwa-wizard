import type { ConceptDictionary } from '../types';

/**
 * Compliance hooks — the fixed set of extension points the T-REX Compliance
 * contract exposes to pluggable modules. Hook ids are pure T-REX vocabulary
 * and travel verbatim across execution environments.
 */
export const COMPLIANCE_HOOKS_COPY: ConceptDictionary = {
  'hook.canTransfer': {
    id: 'hook.canTransfer',
    title: 'Can Transfer (pre-check)',
    description:
      'Read-only check before a transfer. Any registered module that returns false vetoes the transaction (country allow-list, max balance, time-limit, etc.).',
    infoCopy:
      '`canTransfer` runs before the balance update. Modules see sender, recipient, and amount; returning false reverts the transaction before any state changes. Because it is read-only, the check is cheap and safe to add many modules to — each hook-registered module votes independently and any single veto blocks the transfer.',
  },
  'hook.canCreate': {
    id: 'hook.canCreate',
    title: 'Can Create (pre-check)',
    description:
      'Read-only check before a mint. Any registered module that returns false vetoes the mint (supply cap, investor cap, eligibility, etc.).',
    infoCopy:
      '`canCreate` runs before a mint is applied. Modules can veto based on the recipient’s identity, the size of the mint, or an aggregate like total supply. A vetoed mint reverts cleanly — there is no partial or silent mint.',
  },
  'hook.transferred': {
    id: 'hook.transferred',
    title: 'Transferred (post-state)',
    description:
      'State-modifying notification after a successful transfer. Modules use this to update accumulators — rolling volumes, holder counts, per-address totals.',
    infoCopy:
      '`transferred` fires after the balances are already updated. It is where modules track state — velocity counters, per-investor cumulative amounts, holder counts. Reverting in a post-hook is not a design affordance; if a rule needs to block a transfer, it belongs in `canTransfer`.',
  },
  'hook.created': {
    id: 'hook.created',
    title: 'Created (post-state)',
    description:
      'State-modifying notification after a successful mint. Modules use this to track total supply, investor counts, and issuance quotas.',
    infoCopy:
      '`created` fires after the mint lands. Supply-tracking modules (supply limit, investor cap) update their tallies here so the next `canCreate` sees a consistent view.',
  },
  'hook.destroyed': {
    id: 'hook.destroyed',
    title: 'Destroyed (post-state)',
    description:
      'State-modifying notification after a successful burn. Modules use this to keep accumulators in sync with the outstanding supply.',
    infoCopy:
      '`destroyed` fires after a burn reduces the balance. Accumulator-based modules decrement their counters here so supply caps and holder statistics stay consistent.',
  },
} as const;
