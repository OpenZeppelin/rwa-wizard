import type { ConceptOverride } from '../types';

/**
 * EVM-specific patches over the chain-neutral core. The EVM target is not
 * yet shippable, so this file carries only the target identity today; add
 * entries here when EVM-specific phrasing is genuinely more useful than
 * the chain-neutral version.
 */
export const EVM_OVERRIDE: ConceptOverride = {
  'target.evm': {
    title: 'EVM',
    description: 'Ethereum Virtual Machine (future)',
  },
  'fieldHelper.address-list.placeholder': {
    description: '0x... address',
  },
  'fieldHelper.address-list.bulk-placeholder': {
    description: '0x... address (one per line, or comma-separated)',
  },
} as const;
