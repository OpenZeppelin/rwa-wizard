import type { ConceptDictionary } from '../types';

/**
 * Compliance hooks — the fixed set of extension points the T-REX Compliance
 * contract exposes to pluggable modules. Hook ids are pure T-REX vocabulary
 * and travel verbatim across execution environments.
 */
export const COMPLIANCE_HOOKS_COPY: ConceptDictionary = {
  'hook.transferred': {
    id: 'hook.transferred',
    title: 'Transferred',
    description:
      'Runs after a transfer is applied but within the same transaction. Modules can update state or reject the operation atomically.',
    infoCopy:
      '`transferred` receives pre-operation account snapshots, transfer amount, and transfer kind. A module can update its own accounting or reject the operation atomically.',
  },
  'hook.created': {
    id: 'hook.created',
    title: 'Created',
    description:
      'Runs after a mint is applied but within the same transaction. Modules use it for supply caps, lock creation, and balance accounting.',
    infoCopy:
      '`created` receives the recipient snapshot, amount, and token. A module can reject the mint atomically or persist post-mint accounting.',
  },
  'hook.destroyed': {
    id: 'hook.destroyed',
    title: 'Destroyed',
    description:
      'Runs after a burn is applied but within the same transaction. Modules use it to keep supply, balance, and lock state in sync.',
    infoCopy:
      '`destroyed` receives the burned account snapshot, amount, and token. Any rejection reverts the burn and all related state updates.',
  },
} as const;
