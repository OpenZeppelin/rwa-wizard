import type { ConceptDictionary } from '../types';

/**
 * Ownership models for the root admin of the token contract. These are
 * chain-neutral UX patterns — the underlying mechanism (a single EOA,
 * a multi-sig wallet, a governance contract) exists on every chain the
 * wizard targets.
 */
export const OWNERSHIP_MODELS_COPY: ConceptDictionary = {
  'ownershipModel.single-owner': {
    id: 'ownershipModel.single-owner',
    title: 'Single Owner',
    description: 'A single wallet holds the admin role and can grant / revoke every other role.',
  },
  'ownershipModel.multi-sig': {
    id: 'ownershipModel.multi-sig',
    title: 'Multi-Sig Owner',
    description:
      'A multi-signature wallet (e.g. Safe, Fireblocks) is the admin — every privileged call requires the configured signer threshold.',
  },
  'ownershipModel.dao': {
    id: 'ownershipModel.dao',
    title: 'DAO Owner',
    description: 'A governance contract is the admin — privileged calls execute via on-chain vote.',
  },
} as const;
